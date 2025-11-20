// Two-Factor Authentication disable endpoint
import { z } from 'zod';
import speakeasy from 'speakeasy';

import { logger } from '../../../../lib/utils/logger';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../../lib/handlers/base';
import { UserService } from '../../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// 2FA disable validation schema
const disable2FASchema = z
  .object({
    password: z.string().min(1, 'Password is required'),
    code: z
      .string()
      .length(6, '2FA code must be 6 digits')
      .regex(/^\d{6}$/, '2FA code must contain only numbers')
      .optional(),
    backupCode: z.string().optional(),
  })
  .refine((data) => data.code || data.backupCode, {
    message: 'Either 2FA code or backup code is required',
    path: ['code'],
  });

// 2FA disable handler
const disable2FAHandler = createSingleMethodHandler(
  'POST',
  {
    auth: {
      required: true,
      permissions: [],
    },
    validation: {
      body: disable2FASchema,
    },
    rateLimit: rateLimitConfigs.standard,
  },
  async ({ body, context, auth }) => {
    const { password, code, backupCode } = body;

    try {
      // Verify password
      const isValidPassword = await UserService.verifyPassword(auth.user!.email, password);
      if (!isValidPassword) {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid password',
            field: 'password',
          },
          context.requestId
        );
      }

      // Get user data
      const user = await UserService.findByEmail(auth.user!.email);
      if (!user) {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'User not found',
          },
          context.requestId
        );
      }

      // Check if 2FA is enabled
      if (!(user as any).twoFactorEnabled || !(user as any).twoFactorSecret) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          {
            message: '2FA is not enabled for this account',
          },
          context.requestId
        );
      }

      let verified = false;

      if (code) {
        // Verify TOTP code
        verified = speakeasy.totp.verify({
          secret: (user as any).twoFactorSecret,
          encoding: 'base32',
          token: code,
          window: 2,
        });
      } else if (backupCode && (user as any).twoFactorBackupCodes) {
        // Verify backup code
        const backupCodes = JSON.parse((user as any).twoFactorBackupCodes);
        verified = backupCodes.includes(backupCode.toUpperCase());
      }

      if (!verified) {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid 2FA code or backup code',
            field: code ? 'code' : 'backupCode',
          },
          context.requestId
        );
      }

      // Disable 2FA
      // Note: This method needs to be implemented in UserService
      await (UserService as any).disableTwoFactor(user.id);

      logger.info('2FA disabled', {
        userId: user.id,
        email: user.email,
        requestId: context.requestId,
      });

      return createSuccessResponse(
        {
          message: '2FA has been disabled successfully',
          disabled: true,
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('2FA disable failed', error as Error, {
        userId: auth.user?.id,
        requestId: context.requestId,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Failed to disable 2FA',
        },
        context.requestId
      );
    }
  }
);

export const POST = disable2FAHandler;
