// Payment Service - Business Logic Layer
import { logger } from '../utils/logger';
import { StripePaymentProvider } from './providers/stripe-provider';
import {
  RefundResult,
  Subscription,
  PaymentIntent,
  PaymentResult,
  PaymentMethod,
  PaymentProvider,
  PaymentCustomer,
  CreateRefundRequest,
  PaymentProviderError,
  CreateSubscriptionRequest,
  CreatePaymentIntentRequest,
} from './types';

export class PaymentService {
  private providers: Map<string, PaymentProvider> = new Map();

  private defaultProvider: string;

  constructor() {
    this.defaultProvider = process.env.DEFAULT_PAYMENT_PROVIDER || 'stripe';
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize Stripe provider
    if (process.env.STRIPE_SECRET_KEY) {
      const stripeProvider = new StripePaymentProvider(
        process.env.STRIPE_SECRET_KEY,
        process.env.STRIPE_WEBHOOK_SECRET || '',
        process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      );
      this.providers.set('stripe', stripeProvider);
      logger.info('Stripe payment provider initialized');
    }

    // Add other providers here (PayPal, Square, etc.)
    // if (process.env.PAYPAL_CLIENT_ID) {
    //   const paypalProvider = new PayPalPaymentProvider(...);
    //   this.providers.set('paypal', paypalProvider);
    // }

    if (this.providers.size === 0) {
      logger.warn('No payment providers configured');
    }
  }

  private getProvider(providerName?: string): PaymentProvider {
    const provider = this.providers.get(providerName || this.defaultProvider);
    if (!provider) {
      throw new PaymentProviderError(
        `Payment provider '${providerName || this.defaultProvider}' not found or not configured`,
        providerName || this.defaultProvider
      );
    }
    return provider;
  }

