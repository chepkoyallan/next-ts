// Subscription usage endpoint
import { prisma } from '@app/database';
import { UsageTrackingService } from 'src/lib/services/usage-tracking-service';

import { logger } from '../../../../../lib/utils/logger';
import { createApiHandler } from '../../../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../../../lib/utils/response';

const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET'],
  },
  {
    GET: async ({ context, auth, params }) => {
      try {
        const subscriptionId = params?.id;

        if (!subscriptionId) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Subscription ID is required' },
            context.requestId
          );
        }

        const userId = auth.user?.id;
        if (!userId) {
          return createErrorResponse(
            'UNAUTHORIZED',
            { message: 'User not authenticated' },
            context.requestId
          );
        }

        // Find subscription and verify access
        const subscription = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
          include: {
            billingAccount: {
              include: {
                organization: {
                  include: {
                    members: {
                      where: { userId, isActive: true },
                    },
                  },
                },
              },
            },
            plan: true,
          },
        });

        if (!subscription) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Subscription not found' },
            context.requestId
          );
        }

        // Check if user has access
        if (subscription.billingAccount.organization.members.length === 0) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'You do not have access to this subscription' },
            context.requestId
          );
        }

        // Get usage summary
        const usageService = new UsageTrackingService();
        const summary = await usageService.getUsageSummary(subscriptionId);

        logger.info('Subscription usage retrieved', {
          subscriptionId,
          userId,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            subscription: {
              id: subscription.id,
              plan: subscription.plan.name,
              tier: subscription.plan.tier,
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
            },
            usage: summary,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to get subscription usage', error as Error, {
          userId: auth.user?.id,
          subscriptionId: params?.id,
          error: error instanceof Error ? error.message : String(error),
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to get subscription usage',
            details: error instanceof Error ? error.message : String(error),
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
