// Individual Payment Intent API endpoint
import { z } from 'zod';

import { createApiHandler } from '../../../../lib/handlers/base';
import { commonSchemas } from '../../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { PaymentService } from '../../../../lib/payments/payment-service';
import { PaymentError, PaymentProviderError } from '../../../../lib/payments/types';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Validation schemas
const paramsSchema = z.object({
  id: commonSchemas.id,
});

const confirmPaymentIntentSchema = z.object({
  payment_method_id: z.string().optional(),
  provider: z.enum(['stripe']).optional(),
});

const cancelPaymentIntentSchema = z.object({
  provider: z.enum(['stripe']).optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
      permissions: ['payments:read', 'payments:write'],
    },
    rateLimit: rateLimitConfigs.payment,
    allowedMethods: ['GET', 'POST', 'DELETE'],
    validation: {
      params: paramsSchema,
      body: z.union([confirmPaymentIntentSchema, cancelPaymentIntentSchema]).optional(),
    },
  },
  {
    // Get payment intent
    GET: async ({ routeParams, context, auth }) => {
      try {
        const paymentService = new PaymentService();

        const paymentIntent = await paymentService.getPaymentIntent(routeParams.id);

        // Basic access control - users can only see their own payment intents
        // In a real app, you'd check against database records
        const isAdmin =
          auth.user?.roles?.includes('admin') || auth.user?.roles?.includes('system-admin');
        if (!isAdmin && paymentIntent.metadata?.user_id !== auth.user?.id) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You can only access your own payment intents',
            },
            context.requestId
          );
        }

        return createSuccessResponse(paymentIntent, 200, context.requestId);
      } catch (error) {
        if (error instanceof PaymentError) {
          return createErrorResponse(
            'PAYMENT_ERROR',
            {
              message: error.message,
              code: error.code,
              type: error.type,
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

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch payment intent',
          },
          context.requestId
        );
      }
    },

    // Confirm payment intent
    POST: async ({ routeParams, body, context, auth }) => {
      try {
        const paymentService = new PaymentService();

        // Validate request body
        const validatedData = confirmPaymentIntentSchema.parse(body);

        // First, get the payment intent to check ownership
        const paymentIntent = await paymentService.getPaymentIntent(routeParams.id);

        // Basic access control
        const isAdmin =
          auth.user?.roles?.includes('admin') || auth.user?.roles?.includes('system-admin');
        if (!isAdmin && paymentIntent.metadata?.user_id !== auth.user?.id) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You can only confirm your own payment intents',
            },
            context.requestId
          );
        }

        // Confirm payment intent
        const result = await paymentService.confirmPaymentIntent(
          routeParams.id,
          validatedData.payment_method_id,
          validatedData.provider
        );

        return createSuccessResponse(result, 200, context.requestId);
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
            message: 'Failed to confirm payment intent',
          },
          context.requestId
        );
      }
    },

    // Cancel payment intent
    DELETE: async ({ routeParams, body, context, auth }) => {
      try {
        const paymentService = new PaymentService();

        // Validate request body
        const validatedData = cancelPaymentIntentSchema.parse(body || {});

        // First, get the payment intent to check ownership
        const paymentIntent = await paymentService.getPaymentIntent(routeParams.id);

        // Basic access control
        const isAdmin =
          auth.user?.roles?.includes('admin') || auth.user?.roles?.includes('system-admin');
        if (!isAdmin && paymentIntent.metadata?.user_id !== auth.user?.id) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You can only cancel your own payment intents',
            },
            context.requestId
          );
        }

        // Cancel payment intent
        const result = await paymentService.cancelPaymentIntent(
          routeParams.id,
          validatedData.provider
        );

        return createSuccessResponse(result, 200, context.requestId);
      } catch (error) {
        if (error instanceof PaymentError) {
          return createErrorResponse(
            'PAYMENT_ERROR',
            {
              message: error.message,
              code: error.code,
              type: error.type,
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
            message: 'Failed to cancel payment intent',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
