// Individual Refund API endpoint
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

const querySchema = z.object({
  provider: z.enum(['stripe']).optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
      permissions: ['payments:read'],
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET'],
    validation: {
      params: paramsSchema,
      query: querySchema,
    },
  },
  {
    // Get refund details
    GET: async ({ routeParams, query, context, auth }) => {
      try {
        const paymentService = new PaymentService();

        // Check if user has permission to view refunds
        const canViewRefunds =
          auth.user?.roles?.includes('admin') ||
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('finance') ||
          auth.user?.roles?.includes('customer-service');

        if (!canViewRefunds) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'Insufficient permissions to view refunds',
              required_roles: ['admin', 'system-admin', 'finance', 'customer-service'],
            },
            context.requestId
          );
        }

        const refund = await paymentService.getRefund(routeParams.id, query.provider);

        // Additional access control for non-admin users
        const isAdmin =
          auth.user?.roles?.includes('admin') || auth.user?.roles?.includes('system-admin');

        if (!isAdmin) {
          // For non-admin users, we need to check if they have access to this refund
          // This would typically involve checking the associated payment intent's ownership
          // For now, we'll allow finance and customer-service roles to view all refunds
          const hasFinanceAccess =
            auth.user?.roles?.includes('finance') || auth.user?.roles?.includes('customer-service');

          if (!hasFinanceAccess) {
            return createErrorResponse(
              'FORBIDDEN',
              {
                message: 'You can only view refunds you have permission to access',
              },
              context.requestId
            );
          }
        }

        return createSuccessResponse(
          {
            refund,
            metadata: {
              can_view_details: true,
              user_permissions: auth.user?.roles || [],
            },
          },
          200,
          context.requestId
        );
      } catch (error) {
        if (error instanceof PaymentError) {
          if (error.code === 'resource_missing' || error.message.includes('not found')) {
            return createErrorResponse(
              'RESOURCE_NOT_FOUND',
              {
                resource: 'refund',
                id: routeParams.id,
                message: 'Refund not found',
              },
              context.requestId
            );
          }

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
              message: 'Invalid request parameters',
              errors: error.issues,
            },
            context.requestId
          );
        }

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch refund details',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
