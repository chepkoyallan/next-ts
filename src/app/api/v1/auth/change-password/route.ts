// Change password endpoint for authenticated users
import { z } from 'zod';

import { logger } from '../../../lib/utils/logger';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../lib/handlers/base';
import { UserService } from '../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Change password validation schema
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "New passwords don't match",
    path: ['confirmNewPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from current password',
    path: ['newPassword'],
  });

// Change password handler
const changePasswordHandler = createSingleMethodHandler(
  'POST',
  {
    auth: {
      required: true,
      permissions: [],
    },
    rateLimit: rateLimitConfigs.strict,
    validation: {
      body: changePasswordSchema,
    },
  },
  async ({ body, context, auth }) => {
    const { currentPassword, newPassword, confirmNewPassword } = body;

    try {
      // Verify current password
      const isValidPassword = await UserService.verifyPassword(auth.user!.email, currentPassword);
      if (!isValidPassword) {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Current password is incorrect',
            field: 'currentPassword',
          },
          context.requestId
        );
      }

      // Validate password confirmation
      if (newPassword !== confirmNewPassword) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          {
            message: 'New password and confirmation do not match',
            field: 'confirmNewPassword',
          },
          context.requestId
        );
      }

      // Update password using the update method
      await UserService.update(auth.user!.id, {
        password: newPassword, // This will be hashed by the UserService
      } as any);

      // In production, you might also want to:
      // 1. Invalidate all existing sessions/tokens except current one
      // 2. Send confirmation email
      // 3. Log security event
      // 4. Force re-authentication on other devices

      logger.info('Password changed successfully', {
        userId: auth.user!.id,
        email: auth.user!.email,
        requestId: context.requestId,
      });

      return createSuccessResponse(
        {
          message: 'Password changed successfully',
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Password change failed', error as Error, {
        userId: auth.user?.id,
        requestId: context.requestId,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Password change failed',
        },
        context.requestId
      );
    }
  }
);

export const POST = changePasswordHandler;
