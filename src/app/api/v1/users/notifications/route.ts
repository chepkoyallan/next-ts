// User notification preferences endpoint
import { z } from 'zod';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { UserService } from '../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Notification preferences validation schema
const notificationPreferencesSchema = z.object({
  selected: z.array(z.string()).default([]),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
  // Activity notifications
  activity_comments: z.boolean().optional(),
  activity_answers: z.boolean().optional(),
  activityFollows: z.boolean().optional(),
  // Application notifications
  application_news: z.boolean().optional(),
  application_product: z.boolean().optional(),
  application_blog: z.boolean().optional(),
});

// Notification preferences handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'PUT'],
  },
  {
    // Get notification preferences
    GET: async ({ context, auth }) => {
      try {
        const userId = auth.user!.id;

        // Get user's notification preferences
        const user = await UserService.findById(userId);
        if (!user) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              message: 'User not found',
            },
            context.requestId
          );
        }

        // Parse notification preferences from user data
        const preferences = user.notificationPreferences
          ? JSON.parse(user.notificationPreferences as string)
          : {
              selected: ['activity_comments', 'application_product'],
              emailNotifications: true,
              pushNotifications: true,
              smsNotifications: false,
              marketingEmails: false,
            };

        return createSuccessResponse(
          {
            preferences,
            message: 'Notification preferences retrieved successfully',
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to get notification preferences', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to retrieve notification preferences',
          },
          context.requestId
        );
      }
    },

    // Update notification preferences
    PUT: async ({ body, context, auth }) => {
      try {
        const validation = notificationPreferencesSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid notification preferences data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const userId = auth.user!.id;
        const preferences = validation.data;

        // Update user's notification preferences
        const updatedUser = await UserService.updateProfile(userId, {
          notificationPreferences: JSON.stringify(preferences),
        });

        logger.info('Notification preferences updated', {
          userId,
          preferences: Object.keys(preferences),
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            user: updatedUser,
            preferences,
            message: 'Notification preferences updated successfully',
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to update notification preferences', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to update notification preferences',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const PUT = handler;
