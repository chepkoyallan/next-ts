// Payment System Types and Interfaces
export interface PaymentAmount {
  amount: number; // Amount in smallest currency unit (e.g., cents for USD)
  currency: string; // ISO 4217 currency code (e.g., 'usd', 'eur')
}

export interface PaymentCustomer {
  id?: string; // Provider customer ID
  email: string;
  name?: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
  };
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'digital_wallet' | 'crypto';
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  fingerprint?: string;
  funding?: 'credit' | 'debit' | 'prepaid' | 'unknown';
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  customer_id?: string;
  payment_method_id?: string;
  description?: string;
  metadata?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentResult {
  success: boolean;
  payment_intent_id: string;
  status: PaymentStatus;
  amount?: number;
  currency?: string;
  error?: string;
  provider_response?: any;
}

export interface RefundResult {
  success: boolean;
  refund_id: string;
  amount: number;
  currency: string;
  status: RefundStatus;
  error?: string;
  provider_response?: any;
}

export interface Subscription {
  id: string;
  customer_id: string;
  status: SubscriptionStatus;
  current_period_start: Date;
  current_period_end: Date;
  plan_id: string;
  quantity: number;
  metadata?: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
  trial_period_days?: number;
  metadata?: Record<string, string>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  created: Date;
  livemode: boolean;
  pending_webhooks: number;
  request?: {
    id: string;
    idempotency_key?: string;
  };
}

export type PaymentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded'
  | 'failed';

export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

export type SubscriptionStatus =
  | 'incomplete'
  | 'incomplete_expired'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'paused';

export interface PaymentProviderConfig {
  name: string;
  apiKey: string;
  secretKey: string;
  webhookSecret?: string;
  environment: 'sandbox' | 'production';
  currency: string;
  supportedPaymentMethods: string[];
}

export interface CreatePaymentIntentRequest {
  amount: number;
  currency: string;
  customer?: PaymentCustomer;
  payment_method_id?: string;
  description?: string;
  metadata?: Record<string, string>;
  automatic_payment_methods?: {
    enabled: boolean;
  };
}

export interface CreateSubscriptionRequest {
  customer: PaymentCustomer;
  plan_id: string;
  quantity?: number;
  trial_period_days?: number;
  metadata?: Record<string, string>;
}

export interface CreateRefundRequest {
  payment_intent_id: string;
  amount?: number; // If not provided, refunds the full amount
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

// Payment provider interface that all providers must implement
export interface PaymentProvider {
  name: string;

  // Payment Intents
  createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent>;
  confirmPaymentIntent(
    payment_intent_id: string,
    payment_method_id?: string
  ): Promise<PaymentResult>;
  cancelPaymentIntent(payment_intent_id: string): Promise<PaymentResult>;
  getPaymentIntent(payment_intent_id: string): Promise<PaymentIntent>;

  // Refunds
  createRefund(request: CreateRefundRequest): Promise<RefundResult>;
  getRefund(refund_id: string): Promise<RefundResult>;

  // Customers
  createCustomer(customer: PaymentCustomer): Promise<PaymentCustomer>;
  updateCustomer(customer_id: string, updates: Partial<PaymentCustomer>): Promise<PaymentCustomer>;
  getCustomer(customer_id: string): Promise<PaymentCustomer>;
  deleteCustomer(customer_id: string): Promise<boolean>;

  // Payment Methods
  attachPaymentMethod(payment_method_id: string, customer_id: string): Promise<PaymentMethod>;
  detachPaymentMethod(payment_method_id: string): Promise<PaymentMethod>;
  listPaymentMethods(customer_id: string): Promise<PaymentMethod[]>;

  // Subscriptions
  createSubscription(request: CreateSubscriptionRequest): Promise<Subscription>;
  updateSubscription(
    subscription_id: string,
    updates: Partial<Subscription>
  ): Promise<Subscription>;
  cancelSubscription(subscription_id: string): Promise<Subscription>;
  getSubscription(subscription_id: string): Promise<Subscription>;

  // Webhook handling
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  parseWebhookEvent(payload: string): WebhookEvent;
}

// Import error types from separate files
export { PaymentError } from './errors';
export { PaymentProviderError } from './provider-errors';
