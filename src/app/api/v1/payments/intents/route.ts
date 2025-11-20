// Payment Intents API endpoint
import { z } from 'zod';
import Stripe from 'stripe';

import { createApiHandler } from '../../../lib/handlers/base';
import { commonSchemas } from '../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { PaymentService } from '../../../lib/payments/payment-service';
import { PaymentError, PaymentProviderError } from '../../../lib/payments/types';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Lazy initialize Stripe to avoid build-time errors
function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-08-27.basil',
  });
}

// Validation schemas
const createPaymentIntentSchema = z.object({
  amount: z.number().int().min(50), // Minimum 50 cents
  currency: z.string().length(3).toLowerCase(),
  customer: z
    .object({
      id: z.string().optional(),
      email: commonSchemas.email,
      name: z.string().min(1).max(100).optional(),
      phone: z.string().optional(),
      address: z
        .object({
          line1: z.string().min(1).max(200),
          line2: z.string().max(200).optional(),
          city: z.string().min(1).max(100),
          state: z.string().max(100).optional(),
          postal_code: z.string().min(1).max(20),
          country: z.string().length(2).toUpperCase(),
        })
        .optional(),
    })
    .optional(),
  payment_method_id: z.string().optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  automatic_payment_methods: z
    .object({
      enabled: z.boolean(),
    })
    .optional(),
  provider: z.enum(['stripe']).optional(),
});

const confirmPaymentIntentSchema = z.object({
  payment_method_id: z.string().optional(),
  provider: z.enum(['stripe']).optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
      // No specific permissions required - any authenticated user can create payment intents for themselves
    },
    rateLimit: rateLimitConfigs.payment,
    allowedMethods: ['GET', 'POST'],
    validation: {
      body: z.union([createPaymentIntentSchema, confirmPaymentIntentSchema]).optional(),
    },
  },
  {
    // List payment intents (for admin/user dashboard)
    GET: async ({ context, auth, query }) => {
      try {
        const paymentService = new PaymentService();

        // For now, we'll return a simple response
        // In a real implementation, you'd fetch from database
        return createSuccessResponse(
          {
            message: 'Payment intents endpoint available',
            user_id: auth.user?.id,
            available_providers: paymentService.getAvailableProviders(),
          },
          200,
          context.requestId
        );
      } catch {
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch payment intents',
          },
          context.requestId
        );
      }
    },

    // Create payment intent
    POST: async ({ body, context, auth }) => {
      try {
        // Handle checkout with priceId
        if (body.priceId && body.planTier) {
          // Map plan tiers to amounts (in cents)
          const planPrices: Record<string, { monthly: number; yearly: number }> = {
            STARTER: { monthly: 2900, yearly: 29000 },
            PROFESSIONAL: { monthly: 9900, yearly: 99000 },
            ENTERPRISE: { monthly: 29900, yearly: 299000 },
          };

          const isYearly = body.priceId.includes('yearly');
          const amount = planPrices[body.planTier]?.[isYearly ? 'yearly' : 'monthly'] || 0;

          if (amount === 0) {
            return createErrorResponse(
              'VALIDATION_ERROR',
              { message: 'Invalid plan selected' },
              context.requestId
            );
          }

          // Create Stripe payment intent
          const stripe = getStripeClient();
          const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            automatic_payment_methods: {
              enabled: true,
            },
            metadata: {
              user_id: auth.user?.id || '',
              plan_tier: body.planTier,
              price_id: body.priceId,
              billing_period: isYearly ? 'yearly' : 'monthly',
            },
          });

          return createSuccessResponse(
            {
              client_secret: paymentIntent.client_secret,
              payment_intent: {
                id: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: paymentIntent.status,
              },
              plan: {
                tier: body.planTier,
                price: amount,
                billing_period: isYearly ? 'yearly' : 'monthly',
              },
            },
            201,
            context.requestId
          );
        }

        // Handle regular payment intent creation
        const paymentService = new PaymentService();

        // Validate request body
        const validatedData = createPaymentIntentSchema.parse(body);

        // Create payment intent
        const paymentIntent = await paymentService.createPaymentIntent(
          {
            amount: validatedData.amount,
            currency: validatedData.currency,
            customer: validatedData.customer,
            payment_method_id: validatedData.payment_method_id,
            description: validatedData.description,
            metadata: {
              ...validatedData.metadata,
              user_id: auth.user?.id || '',
              created_by: 'api',
            },
            automatic_payment_methods: validatedData.automatic_payment_methods,
          },
          validatedData.provider
        );

        return createSuccessResponse(
          {
            payment_intent: paymentIntent,
            client_secret: `${paymentIntent.id}_secret_${Date.now()}`, // In real Stripe, this comes from the API
          },
          201,
          context.requestId
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          return createErrorResponse(
            'PAYMENT_ERROR',
            {
              message: error.message,
              code: error.code,
              type: error.type,
              decline_code: error.decline_code,
              payment_intent_id: error.payment_intent_id,
            },
            context.requestId
          );
        }

        if (error instanceof PaymentProviderError) {
          return createErrorResponse(
            'PAYMENT_PROVIDER_ERROR',
            {
              message: error.message,
              provider: error.provider,
            },
            context.requestId
          );
        }

        if (error instanceof z.ZodError) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid request data',
              errors: error.issues,
            },
            context.requestId
          );
        }

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to create payment intent',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
