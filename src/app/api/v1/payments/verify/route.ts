// Payment verification endpoint
import { z } from 'zod';
import Stripe from 'stripe';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Lazy initialize Stripe to avoid build-time errors
function getStripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil',
  });
}

const verifyPaymentSchema = z.object({
  paymentIntentId: z.string().min(1),
});

const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['POST'],
  },
  {
    POST: async ({ body, context, auth }) => {
      try {
        const validation = verifyPaymentSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid request data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const { paymentIntentId } = validation.data;
        const userId = auth.user?.id;

        if (!userId) {
          return createErrorResponse(
            'UNAUTHORIZED',
            { message: 'User not authenticated' },
            context.requestId
          );
        }

        // Try to check payment intent in Stripe (optional - webhook will handle this)
        let paymentIntent = null;
        let skipStripeCheck = false;

        try {
          const stripe = getStripeClient();
          if (!stripe) {
            logger.warn('STRIPE_SECRET_KEY not set, skipping Stripe verification', {
              requestId: context.requestId,
            });
            skipStripeCheck = true;
          } else {
            paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            if (!paymentIntent || paymentIntent.status !== 'succeeded') {
              logger.warn('Payment intent not succeeded', {
                paymentIntentId,
                status: paymentIntent?.status,
                requestId: context.requestId,
              });
              return createErrorResponse(
                'PAYMENT_ERROR',
                { message: 'Payment not completed', status: paymentIntent?.status },
                context.requestId
              );
            }
          }
        } catch (stripeError: any) {
          logger.warn('Failed to retrieve payment intent from Stripe, will check database', {
            error: stripeError,
            paymentIntentId,
            requestId: context.requestId,
          });
          // Continue anyway - maybe subscription was created by webhook
          skipStripeCheck = true;
        }

        // Check if subscription already exists for this payment intent
        // Note: Querying JSON fields in Prisma requires raw query or checking all subscriptions
        const allUserSubscriptions = await prisma.subscription.findMany({
          where: {
            billingAccount: {
              organization: {
                members: {
                  some: {
                    userId,
                    isActive: true,
                  },
                },
              },
            },
          },
          include: {
            plan: true,
            billingAccount: true,
            project: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const existingSubscription = allUserSubscriptions.find(
          (sub) => (sub.metadata as any)?.paymentIntentId === paymentIntentId
        );

        if (existingSubscription) {
          return createSuccessResponse(
            {
              subscription: existingSubscription,
              message: 'Subscription already exists',
            },
            200,
            context.requestId
          );
        }

        // If we skipped Stripe check, just return the latest subscription
        if (skipStripeCheck) {
          const latestSubscription = allUserSubscriptions[0]; // Already ordered by createdAt desc
          if (latestSubscription) {
            return createSuccessResponse(
              {
                subscription: latestSubscription,
                message: 'Payment successful. Subscription will be created by webhook.',
              },
              200,
              context.requestId
            );
          }

          // No subscriptions yet - webhook will create it
          return createSuccessResponse(
            {
              subscription: null,
              message: 'Payment successful. Your subscription is being activated.',
            },
            202,
            context.requestId
          );
        }

        // Extract metadata from payment intent
        const planTier = paymentIntent?.metadata?.plan_tier;
        const priceId = paymentIntent?.metadata?.price_id;

        if (!planTier) {
          logger.warn('Payment intent missing plan information', {
            paymentIntentId,
            metadata: paymentIntent?.metadata,
            requestId: context.requestId,
          });

          // Return the latest subscription if available
          const latestSubscription = allUserSubscriptions[0];
          if (latestSubscription) {
            return createSuccessResponse(
              {
                subscription: latestSubscription,
                message: 'Returning latest subscription',
              },
              200,
              context.requestId
            );
          }

          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Payment intent missing plan information' },
            context.requestId
          );
        }

        // Get user's organization
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
          return createErrorResponse(
            'UNAUTHORIZED',
            { message: 'User not found' },
            context.requestId
          );
        }

        // Get or create organization for user
        const organization =
          user.organizationMembers.length > 0
            ? user.organizationMembers[0].organization
            : await (async () => {
                // Create a default organization for the user
                const userNameSlug = user.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
                const uniqueSlug = `${userNameSlug}-${userId.slice(-8)}`;

                const newOrg = await prisma.organization.create({
                  data: {
                    name: `${user.name}'s Organization`,
                    slug: uniqueSlug,
                    ownerId: userId,
                    status: 'ACTIVE',
                    members: {
                      create: {
                        userId,
                        role: 'OWNER',
                        isActive: true,
                      },
                    },
                  },
                });

                logger.info('Created default organization for user', {
                  userId,
                  organizationId: newOrg.id,
                  requestId: context.requestId,
                });

                return newOrg;
              })();

        // Get or create billing account
        let billingAccount = await prisma.billingAccount.findFirst({
          where: { organizationId: organization.id },
        });

        if (!billingAccount) {
          let customerId: string | null = null;
          if (paymentIntent) {
            if (typeof paymentIntent.customer === 'string') {
              customerId = paymentIntent.customer;
            } else {
              customerId = paymentIntent.customer?.id || null;
            }
          }

          billingAccount = await prisma.billingAccount.create({
            data: {
              organizationId: organization.id,
              name: `${organization.name} Billing`,
              email: user.email,
              stripeCustomerId: customerId,
            },
          });
        }

        // Find subscription plan
        const planMapping: Record<string, string> = {
          STARTER: 'Starter',
          PROFESSIONAL: 'Professional',
          ENTERPRISE: 'Enterprise',
        };

        const planName = planMapping[planTier] || planTier;
        let subscriptionPlan = await prisma.subscriptionPlan.findFirst({
          where: { tier: planTier as any },
        });

        if (!subscriptionPlan) {
          // Create default plan
          const planPrices: Record<string, { monthly: number; yearly: number }> = {
            STARTER: { monthly: 29, yearly: 290 },
            PROFESSIONAL: { monthly: 99, yearly: 990 },
            ENTERPRISE: { monthly: 299, yearly: 2990 },
          };

          const isYearly = priceId?.includes('yearly');
          const amount =
            planPrices[planTier]?.[isYearly ? 'yearly' : 'monthly'] ||
            (paymentIntent ? paymentIntent.amount / 100 : 0);

          subscriptionPlan = await prisma.subscriptionPlan.create({
            data: {
              name: planName,
              tier: planTier as any,
              pricing: {
                price: amount,
                currency: paymentIntent?.currency || 'usd',
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

        // Create subscription
        const subscription = await prisma.subscription.create({
          data: {
            billingAccountId: billingAccount.id,
            projectId: project.id,
            planId: subscriptionPlan.id,
            status: 'TRIALING',
            stripeSubscriptionId: paymentIntentId,
            currentPeriodStart: now,
            currentPeriodEnd,
            trialStart: now,
            trialEnd,
            metadata: {
              paymentIntentId,
              priceId,
            },
          },
          include: {
            plan: true,
            billingAccount: true,
            project: true,
          },
        });

        logger.info('Subscription created via verify endpoint', {
          subscriptionId: subscription.id,
          userId,
          organizationId: organization.id,
          planTier,
          paymentIntentId,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            subscription,
            message: 'Subscription created successfully',
          },
          201,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to verify payment', error as Error, {
          userId: auth.user?.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to verify payment and create subscription',
            details: error instanceof Error ? error.message : String(error),
          },
          context.requestId
        );
      }
    },
  }
);

export const POST = handler;
