// Payment Methods Management API
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { StripeBillingService } from '../../../lib/services/stripe-billing-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const listPaymentMethodsSchema = z.object({
  billingAccountId: z.string().min(1, 'Billing account ID is required'),
});

const attachPaymentMethodSchema = z.object({
  billingAccountId: z.string().min(1, 'Billing account ID is required'),
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

const createSetupIntentSchema = z.object({
  billingAccountId: z.string().min(1, 'Billing account ID is required'),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'POST'],
  },
  {
    // List payment methods for billing account
    GET: async ({ request, context, auth }) => {
      try {
        // Extract query parameters from URL
        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());

        const validation = listPaymentMethodsSchema.safeParse(queryParams);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid query parameters',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const { billingAccountId } = validation.data;

        // Check permissions
        const billingAccount = await prisma.billingAccount.findUnique({
          where: { id: billingAccountId },
        });

        if (!billingAccount) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Billing account not found' },
            context.requestId
          );
        }

        const userId = auth.user?.id || '';
        const isMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: billingAccount.organizationId,
            isActive: true,
          },
        });

        if (!isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'Access denied to billing account' },
            context.requestId
          );
        }

        // List payment methods
        const stripeBillingService = new StripeBillingService();
        const paymentMethods = await stripeBillingService.listPaymentMethods(billingAccountId);

        logger.info('Payment methods listed', {
          billingAccountId,
          count: paymentMethods.length,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            paymentMethods,
            billingAccountId,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to list payment methods', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to list payment methods' },
          context.requestId
        );
      }
    },

    // Attach payment method or create setup intent
    POST: async ({ body, context, auth }) => {
      try {
        // Check if this is a setup intent request or attach payment method request
        if (body.action === 'create_setup_intent') {
          const validation = createSetupIntentSchema.safeParse(body);
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

          const { billingAccountId } = validation.data;

          // Check permissions
          const billingAccount = await prisma.billingAccount.findUnique({
            where: { id: billingAccountId },
          });

          if (!billingAccount) {
            return createErrorResponse(
              'RESOURCE_NOT_FOUND',
              { message: 'Billing account not found' },
              context.requestId
            );
          }

          const userId = auth.user?.id || '';
          const isMember = await prisma.organizationMember.findFirst({
            where: {
              userId,
              organizationId: billingAccount.organizationId,
              isActive: true,
            },
          });

          if (!isMember) {
            return createErrorResponse(
              'FORBIDDEN',
              { message: 'Access denied to billing account' },
              context.requestId
            );
          }

          // Create setup intent
          const stripeBillingService = new StripeBillingService();
          const { clientSecret } = await stripeBillingService.createSetupIntent(billingAccountId);

          logger.info('Setup intent created', {
            billingAccountId,
            userId: auth.user?.id,
            requestId: context.requestId,
          });

          return createSuccessResponse(
            {
              clientSecret,
              billingAccountId,
            },
            201,
            context.requestId
          );
        }

        // Attach payment method
        const validation = attachPaymentMethodSchema.safeParse(body);
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

        const { billingAccountId, paymentMethodId } = validation.data;

        // Check permissions
        const billingAccount = await prisma.billingAccount.findUnique({
          where: { id: billingAccountId },
        });

        if (!billingAccount) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Billing account not found' },
            context.requestId
          );
        }

        const userId = auth.user?.id || '';
        const isMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: billingAccount.organizationId,
            isActive: true,
          },
        });

        if (!isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'Access denied to billing account' },
            context.requestId
          );
        }

        // Attach payment method
        const stripeBillingService = new StripeBillingService();
        const paymentMethod = await stripeBillingService.attachPaymentMethod(
          billingAccountId,
          paymentMethodId
        );

        logger.info('Payment method attached', {
          billingAccountId,
          paymentMethodId,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            paymentMethod,
            billingAccountId,
          },
          201,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to process payment method request', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to process payment method request' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
