// User avatar upload endpoint
import { z } from 'zod';

import { logger } from '../../../lib/utils/logger';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../lib/handlers/base';
import { UserService } from '../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Avatar upload validation schema
const avatarUploadSchema = z.object({
  avatar: z.string().optional(), // Base64 encoded image or file path
  removeAvatar: z.boolean().optional(),
});

// Avatar upload handler
const avatarUploadHandler = createSingleMethodHandler(
  'POST',
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    validation: {
      body: avatarUploadSchema,
    },
  },
  async ({ body, context, auth }) => {
    try {
      const userId = auth.user!.id;

      let avatarUrl = null;

      if (body.removeAvatar) {
        // Remove avatar
        avatarUrl = null;
      } else if (body.avatar) {
        // In a real implementation, you would:
        // 1. Validate the image format and size
        // 2. Upload to cloud storage (AWS S3, Cloudinary, etc.)
        // 3. Generate optimized thumbnails
        // 4. Return the public URL

        // For now, we'll simulate this process
        avatarUrl = `https://api.example.com/avatars/${userId}-${Date.now()}.jpg`;

        logger.info('Avatar upload simulated', {
          userId,
          avatarUrl,
          requestId: context.requestId,
        });
      }

      // Update user avatar in database
      const updatedUser = await UserService.updateProfile(userId, {
        photoURL: avatarUrl ?? undefined,
      });

      return createSuccessResponse(
        {
          user: updatedUser,
          avatarUrl,
          message: body.removeAvatar
            ? 'Avatar removed successfully'
            : 'Avatar uploaded successfully',
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Avatar upload failed', error as Error, {
        userId: auth.user?.id,
        requestId: context.requestId,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Failed to upload avatar',
        },
        context.requestId
      );
    }
  }
);

export const POST = avatarUploadHandler;
