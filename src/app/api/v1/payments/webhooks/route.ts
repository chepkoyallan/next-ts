// Payment Webhooks API endpoint
import { z } from 'zod';
import { NextRequest } from 'next/server';

import { prisma } from '@app/database';
import { sendPaymentFailed, sendPaymentSuccess } from '@app/email/email-manager';

import { logger } from '../../../lib/utils/logger';
import { PaymentProviderError } from '../../../lib/payments/types';
import { PaymentService } from '../../../lib/payments/payment-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Webhook validation schema
const webhookSchema = z.object({
  provider: z.enum(['stripe']).optional().default('stripe'),
});

/**
 * Handle payment webhook events
 * This endpoint receives webhook events from payment providers
 */
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Get provider from query params or default to stripe
    const url = new URL(request.url);
    const provider = url.searchParams.get('provider') || 'stripe';

    // Validate provider
    const { provider: validatedProvider } = webhookSchema.parse({ provider });

    // Get raw body and signature
    const body = await request.text();
    const signature =
      request.headers.get('stripe-signature') || request.headers.get('webhook-signature') || '';

    if (!signature) {
      logger.warn('Webhook received without signature', { provider: validatedProvider, requestId });
      return createErrorResponse(
        'UNAUTHORIZED',
        { message: 'Missing webhook signature' },
        requestId
      );
    }

    const paymentService = new PaymentService();

    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const isValid = paymentService.verifyWebhookSignature(
      body,
      signature,
      webhookSecret,
      validatedProvider
    );

    if (!isValid) {
      logger.warn('Invalid webhook signature', { provider: validatedProvider, requestId });
      return createErrorResponse(
        'UNAUTHORIZED',
        { message: 'Invalid webhook signature' },
        requestId
      );
    }

    // Parse webhook event
    const event = paymentService.parseWebhookEvent(body, validatedProvider);

    logger.info('Webhook event received', {
      provider: validatedProvider,
      eventType: event.type,
      eventId: event.id,
      requestId,
    });

    // Handle different event types
    await handleWebhookEvent(event, validatedProvider, requestId);

    return createSuccessResponse({ received: true, eventId: event.id }, 200, requestId);
  } catch (error) {
    logger.error('Webhook processing failed', error as Error, { requestId });

    if (error instanceof PaymentProviderError) {
      return createErrorResponse(
        'PAYMENT_PROVIDER_ERROR',
        {
          message: error.message,
          provider: error.provider,
        },
        requestId
      );
    }

    if (error instanceof z.ZodError) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        {
          message: 'Invalid webhook request',
          errors: error.issues,
        },
        requestId
      );
    }

    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      { message: 'Webhook processing failed' },
      requestId
    );
  }
}

/**
 * Handle specific webhook events
 */
async function handleWebhookEvent(event: any, provider: string, requestId: string) {
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object, requestId);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object, requestId);
        break;

      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object, requestId);
        break;

      case 'customer.created':
        await handleCustomerCreated(event.data.object, requestId);
        break;

      case 'customer.updated':
        await handleCustomerUpdated(event.data.object, requestId);
        break;

      case 'customer.deleted':
        await handleCustomerDeleted(event.data.object, requestId);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object, requestId);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, requestId);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object, requestId);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, requestId);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, requestId);
        break;

      default:
        logger.info('Unhandled webhook event type', {
          eventType: event.type,
          eventId: event.id,
          provider,
          requestId,
        });
    }
  } catch (error) {
    logger.error('Error handling webhook event', error as Error, {
      eventType: event.type,
      eventId: event.id,
      provider,
      requestId,
    });
    throw error;
  }
}

/**
 * Handle payment succeeded event
 */
