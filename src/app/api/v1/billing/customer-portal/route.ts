// Stripe Customer Portal API
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { StripeBillingService } from '../../../lib/services/stripe-billing-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schema
const createPortalSessionSchema = z.object({
  billingAccountId: z.string().min(1, 'Billing account ID is required'),
  returnUrl: z.string().url('Valid return URL is required'),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['POST'],
  },
  {
    // Create customer portal session
    POST: async ({ body, context, auth }) => {
      let billingAccountId: string | undefined;

      try {
        const validation = createPortalSessionSchema.safeParse(body);
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

        const { billingAccountId: accountId, returnUrl } = validation.data;
        billingAccountId = accountId;

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

        // Create customer portal session
        const stripeBillingService = new StripeBillingService();
        const portalUrl = await stripeBillingService.createCustomerPortalSession(
          billingAccountId,
          returnUrl
        );

        logger.info('Customer portal session created', {
          billingAccountId,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            url: portalUrl,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to create customer portal session', error as Error, {
          userId: auth.user?.id,
          billingAccountId,
          requestId: context.requestId,
        });

        // Provide more specific error message
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create customer portal session';

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: errorMessage,
            details: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
          },
          context.requestId
        );
      }
    },
  }
);

export const POST = handler;
