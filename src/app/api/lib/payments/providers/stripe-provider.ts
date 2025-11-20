// Stripe Payment Provider Implementation
import Stripe from 'stripe';

import { logger } from '../../utils/logger';
import {
  RefundResult,
  Subscription,
  WebhookEvent,
  PaymentError,
  PaymentIntent,
  PaymentResult,
  PaymentMethod,
  PaymentProvider,
  PaymentCustomer,
  CreateRefundRequest,
  PaymentProviderError,
  CreateSubscriptionRequest,
  CreatePaymentIntentRequest,
} from '../types';

export class StripePaymentProvider implements PaymentProvider {
  name = 'stripe';

  private stripe: Stripe;

  constructor(
    private apiKey: string,
    private webhookSecret: string,
    private environment: 'sandbox' | 'production' = 'sandbox'
  ) {
    if (!apiKey) {
      throw new Error('Stripe API key is required');
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: '2025-08-27.basil',
      typescript: true,
    });

    logger.info('Stripe payment provider initialized', {
      environment: this.environment,
      apiVersion: '2025-08-27.basil',
    });
  }

  // Payment Intents
  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    try {
      const params: Stripe.PaymentIntentCreateParams = {
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        metadata: request.metadata || {},
      };

      // Handle customer
      if (request.customer) {
        if (request.customer.id) {
          params.customer = request.customer.id;
        } else {
          const customer = await this.createCustomer(request.customer);
          params.customer = customer.id!;
        }
      }

      // Handle payment method
      if (request.payment_method_id) {
        params.payment_method = request.payment_method_id;
        params.confirmation_method = 'manual';
        params.confirm = true;
      }

      // Handle automatic payment methods
      if (request.automatic_payment_methods?.enabled) {
        params.automatic_payment_methods = {
          enabled: true,
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create(params);

      return StripePaymentProvider.mapStripePaymentIntent(paymentIntent);
    } catch (error) {
      logger.error('Failed to create payment intent', error as Error);
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  async confirmPaymentIntent(
    payment_intent_id: string,
    payment_method_id?: string
  ): Promise<PaymentResult> {
    try {
      const params: Stripe.PaymentIntentConfirmParams = {};

      if (payment_method_id) {
        params.payment_method = payment_method_id;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(payment_intent_id, params);

      return {
        success: paymentIntent.status === 'succeeded',
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status as any,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        provider_response: paymentIntent,
      };
    } catch (error) {
      logger.error('Failed to confirm payment intent', error as Error, { payment_intent_id });
      const paymentError = StripePaymentProvider.handleStripeError(error);
      return {
        success: false,
        payment_intent_id,
        status: 'failed',
        error: paymentError.message,
        provider_response: error,
      };
    }
  }

  async cancelPaymentIntent(payment_intent_id: string): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(payment_intent_id);

      return {
        success: paymentIntent.status === 'canceled',
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status as any,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        provider_response: paymentIntent,
      };
    } catch (error) {
      logger.error('Failed to cancel payment intent', error as Error, { payment_intent_id });
      const paymentError = StripePaymentProvider.handleStripeError(error);
      return {
        success: false,
        payment_intent_id,
        status: 'failed',
        error: paymentError.message,
        provider_response: error,
      };
    }
  }

  async getPaymentIntent(payment_intent_id: string): Promise<PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(payment_intent_id);
      return StripePaymentProvider.mapStripePaymentIntent(paymentIntent);
    } catch (error) {
      logger.error('Failed to get payment intent', error as Error, { payment_intent_id });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  // Refunds
  async createRefund(request: CreateRefundRequest): Promise<RefundResult> {
    try {
      const params: Stripe.RefundCreateParams = {
        payment_intent: request.payment_intent_id,
        metadata: request.metadata || {},
      };

      if (request.amount) {
        params.amount = request.amount;
      }

      if (request.reason) {
        params.reason = request.reason;
      }

      const refund = await this.stripe.refunds.create(params);

      return {
        success: refund.status === 'succeeded',
        refund_id: refund.id,
        amount: refund.amount,
        currency: refund.currency!,
        status: refund.status as any,
        provider_response: refund,
      };
    } catch (error) {
      logger.error('Failed to create refund', error as Error, request);
      const paymentError = StripePaymentProvider.handleStripeError(error);
      return {
        success: false,
        refund_id: '',
        amount: request.amount || 0,
        currency: '',
        status: 'failed',
        error: paymentError.message,
        provider_response: error,
      };
    }
  }

  async getRefund(refund_id: string): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.retrieve(refund_id);

      return {
        success: refund.status === 'succeeded',
        refund_id: refund.id,
        amount: refund.amount,
        currency: refund.currency!,
        status: refund.status as any,
        provider_response: refund,
      };
    } catch (error) {
      logger.error('Failed to get refund', error as Error, { refund_id });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  // Customers
  async createCustomer(customer: PaymentCustomer): Promise<PaymentCustomer> {
    try {
      const params: Stripe.CustomerCreateParams = {
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
      };

      if (customer.address) {
        params.address = {
          line1: customer.address.line1,
          line2: customer.address.line2,
          city: customer.address.city,
          state: customer.address.state,
          postal_code: customer.address.postal_code,
          country: customer.address.country,
        };
      }

      const stripeCustomer = await this.stripe.customers.create(params);

      return {
        id: stripeCustomer.id,
        email: stripeCustomer.email!,
        name: stripeCustomer.name || undefined,
        phone: stripeCustomer.phone || undefined,
        address: stripeCustomer.address
          ? {
              line1: stripeCustomer.address.line1!,
              line2: stripeCustomer.address.line2 || undefined,
              city: stripeCustomer.address.city!,
              state: stripeCustomer.address.state || undefined,
              postal_code: stripeCustomer.address.postal_code!,
              country: stripeCustomer.address.country!,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to create customer', error as Error, customer);
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  async updateCustomer(
    customer_id: string,
    updates: Partial<PaymentCustomer>
  ): Promise<PaymentCustomer> {
    try {
      const params: Stripe.CustomerUpdateParams = {};

      if (updates.email) params.email = updates.email;
      if (updates.name) params.name = updates.name;
      if (updates.phone) params.phone = updates.phone;

      if (updates.address) {
        params.address = {
          line1: updates.address.line1,
          line2: updates.address.line2,
          city: updates.address.city,
          state: updates.address.state,
          postal_code: updates.address.postal_code,
          country: updates.address.country,
        };
      }

      const stripeCustomer = await this.stripe.customers.update(customer_id, params);

      return {
        id: stripeCustomer.id,
        email: stripeCustomer.email!,
        name: stripeCustomer.name || undefined,
        phone: stripeCustomer.phone || undefined,
        address: stripeCustomer.address
          ? {
              line1: stripeCustomer.address.line1!,
              line2: stripeCustomer.address.line2 || undefined,
              city: stripeCustomer.address.city!,
              state: stripeCustomer.address.state || undefined,
              postal_code: stripeCustomer.address.postal_code!,
              country: stripeCustomer.address.country!,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to update customer', error as Error, { customer_id, updates });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  async getCustomer(customer_id: string): Promise<PaymentCustomer> {
    try {
      const stripeCustomer = await this.stripe.customers.retrieve(customer_id);

      if (stripeCustomer.deleted) {
        throw new PaymentError(
          'Customer has been deleted',
          'customer_deleted',
          'invalid_request_error'
        );
      }

      return {
        id: stripeCustomer.id,
        email: stripeCustomer.email!,
        name: stripeCustomer.name || undefined,
        phone: stripeCustomer.phone || undefined,
        address: stripeCustomer.address
          ? {
              line1: stripeCustomer.address.line1!,
              line2: stripeCustomer.address.line2 || undefined,
              city: stripeCustomer.address.city!,
              state: stripeCustomer.address.state || undefined,
              postal_code: stripeCustomer.address.postal_code!,
              country: stripeCustomer.address.country!,
            }
          : undefined,
      };
    } catch (error) {
      logger.error('Failed to get customer', error as Error, { customer_id });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  async deleteCustomer(customer_id: string): Promise<boolean> {
    try {
      const result = await this.stripe.customers.del(customer_id);
      return result.deleted || false;
    } catch (error) {
      logger.error('Failed to delete customer', error as Error, { customer_id });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  // Payment Methods
  async attachPaymentMethod(
    payment_method_id: string,
    customer_id: string
  ): Promise<PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(payment_method_id, {
        customer: customer_id,
      });

      return StripePaymentProvider.mapStripePaymentMethod(paymentMethod);
    } catch (error) {
      logger.error('Failed to attach payment method', error as Error, {
        payment_method_id,
        customer_id,
      });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  async detachPaymentMethod(payment_method_id: string): Promise<PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(payment_method_id);
      return StripePaymentProvider.mapStripePaymentMethod(paymentMethod);
    } catch (error) {
      logger.error('Failed to detach payment method', error as Error, { payment_method_id });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  async listPaymentMethods(customer_id: string): Promise<PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customer_id,
        type: 'card',
      });

      return paymentMethods.data.map((pm) => StripePaymentProvider.mapStripePaymentMethod(pm));
    } catch (error) {
      logger.error('Failed to list payment methods', error as Error, { customer_id });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  // Subscriptions
  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    try {
      // Create customer if needed
      let customerId = request.customer.id;
      if (!customerId) {
        const customer = await this.createCustomer(request.customer);
        customerId = customer.id!;
      }

      const params: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [
          {
            price: request.plan_id,
            quantity: request.quantity || 1,
          },
        ],
        metadata: request.metadata || {},
      };

      if (request.trial_period_days) {
        params.trial_period_days = request.trial_period_days;
      }

      const subscription = await this.stripe.subscriptions.create(params);

      return StripePaymentProvider.mapStripeSubscription(subscription);
    } catch (error) {
      logger.error('Failed to create subscription', error as Error, request);
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  async updateSubscription(
    subscription_id: string,
    updates: Partial<Subscription>
  ): Promise<Subscription> {
    try {
      const params: Stripe.SubscriptionUpdateParams = {};

      if (updates.metadata) {
        params.metadata = updates.metadata;
      }

      const subscription = await this.stripe.subscriptions.update(subscription_id, params);

      return StripePaymentProvider.mapStripeSubscription(subscription);
    } catch (error) {
      logger.error('Failed to update subscription', error as Error, { subscription_id, updates });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  async cancelSubscription(subscription_id: string): Promise<Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.cancel(subscription_id);
      return StripePaymentProvider.mapStripeSubscription(subscription);
    } catch (error) {
      logger.error('Failed to cancel subscription', error as Error, { subscription_id });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  async getSubscription(subscription_id: string): Promise<Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscription_id);
      return StripePaymentProvider.mapStripeSubscription(subscription);
    } catch (error) {
      logger.error('Failed to get subscription', error as Error, { subscription_id });
      throw StripePaymentProvider.handleStripeError(error);
    }
  }

  // Webhook handling
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(payload, signature, secret);
      return true;
    } catch (error) {
      logger.warn('Webhook signature verification failed', { error: (error as Error).message });
      return false;
    }
  }

  parseWebhookEvent(payload: string): WebhookEvent {
    try {
      const event = JSON.parse(payload);

      // Log webhook event for debugging (using instance context)
      if (this.environment === 'sandbox') {
        logger.debug('Parsing webhook event', { eventId: event.id });
      }

      return {
        id: event.id,
        type: event.type,
        data: event.data,
        created: new Date(event.created * 1000),
        livemode: event.livemode,
        pending_webhooks: event.pending_webhooks,
        request: event.request,
      };
    } catch (error) {
      logger.error('Failed to parse webhook event', error as Error);
      throw new PaymentProviderError('Invalid webhook payload', 'stripe', error);
    }
  }

  // Helper methods
  private static mapStripePaymentIntent(paymentIntent: Stripe.PaymentIntent): PaymentIntent {
    return {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: paymentIntent.status as any,
      customer_id:
        typeof paymentIntent.customer === 'string'
          ? paymentIntent.customer
          : paymentIntent.customer?.id,
      payment_method_id:
        typeof paymentIntent.payment_method === 'string'
          ? paymentIntent.payment_method
          : paymentIntent.payment_method?.id,
      description: paymentIntent.description || undefined,
      metadata: paymentIntent.metadata,
      created_at: new Date(paymentIntent.created * 1000),
      updated_at: new Date(paymentIntent.created * 1000),
    };
  }

  private static mapStripePaymentMethod(paymentMethod: Stripe.PaymentMethod): PaymentMethod {
    return {
      id: paymentMethod.id,
      type: paymentMethod.type === 'card' ? 'card' : 'digital_wallet',
      last4: paymentMethod.card?.last4,
      brand: paymentMethod.card?.brand,
      exp_month: paymentMethod.card?.exp_month,
      exp_year: paymentMethod.card?.exp_year,
      fingerprint: paymentMethod.card?.fingerprint || undefined,
      funding: paymentMethod.card?.funding as any,
    };
  }

  private static mapStripeSubscription(subscription: Stripe.Subscription): Subscription {
    const result: Subscription = {
      id: subscription.id,
      customer_id:
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id,
      status: subscription.status as any,
      current_period_start: new Date((subscription as any).current_period_start * 1000),
      current_period_end: new Date((subscription as any).current_period_end * 1000),
      plan_id: subscription.items.data[0]?.price?.id || '',
      quantity: subscription.items.data[0]?.quantity || 1,
      metadata: subscription.metadata,
      created_at: new Date(subscription.created * 1000),
      updated_at: new Date(subscription.created * 1000),
    };
    return result;
  }

  private static handleStripeError(error: any): PaymentError {
    if (error.type === 'StripeCardError') {
      return new PaymentError(
        error.message,
        error.code,
        'card_error',
        error.decline_code,
        error.payment_intent?.id
      );
    }

    if (error.type === 'StripeInvalidRequestError') {
      return new PaymentError(
        error.message,
        error.code || 'invalid_request',
        'invalid_request_error'
      );
    }

    if (error.type === 'StripeAPIError') {
      return new PaymentError(error.message, error.code || 'api_error', 'api_error');
    }

    if (error.type === 'StripeAuthenticationError') {
      return new PaymentError(
        error.message,
        error.code || 'authentication_error',
        'authentication_error'
      );
    }

    if (error.type === 'StripeRateLimitError') {
      return new PaymentError(error.message, error.code || 'rate_limit', 'rate_limit_error');
    }

    // Generic error
    return new PaymentError(
      error.message || 'An unknown payment error occurred',
      error.code || 'unknown_error',
      'api_error'
    );
  }
}