async function handlePaymentSucceeded(paymentIntent: any, requestId: string) {
  logger.info('Payment succeeded', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    customerId: paymentIntent.customer,
    metadata: paymentIntent.metadata,
    requestId,
  });

  try {
    // Extract metadata (using snake_case as set by payment intent creation)
    const userId = paymentIntent.metadata?.user_id;
    const planTier = paymentIntent.metadata?.plan_tier;
    const priceId = paymentIntent.metadata?.price_id;

    if (!userId) {
      logger.warn('Payment intent missing user_id in metadata', {
        paymentIntentId: paymentIntent.id,
        metadata: paymentIntent.metadata,
        requestId,
      });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizationMembers: {
          where: { isActive: true },
          include: { organization: true },
        },
      },
    });

    if (!user) {
      logger.error('User not found for payment intent', undefined, {
        userId,
        paymentIntentId: paymentIntent.id,
        requestId,
      });
      return;
    }

    // Get or create organization's billing account
    const organization = user.organizationMembers[0]?.organization;
    if (!organization) {
      logger.error('User has no organization for payment intent', undefined, {
        userId,
        paymentIntentId: paymentIntent.id,
        requestId,
      });
      return;
    }

    let billingAccount = await prisma.billingAccount.findFirst({
      where: { organizationId: organization.id },
    });

    if (!billingAccount) {
      billingAccount = await prisma.billingAccount.create({
        data: {
          organizationId: organization.id,
          name: `${organization.name} Billing`,
          email: user.email,
          stripeCustomerId:
            typeof paymentIntent.customer === 'string'
              ? paymentIntent.customer
              : paymentIntent.customer?.id || null,
        },
      });
    }

    // Find or create subscription plan
    const planMapping: Record<string, string> = {
      STARTER: 'Starter',
      PROFESSIONAL: 'Professional',
      ENTERPRISE: 'Enterprise',
    };

    const planName = planMapping[planTier] || planTier;
    let subscriptionPlan = await prisma.subscriptionPlan.findFirst({
      where: { tier: planTier },
    });

    if (!subscriptionPlan) {
      // Create default plan if it doesn't exist
      const planPrices: Record<string, { monthly: number; yearly: number }> = {
        STARTER: { monthly: 29, yearly: 290 },
        PROFESSIONAL: { monthly: 99, yearly: 990 },
        ENTERPRISE: { monthly: 299, yearly: 2990 },
      };

      const isYearly = priceId?.includes('yearly');
      const amount =
        planPrices[planTier]?.[isYearly ? 'yearly' : 'monthly'] || paymentIntent.amount / 100;

      subscriptionPlan = await prisma.subscriptionPlan.create({
        data: {
          name: planName,
          tier: planTier,
          pricing: {
            price: amount,
            currency: paymentIntent.currency,
            billingInterval: isYearly ? 'yearly' : 'monthly',
            stripePriceId: priceId,
          },
          limits: {
            projects: (() => {
              if (planTier === 'STARTER') return 10;
              if (planTier === 'PROFESSIONAL') return 50;
              return -1;
            })(),
            executions: (() => {
              if (planTier === 'STARTER') return 1000;
              if (planTier === 'PROFESSIONAL') return 10000;
              return -1;
            })(),
            storage: (() => {
              if (planTier === 'STARTER') return '10 GB';
              if (planTier === 'PROFESSIONAL') return '100 GB';
              return 'Unlimited';
            })(),
            users: (() => {
              if (planTier === 'STARTER') return 3;
              if (planTier === 'PROFESSIONAL') return 10;
              return -1;
            })(),
          },
          features: {},
          isActive: true,
        },
      });
    }

    // Get or create default project
    let project = await prisma.project.findFirst({
      where: { organizationId: organization.id },
    });

    if (!project) {
      project = await prisma.project.create({
        data: {
          name: `${organization.name} Project`,
          description: 'Default project',
          organizationId: organization.id,
          domain: 'production',
          flyteState: 0, // 0=ACTIVE
        },
      });
    }

    // Calculate subscription dates
    const now = new Date();
    const trialDays = 14;
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const isYearly = priceId?.includes('yearly');
    const currentPeriodEnd = new Date(now);
    if (isYearly) {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }

    // Check if subscription already exists for this billing account and project
    let subscription = await prisma.subscription.findFirst({
      where: {
        billingAccountId: billingAccount.id,
        projectId: project.id,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
    });

    if (subscription) {
      // Update existing subscription
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: subscriptionPlan.id,
          status: 'TRIALING',
          currentPeriodStart: now,
          currentPeriodEnd,
          trialStart: now,
          trialEnd,
          metadata: {
            paymentIntentId: paymentIntent.id,
            priceId,
          },
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new subscription
      subscription = await prisma.subscription.create({
        data: {
          billingAccountId: billingAccount.id,
          projectId: project.id,
          planId: subscriptionPlan.id,
          status: 'TRIALING',
          stripeSubscriptionId: paymentIntent.id,
          currentPeriodStart: now,
          currentPeriodEnd,
          trialStart: now,
          trialEnd,
          metadata: {
            paymentIntentId: paymentIntent.id,
            priceId,
          },
        },
      });
    }

    logger.info('Subscription created from payment intent', {
      subscriptionId: subscription.id,
      userId,
      organizationId: organization.id,
      planTier,
      paymentIntentId: paymentIntent.id,
      requestId,
    });

    // Send confirmation email
    await sendPaymentSuccess(user.email, {
      name: user.name || user.email,
      amount: `$${(paymentIntent.amount / 100).toFixed(2)}`,
      plan: planName,
      invoiceId: paymentIntent.id,
    });
  } catch (error) {
    logger.error('Failed to handle payment success', error as Error, {
      paymentIntentId: paymentIntent.id,
      requestId,
    });
  }
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(paymentIntent: any, requestId: string) {
  logger.warn('Payment failed', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    customerId: paymentIntent.customer,
    lastPaymentError: paymentIntent.last_payment_error,
    requestId,
  });

  // TODO: Handle payment failure
  // - Send payment failed notification
  // - Update order status
  // - Retry payment if appropriate

  // Example:
  // await emailService.sendPaymentFailedNotification(paymentIntent.customer);
  // await orderService.markAsPaymentFailed(paymentIntent.metadata.order_id);
}

