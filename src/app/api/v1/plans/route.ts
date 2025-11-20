// Public Plans API - No authentication required
import { prisma } from '@app/database';

import { logger } from '../../lib/utils/logger';
import { createApiHandler } from '../../lib/handlers/base';
import { rateLimitConfigs } from '../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../lib/utils/response';

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: false, // Public endpoint
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET'],
  },
  {
    // Get all active public plans
    GET: async ({ context }) => {
      try {
        // Fetch only active plans with basic info
        const plans = await prisma.subscriptionPlan.findMany({
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            tier: true,
            description: true,
            pricing: true,
            features: true,
            stripePriceId: true,
            trialDays: true,
            limits: true,
          },
          orderBy: [
            // Order by tier hierarchy
            {
              tier: 'asc',
            },
          ],
        });

        logger.info('Public: Plans listed', {
          count: plans.length,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            plans,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Public: Failed to list plans', error as Error, {
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to list plans' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
