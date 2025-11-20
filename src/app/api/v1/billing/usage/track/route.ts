// Usage tracking endpoint
import { z } from 'zod';

import { UsageTrackingService } from 'src/lib/services/usage-tracking-service';

import { logger } from '../../../../lib/utils/logger';
import { createApiHandler } from '../../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

const trackUsageSchema = z.object({
  subscriptionId: z.string().min(1),
  projectId: z.string().min(1),
  metric: z.enum([
    'EXECUTIONS',
    'CPU_HOURS',
    'MEMORY_GB_HOURS',
    'STORAGE_GB',
    'NETWORK_GB',
    'USERS',
    'PROJECTS',
  ]),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['POST'],
  },
  {
    POST: async ({ body, context, auth }) => {
      try {
        const validation = trackUsageSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid usage tracking data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const usageService = new UsageTrackingService();
        await usageService.trackUsage(validation.data);

        logger.info('Usage tracked via API', {
          userId: auth.user?.id,
          ...validation.data,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            message: 'Usage tracked successfully',
          },
          201,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to track usage', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to track usage',
            details: error instanceof Error ? error.message : String(error),
          },
          context.requestId
        );
      }
    },
  }
);

export const POST = handler;