/**
 * Handle payment canceled event
 */
async function handlePaymentCanceled(paymentIntent: any, requestId: string) {
  logger.info('Payment canceled', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    customerId: paymentIntent.customer,
    requestId,
  });

  // TODO: Handle payment cancellation
  // - Update order status
  // - Release reserved inventory
  // - Send cancellation notification

  // Example:
  // await orderService.markAsCanceled(paymentIntent.metadata.order_id);
  // await inventoryService.releaseReservation(paymentIntent.metadata.order_id);
}

/**
 * Handle customer created event
 */
async function handleCustomerCreated(customer: any, requestId: string) {
  logger.info('Customer created', {
    customerId: customer.id,
    email: customer.email,
    requestId,
  });

  // TODO: Sync customer data with your database
  // Example:
  // await customerService.syncFromPaymentProvider(customer);
}

/**
 * Handle customer updated event
 */
async function handleCustomerUpdated(customer: any, requestId: string) {
  logger.info('Customer updated', {
    customerId: customer.id,
    email: customer.email,
    requestId,
  });

  // TODO: Update customer data in your database
  // Example:
  // await customerService.updateFromPaymentProvider(customer);
}

/**
 * Handle customer deleted event
 */
async function handleCustomerDeleted(customer: any, requestId: string) {
  logger.info('Customer deleted', {
    customerId: customer.id,
    requestId,
  });

  // TODO: Handle customer deletion
  // - Clean up related data
  // - Cancel active subscriptions
  // - Archive customer records

  // Example:
  // await customerService.handleDeletion(customer.id);
}

/**
 * Handle invoice payment succeeded event
 */
