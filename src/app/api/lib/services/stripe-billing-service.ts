// Stripe Billing Service - Integrates Stripe with internal billing system
import { prisma } from '@app/database';

import { logger } from '../utils/logger';
import { StripePaymentProvider } from '../payments/providers/stripe-provider';

export class StripeBillingService {
  private stripeProvider: StripePaymentProvider;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';

    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripeProvider = new StripePaymentProvider(apiKey, webhookSecret, environment as any);
    logger.info('Stripe billing service initialized', { environment });
  }

  /**
   * Create Stripe Product and Price for a subscription plan
   */
  async createStripeProductAndPrice(planData: {
    name: string;
    description?: string;
    amount: number;
    currency: string;
    billingInterval: 'monthly' | 'yearly';
    tier: string;
    features?: string[];
  }): Promise<{ productId: string; priceId: string }> {
    try {
      const { stripe } = this.stripeProvider as any;

      // Create Stripe Product
      const product = await stripe.products.create({
        name: planData.name,
        description: planData.description || `${planData.tier} Plan`,
        metadata: {
          tier: planData.tier,
          features: planData.features ? JSON.stringify(planData.features) : undefined,
        },
      });

      logger.info('Stripe product created', {
        productId: product.id,
        name: planData.name,
      });

      // Create Stripe Price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(planData.amount * 100), // Convert to cents
        currency: planData.currency.toLowerCase(),
        recurring: {
          interval: planData.billingInterval === 'yearly' ? 'year' : 'month',
        },
        metadata: {
          tier: planData.tier,
        },
      });

      logger.info('Stripe price created', {
        priceId: price.id,
        productId: product.id,
        amount: planData.amount,
      });

      return {
        productId: product.id,
        priceId: price.id,
      };
    } catch (error) {
      logger.error('Failed to create Stripe product and price', error as Error, {
        planName: planData.name,
      });
      throw error;
    }
  }

  /**
   * Update Stripe Product metadata (prices are immutable, so create new price for changes)
   */
  async updateStripeProduct(
    productId: string,
    updates: {
      name?: string;
      description?: string;
      features?: string[];
    }
  ): Promise<void> {
    try {
      const { stripe } = this.stripeProvider as any;

      await stripe.products.update(productId, {
        name: updates.name,
        description: updates.description,
        metadata: updates.features
          ? {
              features: JSON.stringify(updates.features),
            }
          : undefined,
      });

      logger.info('Stripe product updated', { productId });
    } catch (error) {
      logger.error('Failed to update Stripe product', error as Error, { productId });
      throw error;
    }
  }

  /**
   * Create new Stripe Price for existing product (for plan price changes)
   */
  async createNewStripePrice(
    productId: string,
    amount: number,
    currency: string,
    billingInterval: 'monthly' | 'yearly'
  ): Promise<string> {
    try {
      const { stripe } = this.stripeProvider as any;

      const price = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        recurring: {
          interval: billingInterval === 'yearly' ? 'year' : 'month',
        },
      });

      logger.info('New Stripe price created for existing product', {
        priceId: price.id,
        productId,
        amount,
      });

      return price.id;
    } catch (error) {
      logger.error('Failed to create new Stripe price', error as Error, { productId });
      throw error;
    }
  }

  /**
   * Archive Stripe Price (when plan is deactivated)
   */
  async archiveStripePrice(priceId: string): Promise<void> {
    try {
      const { stripe } = this.stripeProvider as any;

      await stripe.prices.update(priceId, {
        active: false,
      });

      logger.info('Stripe price archived', { priceId });
    } catch (error) {
      logger.error('Failed to archive Stripe price', error as Error, { priceId });
      throw error;
    }
  }

  /**
   * Create or get Stripe customer for billing account
   */
  async getOrCreateStripeCustomer(billingAccountId: string): Promise<string> {
    try {
      // Get billing account
      const billingAccount = await prisma.billingAccount.findUnique({
        where: { id: billingAccountId },
      });

      if (!billingAccount) {
        throw new Error('Billing account not found');
      }

      // Check if already has Stripe customer
      if (billingAccount.stripeCustomerId) {
        return billingAccount.stripeCustomerId;
      }

      // Create Stripe customer
      const customer = await this.stripeProvider.createCustomer({
        email: billingAccount.email,
        name: billingAccount.name,
        address: billingAccount.billingAddress
          ? {
              line1: (billingAccount.billingAddress as any).line1 || '',
              line2: (billingAccount.billingAddress as any).line2,
              city: (billingAccount.billingAddress as any).city || '',
              state: (billingAccount.billingAddress as any).state,
              postal_code: (billingAccount.billingAddress as any).postalCode || '',
              country: (billingAccount.billingAddress as any).country || 'US',
            }
          : undefined,
      });

      // Update billing account with Stripe customer ID
      await prisma.billingAccount.update({
        where: { id: billingAccountId },
        data: { stripeCustomerId: customer.id },
      });

      logger.info('Stripe customer created', {
        billingAccountId,
        stripeCustomerId: customer.id,
      });

      return customer.id!;
    } catch (error) {
      logger.error('Failed to get or create Stripe customer', error as Error, {
        billingAccountId,
      });
      throw error;
    }
  }

  /**
   * Create Stripe subscription for internal subscription
   */
  async createStripeSubscription(
    subscriptionId: string,
    options?: { paymentMethodId?: string; trialDays?: number }
  ): Promise<string> {
    try {
      // Get subscription with plan
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: true,
          billingAccount: true,
        },
      });

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Get or create Stripe customer
      const stripeCustomerId = await this.getOrCreateStripeCustomer(subscription.billingAccountId);

      // Attach payment method if provided
      if (options?.paymentMethodId) {
        await this.stripeProvider.attachPaymentMethod(options.paymentMethodId, stripeCustomerId);
      }

      // Get Stripe price ID from plan metadata
      const stripePriceId = (subscription.plan as any as any)?.stripePriceId;
      if (!stripePriceId) {
        throw new Error('Plan does not have a Stripe price ID configured');
      }

      // Create Stripe subscription
      const stripeSubscription = await this.stripeProvider.createSubscription({
        customer: { id: stripeCustomerId, email: subscription.billingAccount.email },
        plan_id: stripePriceId,
        quantity: 1,
        trial_period_days: options?.trialDays,
        metadata: {
          subscriptionId: subscription.id,
          billingAccountId: subscription.billingAccountId,
          projectId: subscription.projectId,
        },
      });

      // Update internal subscription with Stripe subscription ID
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          stripeSubscriptionId: stripeSubscription.id,
          metadata: {
            ...(subscription.metadata as any),
            stripeSubscriptionId: stripeSubscription.id,
          },
        },
      });

      logger.info('Stripe subscription created', {
        subscriptionId,
        stripeSubscriptionId: stripeSubscription.id,
      });

      return stripeSubscription.id;
    } catch (error) {
      logger.error('Failed to create Stripe subscription', error as Error, { subscriptionId });
      throw error;
    }
  }

  /**
   * Update Stripe subscription (plan change)
   */
  async updateStripeSubscription(subscriptionId: string, newPlanId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true },
      });

      if (!subscription?.stripeSubscriptionId) {
        throw new Error('Subscription does not have a Stripe subscription');
      }

      const newPlan = await prisma.subscriptionPlan.findUnique({
        where: { id: newPlanId },
      });

      if (!newPlan) {
        throw new Error('New plan not found');
      }

      // Get Stripe price ID from plan
      const stripePriceId = newPlan.stripePriceId || (newPlan.pricing as any)?.stripePriceId;
      if (!stripePriceId) {
        throw new Error('New plan does not have a Stripe price ID configured');
      }

      // Get Stripe instance directly
      const { stripe } = this.stripeProvider as any;

      // Retrieve current Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );

      if (!stripeSubscription || stripeSubscription.items.data.length === 0) {
        throw new Error('Stripe subscription has no items');
      }

      const currentItem = stripeSubscription.items.data[0];

      // Update Stripe subscription with new price
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        items: [
          {
            id: currentItem.id,
            price: stripePriceId, // Change to new price
          },
        ],
        proration_behavior: 'create_prorations', // Pro-rate the difference
        metadata: {
          planId: newPlanId,
          upgradedAt: new Date().toISOString(),
          previousPlanId: subscription.planId,
        },
      });

      logger.info('Stripe subscription updated with new price', {
        subscriptionId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        newPlanId,
        stripePriceId,
        previousPlanId: subscription.planId,
      });
    } catch (error) {
      logger.error('Failed to update Stripe subscription', error as Error, {
        subscriptionId,
        newPlanId,
      });
      throw error;
    }
  }

  /**
   * Cancel Stripe subscription
   */
  async cancelStripeSubscription(subscriptionId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription?.stripeSubscriptionId) {
        logger.warn('Subscription does not have a Stripe subscription to cancel', {
          subscriptionId,
        });
        return;
      }

      await this.stripeProvider.cancelSubscription(subscription.stripeSubscriptionId);

      logger.info('Stripe subscription canceled', {
        subscriptionId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      });
    } catch (error) {
      logger.error('Failed to cancel Stripe subscription', error as Error, { subscriptionId });
      throw error;
    }
  }

  /**
   * Create payment intent for one-time charge
   */
  async createPaymentIntent(
    billingAccountId: string,
    amount: number,
    currency: string = 'usd',
    description?: string
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      const stripeCustomerId = await this.getOrCreateStripeCustomer(billingAccountId);

      const paymentIntent = await this.stripeProvider.createPaymentIntent({
        amount,
        currency,
        description,
        customer: { id: stripeCustomerId, email: 'unknown@example.com' },
        automatic_payment_methods: { enabled: true },
      });

      return {
        clientSecret: (paymentIntent as any).clientSecret || (paymentIntent as any).client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error('Failed to create payment intent', error as Error, {
        billingAccountId,
        amount,
      });
      throw error;
    }
  }

  /**
   * List payment methods for billing account
   */
  async listPaymentMethods(billingAccountId: string) {
    try {
      const stripeCustomerId = await this.getOrCreateStripeCustomer(billingAccountId);
      return await this.stripeProvider.listPaymentMethods(stripeCustomerId);
    } catch (error) {
      logger.error('Failed to list payment methods', error as Error, { billingAccountId });
      throw error;
    }
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(billingAccountId: string, paymentMethodId: string) {
    try {
      const stripeCustomerId = await this.getOrCreateStripeCustomer(billingAccountId);
      return await this.stripeProvider.attachPaymentMethod(paymentMethodId, stripeCustomerId);
    } catch (error) {
      logger.error('Failed to attach payment method', error as Error, {
        billingAccountId,
        paymentMethodId,
      });
      throw error;
    }
  }

  /**
   * Detach payment method
   */
  async detachPaymentMethod(paymentMethodId: string) {
    try {
      return await this.stripeProvider.detachPaymentMethod(paymentMethodId);
    } catch (error) {
      logger.error('Failed to detach payment method', error as Error, { paymentMethodId });
      throw error;
    }
  }

  /**
   * Create setup intent for adding payment method
   */
  async createSetupIntent(billingAccountId: string): Promise<{ clientSecret: string }> {
    try {
      const stripeCustomerId = await this.getOrCreateStripeCustomer(billingAccountId);

      // Create setup intent via raw Stripe API
      const { stripe } = this.stripeProvider as any;
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
      });

      return {
        clientSecret: setupIntent.client_secret,
      };
    } catch (error) {
      logger.error('Failed to create setup intent', error as Error, { billingAccountId });
      throw error;
    }
  }

  /**
   * Get Stripe customer portal URL
   */
  async createCustomerPortalSession(billingAccountId: string, returnUrl: string): Promise<string> {
    try {
      const stripeCustomerId = await this.getOrCreateStripeCustomer(billingAccountId);

      const { stripe } = this.stripeProvider as any;
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });

      return session.url;
    } catch (error) {
      logger.error('Failed to create customer portal session', error as Error, {
        billingAccountId,
      });
      throw error;
    }
  }

  /**
   * Handle Stripe webhook event
   */
  static async handleWebhookEvent(event: any): Promise<void> {
    try {
      logger.info('Processing Stripe webhook event', { type: event.type, id: event.id });

      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await StripeBillingService.syncSubscriptionFromStripe(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await StripeBillingService.handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.paid':
          await StripeBillingService.handleInvoicePaid(event.data.object);
          break;

        case 'invoice.payment_failed':
          await StripeBillingService.handleInvoicePaymentFailed(event.data.object);
          break;

        case 'payment_method.attached':
          logger.info('Payment method attached', { customerId: event.data.object.customer });
          break;

        default:
          logger.debug('Unhandled webhook event type', { type: event.type });
      }
    } catch (error) {
      logger.error('Failed to handle webhook event', error as Error, {
        eventType: event.type,
        eventId: event.id,
      });
      throw error;
    }
  }

  private static async syncSubscriptionFromStripe(stripeSubscription: any): Promise<void> {
    try {
      const subscriptionId = stripeSubscription.metadata?.subscriptionId;
      if (!subscriptionId) {
        logger.warn('Stripe subscription has no internal subscription ID', {
          stripeSubscriptionId: stripeSubscription.id,
        });
        return;
      }

      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: stripeSubscription.status.toUpperCase(),
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        },
      });

      logger.info('Subscription synced from Stripe', {
        subscriptionId,
        status: stripeSubscription.status,
      });
    } catch (error) {
      logger.error('Failed to sync subscription from Stripe', error as Error);
    }
  }

  private static async handleSubscriptionDeleted(stripeSubscription: any): Promise<void> {
    try {
      const subscriptionId = stripeSubscription.metadata?.subscriptionId;
      if (!subscriptionId) return;

      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'CANCELED',
          canceledAt: new Date(),
        },
      });

      logger.info('Subscription marked as canceled from Stripe webhook', { subscriptionId });
    } catch (error) {
      logger.error('Failed to handle subscription deletion', error as Error);
    }
  }

  private static async handleInvoicePaid(stripeInvoice: any): Promise<void> {
    try {
      const subscriptionId = stripeInvoice.subscription_details?.metadata?.subscriptionId;
      if (!subscriptionId) return;

      // Create invoice record
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) return;

      const invoiceDate = new Date((stripeInvoice as any).created * 1000);
      await prisma.invoice.create({
        data: {
          billingAccountId: subscription.billingAccountId,
          subscriptionId: subscription.id,
          invoiceNumber: (stripeInvoice as any).number || `INV-${Date.now()}`,
          status: 'PAID',
          subtotal: (stripeInvoice as any).subtotal / 100,
          tax: ((stripeInvoice as any).tax || 0) / 100,
          total: (stripeInvoice as any).total / 100,
          currency: (stripeInvoice as any).currency.toUpperCase(),
          periodStart: invoiceDate,
          periodEnd: new Date((stripeInvoice as any).period_end * 1000),
          dueDate: new Date((stripeInvoice as any).due_date * 1000),
          paidAt: new Date((stripeInvoice as any).status_transitions.paid_at * 1000),
          stripeInvoiceId: (stripeInvoice as any).id,
        },
      });

      logger.info('Invoice created from Stripe webhook', {
        subscriptionId,
        stripeInvoiceId: stripeInvoice.id,
      });
    } catch (error) {
      logger.error('Failed to handle invoice paid', error as Error);
    }
  }

  private static async handleInvoicePaymentFailed(stripeInvoice: any): Promise<void> {
    try {
      const subscriptionId = stripeInvoice.subscription_details?.metadata?.subscriptionId;
      if (!subscriptionId) return;

      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) return;

      // Create billing alert
      await prisma.billingAlert.create({
        data: {
          billingAccountId: subscription.billingAccountId,
          type: 'PAYMENT_FAILED',
          severity: 'CRITICAL',
          message: `Payment failed for invoice ${stripeInvoice.number}`,
          threshold: String(stripeInvoice.amount_due / 100),
        },
      });

      logger.warn('Payment failed alert created', {
        subscriptionId,
        stripeInvoiceId: stripeInvoice.id,
      });
    } catch (error) {
      logger.error('Failed to handle invoice payment failed', error as Error);
    }
  }
}
