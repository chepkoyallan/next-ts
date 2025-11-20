// User profile management endpoint
import { z } from 'zod';

import { logger } from '../../../lib/utils/logger';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../lib/handlers/base';
import { UserService } from '../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Profile update validation schema
const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  country: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  about: z.string().optional(),
  isPublic: z.boolean().optional(),
  // Social links
  socialLinks: z
    .object({
      facebook: z.string().url().optional().or(z.literal('')),
      instagram: z.string().url().optional().or(z.literal('')),
      linkedin: z.string().url().optional().or(z.literal('')),
      twitter: z.string().url().optional().or(z.literal('')),
    })
    .optional(),
  // Notification preferences
  notificationPreferences: z
    .object({
      emailNotifications: z.boolean().optional(),
      pushNotifications: z.boolean().optional(),
      smsNotifications: z.boolean().optional(),
      marketingEmails: z.boolean().optional(),
    })
    .optional(),
});

// Update user profile handler
const updateProfileHandler = createSingleMethodHandler(
  'PUT',
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    validation: {
      body: updateProfileSchema,
    },
  },
  async ({ body, context, auth }) => {
    try {
      const userId = auth.user!.id;

      // Check if email is being changed and if it's already taken
      if (body.email && body.email !== auth.user!.email) {
        const existingUser = await UserService.findByEmail(body.email);
        if (existingUser && existingUser.id !== userId) {
          return createErrorResponse(
            'RESOURCE_ALREADY_EXISTS',
            {
              message: 'Email address is already in use',
              field: 'email',
            },
            context.requestId
          );
        }
      }

      // Update user profile
      const updatedUser = await UserService.updateProfile(userId, {
        ...body,
        // Handle nested objects
        ...(body.socialLinks && { socialLinks: JSON.stringify(body.socialLinks) }),
        ...(body.notificationPreferences && {
          notificationPreferences: JSON.stringify(body.notificationPreferences),
        }),
      });

      logger.info('User profile updated', {
        userId,
        updatedFields: Object.keys(body),
        requestId: context.requestId,
      });

      return createSuccessResponse(
        {
          user: updatedUser,
          message: 'Profile updated successfully',
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Profile update failed', error as Error, {
        userId: auth.user?.id,
        requestId: context.requestId,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Failed to update profile',
        },
        context.requestId
      );
    }
  }
);

export const PUT = updateProfileHandler;