async function handleInvoicePaymentSucceeded(invoice: any, requestId: string) {
  logger.info('Invoice payment succeeded', {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    customerId: invoice.customer,
    amount: invoice.amount_paid,
    requestId,
  });

  try {
    // Find billing account by Stripe customer ID
    const billingAccount = await prisma.billingAccount.findUnique({
      where: { stripeCustomerId: invoice.customer },
      include: {
        organization: {
          include: {
            members: {
              where: { isActive: true },
              include: { user: true },
            },
          },
        },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!billingAccount) {
      logger.warn('Billing account not found for Stripe customer', {
        customerId: invoice.customer,
        requestId,
      });
      return;
    }

    // Update subscription status if exists
    if (billingAccount.subscriptions.length > 0) {
      const subscription = billingAccount.subscriptions[0];
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined,
          updatedAt: new Date(),
        },
      });

      // Get owner or first active member for email
      const owner = billingAccount.organization.members.find((m) => m.role === 'OWNER');
      const recipient = owner || billingAccount.organization.members[0];

      if (recipient && recipient.user) {
        const amount = `$${(invoice.amount_paid / 100).toFixed(2)}`;
        const planName = subscription.plan.name || 'Subscription';

        await sendPaymentSuccess(recipient.user.email, {
          name: recipient.user.name || recipient.user.email,
          amount,
          plan: planName,
          invoiceId: invoice.id,
        });

        logger.info('Payment success email sent', {
          userId: recipient.user.id,
          email: recipient.user.email,
          amount,
          requestId,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to handle invoice payment success', error as Error, {
      invoiceId: invoice.id,
      requestId,
    });
  }
}

/**
 * Handle invoice payment failed event
 */
async function handleInvoicePaymentFailed(invoice: any, requestId: string) {
  logger.warn('Invoice payment failed', {
    invoiceId: invoice.id,
    subscriptionId: invoice.subscription,
    customerId: invoice.customer,
    amount: invoice.amount_due,
    requestId,
  });

  try {
    // Find billing account by Stripe customer ID
    const billingAccount = await prisma.billingAccount.findUnique({
      where: { stripeCustomerId: invoice.customer },
      include: {
        organization: {
          include: {
            members: {
              where: { isActive: true },
              include: { user: true },
            },
          },
        },
        subscriptions: {
          where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!billingAccount) {
      logger.warn('Billing account not found for Stripe customer', {
        customerId: invoice.customer,
        requestId,
      });
      return;
    }

    // Update subscription status to past_due if exists
    if (billingAccount.subscriptions.length > 0) {
      const subscription = billingAccount.subscriptions[0];
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'PAST_DUE',
          updatedAt: new Date(),
        },
      });

      // Get owner or first active member for email
      const owner = billingAccount.organization.members.find((m) => m.role === 'OWNER');
      const recipient = owner || billingAccount.organization.members[0];

      if (recipient && recipient.user) {
        // Calculate retry date (Stripe typically retries in 3 days)
        const retryDate = new Date();
        retryDate.setDate(retryDate.getDate() + 3);

        const amount = `$${(invoice.amount_due / 100).toFixed(2)}`;
        const planName = subscription.plan.name || 'Subscription';

        await sendPaymentFailed(recipient.user.email, {
          name: recipient.user.name || recipient.user.email,
          amount,
          plan: planName,
          retryDate: retryDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        });

        logger.info('Payment failed email sent', {
          userId: recipient.user.id,
          email: recipient.user.email,
          amount,
          requestId,
        });
      }
    }
  } catch (error) {
    logger.error('Failed to handle invoice payment failure', error as Error, {
      invoiceId: invoice.id,
      requestId,
    });
  }
}

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(subscription: any, requestId: string) {
  logger.info('Subscription created', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    requestId,
  });

  try {
    // Find billing account by Stripe customer ID
    const billingAccount = await prisma.billingAccount.findUnique({
      where: { stripeCustomerId: subscription.customer },
      include: {
        organization: {
          include: {
            members: {
              where: { isActive: true },
              include: { user: true },
            },
          },
        },
        subscriptions: {
          where: { stripeSubscriptionId: subscription.id },
          include: { plan: true },
        },
      },
    });

    if (!billingAccount) {
      logger.warn('Billing account not found for Stripe customer', {
        customerId: subscription.customer,
        requestId,
      });
      return;
    }

    // Extract plan details from subscription
    const priceId = subscription.items?.data[0]?.price?.id;

    // Map Stripe price ID to tier - these will be updated with real IDs
    const tierMapping: Record<string, string> = {
      // Placeholder - update with real Stripe price IDs
      price_starter_monthly: 'STARTER',
      price_starter_yearly: 'STARTER',
      price_professional_monthly: 'PROFESSIONAL',
      price_professional_yearly: 'PROFESSIONAL',
      price_enterprise_monthly: 'ENTERPRISE',
      price_enterprise_yearly: 'ENTERPRISE',
    };

    const tier = tierMapping[priceId] || 'STARTER';

    // Find or create subscription plan
    const subscriptionPlan = await prisma.subscriptionPlan.findFirst({
      where: { tier: tier as any },
    });

    if (!subscriptionPlan) {
      logger.warn('Subscription plan not found for tier, using defaults', {
        tier,
        requestId,
      });
      return;
    }

    // Check if subscription already exists
    if (billingAccount.subscriptions.length > 0) {
      // Update existing subscription
      await prisma.subscription.update({
        where: { id: billingAccount.subscriptions[0].id },
        data: {
          planId: subscriptionPlan.id,
          status: subscription.status.toUpperCase() as any,
          stripeSubscriptionId: subscription.id,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          metadata: {
            stripePriceId: priceId,
            cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          },
          updatedAt: new Date(),
        },
      });
    }

    logger.info('Subscription record created/updated from webhook', {
      billingAccountId: billingAccount.id,
      tier,
      status: subscription.status,
      requestId,
    });
  } catch (error) {
    logger.error('Failed to handle subscription creation', error as Error, {
      subscriptionId: subscription.id,
      requestId,
    });
  }
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(subscription: any, requestId: string) {
  logger.info('Subscription updated', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
    requestId,
  });

  try {
    // Find subscription by Stripe subscription ID
    const existingSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      include: {
        plan: true,
        billingAccount: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!existingSubscription) {
      logger.warn('Subscription not found', {
        subscriptionId: subscription.id,
        requestId,
      });
      return;
    }

    // Extract plan details
    const priceId = subscription.items?.data[0]?.price?.id;

    // Map Stripe price ID to tier - these will be updated with real IDs
    const tierMapping: Record<string, string> = {
      // Placeholder - update with real Stripe price IDs
      price_starter_monthly: 'STARTER',
      price_starter_yearly: 'STARTER',
      price_professional_monthly: 'PROFESSIONAL',
      price_professional_yearly: 'PROFESSIONAL',
      price_enterprise_monthly: 'ENTERPRISE',
      price_enterprise_yearly: 'ENTERPRISE',
    };

    const tier = tierMapping[priceId];

    // Find new plan if tier changed
    let newPlanId = existingSubscription.planId;
    if (tier && tier !== existingSubscription.plan.tier) {
      const newPlan = await prisma.subscriptionPlan.findFirst({
        where: { tier: tier as any },
      });
      if (newPlan) {
        newPlanId = newPlan.id;
      }
    }

    // Update subscription
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        planId: newPlanId,
        status: subscription.status.toUpperCase() as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        metadata: {
          ...(existingSubscription.metadata as any),
          stripePriceId: priceId,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        },
        updatedAt: new Date(),
      },
    });

    logger.info('Subscription updated', {
      subscriptionId: existingSubscription.id,
      billingAccountId: existingSubscription.billingAccountId,
      tier: tier || existingSubscription.plan.tier,
      status: subscription.status,
      requestId,
    });
  } catch (error) {
    logger.error('Failed to handle subscription update', error as Error, {
      subscriptionId: subscription.id,
      requestId,
    });
  }
}

/**
 * Handle subscription deleted event
 */
async function handleSubscriptionDeleted(subscription: any, requestId: string) {
  logger.info('Subscription deleted', {
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    requestId,
  });

  try {
    // Find subscription by Stripe subscription ID
    const existingSubscription = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
      include: {
        billingAccount: {
          include: {
            organization: {
              include: {
                members: {
                  where: { isActive: true },
                  include: { user: true },
                },
              },
            },
          },
        },
      },
    });

    if (!existingSubscription) {
      logger.warn('Subscription not found', {
        subscriptionId: subscription.id,
        requestId,
      });
      return;
    }

    // Update subscription status to canceled
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info('Subscription canceled', {
      subscriptionId: existingSubscription.id,
      billingAccountId: existingSubscription.billingAccountId,
      stripeSubscriptionId: subscription.id,
      requestId,
    });
  } catch (error) {
    logger.error('Failed to handle subscription deletion', error as Error, {
      subscriptionId: subscription.id,
      requestId,
    });
  }
}
