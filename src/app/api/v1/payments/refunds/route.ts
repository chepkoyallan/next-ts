// Payment Refunds API endpoint
import { z } from 'zod';

import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { PaymentService } from '../../../lib/payments/payment-service';
import { PaymentError, PaymentProviderError } from '../../../lib/payments/types';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const createRefundSchema = z.object({
  payment_intent_id: z.string().min(1),
  amount: z.number().int().min(1).optional(), // If not provided, refunds full amount
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  provider: z.enum(['stripe']).optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
      permissions: ['payments:refund', 'payments:read'],
    },
    rateLimit: rateLimitConfigs.payment,
    allowedMethods: ['GET', 'POST'],
    validation: {
      body: createRefundSchema.optional(),
    },
  },
  {
    // List refunds (for admin dashboard)
    GET: async ({ context, auth, query }) => {
      try {
        const paymentService = new PaymentService();

        // Check if user has admin permissions for listing all refunds
        const isAdmin =
          auth.user?.roles?.includes('admin') ||
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('finance');

        if (!isAdmin) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'Insufficient permissions to list refunds',
              required_roles: ['admin', 'system-admin', 'finance'],
            },
            context.requestId
          );
        }

        // For now, return a simple response
        // In a real implementation, you'd fetch from database with pagination
        return createSuccessResponse(
          {
            message: 'Refunds endpoint available',
            user_id: auth.user?.id,
            available_providers: paymentService.getAvailableProviders(),
            // refunds: await refundService.list({ page, limit, filters })
          },
          200,
          context.requestId
        );
      } catch {
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch refunds',
          },
          context.requestId
        );
      }
    },

    // Create refund
    POST: async ({ body, context, auth }) => {
      try {
        const paymentService = new PaymentService();

        // Validate request body
        const validatedData = createRefundSchema.parse(body);

        // Check if user has permission to create refunds
        const canRefund =
          auth.user?.roles?.includes('admin') ||
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('finance') ||
          auth.user?.roles?.includes('customer-service');

        if (!canRefund) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'Insufficient permissions to create refunds',
              required_roles: ['admin', 'system-admin', 'finance', 'customer-service'],
            },
            context.requestId
          );
        }

        // First, get the payment intent to verify it exists and check ownership if needed
        try {
          const paymentIntent = await paymentService.getPaymentIntent(
            validatedData.payment_intent_id,
            validatedData.provider
          );

          // Additional access control: non-admin users can only refund their own payments
          const isAdmin =
            auth.user?.roles?.includes('admin') || auth.user?.roles?.includes('system-admin');

          if (!isAdmin && paymentIntent.metadata?.user_id !== auth.user?.id) {
            return createErrorResponse(
              'FORBIDDEN',
              {
                message: 'You can only refund your own payments',
              },
              context.requestId
            );
          }
        } catch (error) {
          if (error instanceof PaymentError) {
            return createErrorResponse(
              'PAYMENT_ERROR',
              {
                message: 'Payment intent not found or invalid',
                code: error.code,
              },
              context.requestId
            );
          }
          throw error;
        }

        // Create refund
        const refund = await paymentService.createRefund(
          {
            payment_intent_id: validatedData.payment_intent_id,
            amount: validatedData.amount,
            reason: validatedData.reason,
            metadata: {
              ...validatedData.metadata,
              refunded_by: auth.user?.id || '',
              refund_reason: validatedData.reason || 'requested_by_customer',
              created_via: 'api',
            },
          },
          validatedData.provider
        );

        return createSuccessResponse(
          {
            refund,
            message: refund.success ? 'Refund created successfully' : 'Refund creation failed',
          },
          refund.success ? 201 : 400,
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
            message: 'Failed to create refund',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