  // Payment Intents
  async createPaymentIntent(
    request: CreatePaymentIntentRequest,
    providerName?: string
  ): Promise<PaymentIntent> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Creating payment intent', {
        provider: provider.name,
        amount: request.amount,
        currency: request.currency,
      });

      const paymentIntent = await provider.createPaymentIntent(request);

      logger.info('Payment intent created successfully', {
        provider: provider.name,
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to create payment intent', error as Error, {
        provider: provider.name,
        request,
      });
      throw error;
    }
  }

  async confirmPaymentIntent(
    payment_intent_id: string,
    payment_method_id?: string,
    providerName?: string
  ): Promise<PaymentResult> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Confirming payment intent', {
        provider: provider.name,
        payment_intent_id,
        payment_method_id,
      });

      const result = await provider.confirmPaymentIntent(payment_intent_id, payment_method_id);

      logger.info('Payment intent confirmation completed', {
        provider: provider.name,
        payment_intent_id,
        success: result.success,
        status: result.status,
      });

      return result;
    } catch (error) {
      logger.error('Failed to confirm payment intent', error as Error, {
        provider: provider.name,
        payment_intent_id,
      });
      throw error;
    }
  }

  async cancelPaymentIntent(
    payment_intent_id: string,
    providerName?: string
  ): Promise<PaymentResult> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Canceling payment intent', {
        provider: provider.name,
        payment_intent_id,
      });

      const result = await provider.cancelPaymentIntent(payment_intent_id);

      logger.info('Payment intent cancellation completed', {
        provider: provider.name,
        payment_intent_id,
        success: result.success,
      });

      return result;
    } catch (error) {
      logger.error('Failed to cancel payment intent', error as Error, {
        provider: provider.name,
        payment_intent_id,
      });
      throw error;
    }
  }

  async getPaymentIntent(payment_intent_id: string, providerName?: string): Promise<PaymentIntent> {
    const provider = this.getProvider(providerName);

    try {
      return await provider.getPaymentIntent(payment_intent_id);
    } catch (error) {
      logger.error('Failed to get payment intent', error as Error, {
        provider: provider.name,
        payment_intent_id,
      });
      throw error;
    }
  }

  // Refunds
  async createRefund(request: CreateRefundRequest, providerName?: string): Promise<RefundResult> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Creating refund', {
        provider: provider.name,
        payment_intent_id: request.payment_intent_id,
        amount: request.amount,
      });

      const result = await provider.createRefund(request);

      logger.info('Refund creation completed', {
        provider: provider.name,
        refund_id: result.refund_id,
        success: result.success,
        status: result.status,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create refund', error as Error, {
        provider: provider.name,
        request,
      });
      throw error;
    }
  }

  async getRefund(refund_id: string, providerName?: string): Promise<RefundResult> {
    const provider = this.getProvider(providerName);

    try {
      return await provider.getRefund(refund_id);
    } catch (error) {
      logger.error('Failed to get refund', error as Error, {
        provider: provider.name,
        refund_id,
      });
      throw error;
    }
  }

  // Customers
  async createCustomer(customer: PaymentCustomer, providerName?: string): Promise<PaymentCustomer> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Creating customer', {
        provider: provider.name,
        email: customer.email,
      });

      const result = await provider.createCustomer(customer);

      logger.info('Customer created successfully', {
        provider: provider.name,
        customer_id: result.id,
        email: result.email,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create customer', error as Error, {
        provider: provider.name,
        customer,
      });
      throw error;
    }
  }

  async updateCustomer(
    customer_id: string,
    updates: Partial<PaymentCustomer>,
    providerName?: string
  ): Promise<PaymentCustomer> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Updating customer', {
        provider: provider.name,
        customer_id,
        updates,
      });

      const result = await provider.updateCustomer(customer_id, updates);

      logger.info('Customer updated successfully', {
        provider: provider.name,
        customer_id,
      });

      return result;
    } catch (error) {
      logger.error('Failed to update customer', error as Error, {
        provider: provider.name,
        customer_id,
        updates,
      });
      throw error;
    }
  }

  async getCustomer(customer_id: string, providerName?: string): Promise<PaymentCustomer> {
    const provider = this.getProvider(providerName);

    try {
      return await provider.getCustomer(customer_id);
    } catch (error) {
      logger.error('Failed to get customer', error as Error, {
        provider: provider.name,
        customer_id,
      });
      throw error;
    }
  }

  async deleteCustomer(customer_id: string, providerName?: string): Promise<boolean> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Deleting customer', {
        provider: provider.name,
        customer_id,
      });

      const result = await provider.deleteCustomer(customer_id);

      logger.info('Customer deletion completed', {
        provider: provider.name,
        customer_id,
        success: result,
      });

      return result;
    } catch (error) {
      logger.error('Failed to delete customer', error as Error, {
        provider: provider.name,
        customer_id,
      });
      throw error;
    }
  }

  // Payment Methods
  async attachPaymentMethod(
    payment_method_id: string,
    customer_id: string,
    providerName?: string
  ): Promise<PaymentMethod> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Attaching payment method', {
        provider: provider.name,
        payment_method_id,
        customer_id,
      });

      const result = await provider.attachPaymentMethod(payment_method_id, customer_id);

      logger.info('Payment method attached successfully', {
        provider: provider.name,
        payment_method_id,
        customer_id,
      });

      return result;
    } catch (error) {
      logger.error('Failed to attach payment method', error as Error, {
        provider: provider.name,
        payment_method_id,
        customer_id,
      });
      throw error;
    }
  }

  async detachPaymentMethod(
    payment_method_id: string,
    providerName?: string
  ): Promise<PaymentMethod> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Detaching payment method', {
        provider: provider.name,
        payment_method_id,
      });

      const result = await provider.detachPaymentMethod(payment_method_id);

      logger.info('Payment method detached successfully', {
        provider: provider.name,
        payment_method_id,
      });

      return result;
    } catch (error) {
      logger.error('Failed to detach payment method', error as Error, {
        provider: provider.name,
        payment_method_id,
      });
      throw error;
    }
  }

  async listPaymentMethods(customer_id: string, providerName?: string): Promise<PaymentMethod[]> {
    const provider = this.getProvider(providerName);

    try {
      return await provider.listPaymentMethods(customer_id);
    } catch (error) {
      logger.error('Failed to list payment methods', error as Error, {
        provider: provider.name,
        customer_id,
      });
      throw error;
    }
  }

  // Subscriptions
  async createSubscription(
    request: CreateSubscriptionRequest,
    providerName?: string
  ): Promise<Subscription> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Creating subscription', {
        provider: provider.name,
        plan_id: request.plan_id,
        customer_email: request.customer.email,
      });

      const result = await provider.createSubscription(request);

      logger.info('Subscription created successfully', {
        provider: provider.name,
        subscription_id: result.id,
        status: result.status,
      });

      return result;
    } catch (error) {
      logger.error('Failed to create subscription', error as Error, {
        provider: provider.name,
        request,
      });
      throw error;
    }
  }

  async updateSubscription(
    subscription_id: string,
    updates: Partial<Subscription>,
    providerName?: string
  ): Promise<Subscription> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Updating subscription', {
        provider: provider.name,
        subscription_id,
        updates,
      });

      const result = await provider.updateSubscription(subscription_id, updates);

      logger.info('Subscription updated successfully', {
        provider: provider.name,
        subscription_id,
      });

      return result;
    } catch (error) {
      logger.error('Failed to update subscription', error as Error, {
        provider: provider.name,
        subscription_id,
        updates,
      });
      throw error;
    }
  }

  async cancelSubscription(subscription_id: string, providerName?: string): Promise<Subscription> {
    const provider = this.getProvider(providerName);

    try {
      logger.info('Canceling subscription', {
        provider: provider.name,
        subscription_id,
      });

      const result = await provider.cancelSubscription(subscription_id);

      logger.info('Subscription canceled successfully', {
        provider: provider.name,
        subscription_id,
        status: result.status,
      });

      return result;
    } catch (error) {
      logger.error('Failed to cancel subscription', error as Error, {
        provider: provider.name,
        subscription_id,
      });
      throw error;
    }
  }

  async getSubscription(subscription_id: string, providerName?: string): Promise<Subscription> {
    const provider = this.getProvider(providerName);

    try {
      return await provider.getSubscription(subscription_id);
    } catch (error) {
      logger.error('Failed to get subscription', error as Error, {
        provider: provider.name,
        subscription_id,
      });
      throw error;
    }
  }

  // Webhook handling
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
    providerName?: string
  ): boolean {
    const provider = this.getProvider(providerName);
    return provider.verifyWebhookSignature(payload, signature, secret);
  }

  parseWebhookEvent(payload: string, providerName?: string) {
    const provider = this.getProvider(providerName);
    return provider.parseWebhookEvent(payload);
  }

  // Utility methods
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getDefaultProvider(): string {
    return this.defaultProvider;
  }

  isProviderAvailable(providerName: string): boolean {
    return this.providers.has(providerName);
  }
}
