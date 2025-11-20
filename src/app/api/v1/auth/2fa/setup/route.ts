// Two-Factor Authentication setup endpoint
import { z } from 'zod';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';

import { logger } from '../../../../lib/utils/logger';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../../lib/handlers/base';
import { UserService } from '../../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// 2FA setup validation schema
const setup2FASchema = z.object({
  password: z.string().min(1, 'Password is required for 2FA setup'),
});

// 2FA setup handler
const setup2FAHandler = createSingleMethodHandler(
  'POST',
  {
    auth: {
      required: true,
      permissions: [],
    },
    rateLimit: rateLimitConfigs.strict,
    validation: {
      body: setup2FASchema,
    },
  },
  async ({ body, context, auth }) => {
    const { password } = body;

    try {
      // Verify password before allowing 2FA setup
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

      // Check if 2FA is already enabled
      if ((user as any).twoFactorEnabled) {
        return createErrorResponse(
          'RESOURCE_ALREADY_EXISTS',
          {
            message: '2FA is already enabled for this account',
          },
          context.requestId
        );
      }

      // Generate secret for TOTP
      const secret = speakeasy.generateSecret({
        name: `${process.env.NEXT_PUBLIC_APP_NAME || 'iCodeAI'} (${user.email})`,
        issuer: process.env.NEXT_PUBLIC_APP_NAME || 'iCodeAI',
        length: 32,
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

      // Store temporary secret for verification
      // Note: This method needs to be implemented in UserService
      await (UserService as any).storeTempTwoFactorSecret(user.id, secret.base32);

      logger.info('2FA setup initiated', {
        userId: user.id,
        email: user.email,
        requestId: context.requestId,
      });

      return createSuccessResponse(
        {
          secret: secret.base32,
          qrCode: qrCodeUrl,
          manualEntryKey: secret.base32,
          backupCodes: [], // Will be generated after verification
          message: 'Scan the QR code with your authenticator app, then verify with a code',
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('2FA setup failed', error as Error, {
        userId: auth.user?.id,
        requestId: context.requestId,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: '2FA setup failed',
        },
        context.requestId
      );
    }
  }
);

export const POST = setup2FAHandler;
