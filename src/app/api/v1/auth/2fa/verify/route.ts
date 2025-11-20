// Two-Factor Authentication verification endpoint
import { z } from 'zod';
import speakeasy from 'speakeasy';
import crypto, { createHash, timingSafeEqual } from 'crypto';

import { logger } from '../../../../lib/utils/logger';
import { createSingleMethodHandler } from '../../../../lib/handlers/base';
import { UserService } from '../../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// 2FA verification validation schema
const verify2FASchema = z.object({
  code: z
    .string()
    .length(6, '2FA code must be 6 digits')
    .regex(/^\d{6}$/, '2FA code must contain only numbers'),
  isSetup: z.boolean().optional().default(false), // true when completing initial setup
});

// ✅ SECURITY: Hash backup code for secure storage
function hashBackupCode(code: string, userId: string): string {
  return createHash('sha256').update(`${code}:${userId}`).digest('hex');
}

// Generate backup codes (returns plain text for user, but stores hashed)
function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

// 2FA verification handler
const verify2FAHandler = createSingleMethodHandler(
  'POST',
  {
    auth: {
      required: true,
      permissions: [],
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // Strict rate limiting for 2FA attempts
    },
    validation: {
      body: verify2FASchema,
    },
  },
  async ({ body, context, auth }) => {
    const { code, isSetup } = body;

    try {
      const user = await UserService.findById(auth.user!.id);

      if (!user) {
        return createErrorResponse(
          'RESOURCE_NOT_FOUND',
          {
            message: 'User not found',
          },
          context.requestId
        );
      }

      let secret: string;
      if (isSetup) {
        // Completing initial 2FA setup
        const tempSecret = await (UserService as any).getTempTwoFactorSecret(user.id);
        if (!tempSecret) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Temporary 2FA secret not found. Please restart setup.',
            },
            context.requestId
          );
        }
        secret = tempSecret;
      } else {
        // Regular 2FA verification for login
        if (!isSetup && (!(user as any).twoFactorEnabled || !(user as any).twoFactorSecret)) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: '2FA is not enabled for this account',
            },
            context.requestId
          );
        }
        secret = (user as any).twoFactorSecret;
      }

      // Verify the TOTP code
      const verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: code,
        window: 2, // Allow 2 time steps before/after for clock drift
      });

      if (!verified) {
        // Check if it's a backup code (only for non-setup verification)
        if (!isSetup && (user as any).twoFactorBackupCodes) {
          const hashedBackupCodes = JSON.parse((user as any).twoFactorBackupCodes);

          // ✅ SECURITY: Hash input code and compare with timing-safe comparison
          const inputHash = hashBackupCode(code.toUpperCase().replace(/\s/g, ''), user.id);

          let matchIndex = -1;
          for (let i = 0; i < hashedBackupCodes.length; i += 1) {
            try {
              if (
                timingSafeEqual(
                  Buffer.from(hashedBackupCodes[i], 'utf8'),
                  Buffer.from(inputHash, 'utf8')
                )
              ) {
                matchIndex = i;
                break;
              }
            } catch {
              // Length mismatch, continue to next iteration
            }
          }

          if (matchIndex !== -1) {
            // Remove used backup code
            hashedBackupCodes.splice(matchIndex, 1);
            await (UserService as any).updateTwoFactorBackupCodes(
              user.id,
              JSON.stringify(hashedBackupCodes)
            );

            logger.info('2FA backup code used', {
              userId: user.id,
              email: user.email,
              remainingBackupCodes: hashedBackupCodes.length,
              requestId: context.requestId,
            });

            return createSuccessResponse(
              {
                verified: true,
                backupCodeUsed: true,
                remainingBackupCodes: hashedBackupCodes.length,
                message: 'Backup code verified successfully',
              },
              200,
              context.requestId
            );
          }
        }

        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid 2FA code',
            field: 'code',
          },
          context.requestId
        );
      }

      if (isSetup) {
        // Complete 2FA setup
        const backupCodes = generateBackupCodes(); // Plain text for user display

        // ✅ SECURITY: Hash backup codes before storage
        const hashedBackupCodes = backupCodes.map((backupCode) =>
          hashBackupCode(backupCode, user.id)
        );

        await (UserService as any).enableTwoFactor(
          user.id,
          secret,
          JSON.stringify(hashedBackupCodes)
        );
        await (UserService as any).clearTempTwoFactorSecret(user.id);

        logger.info('2FA enabled successfully', {
          userId: user.id,
          email: user.email,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            verified: true,
            enabled: true,
            backupCodes, // Return plain text to user (only time they see them)
            message:
              '2FA has been enabled successfully. Save your backup codes in a secure location.',
          },
          200,
          context.requestId
        );
      }
      // Regular 2FA verification successful
      logger.info('2FA verification successful', {
        userId: user.id,
        email: user.email,
        requestId: context.requestId,
      });

      return createSuccessResponse(
        {
          verified: true,
          message: '2FA verification successful',
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('2FA verification failed', error as Error, {
        userId: auth.user?.id,
        isSetup,
        requestId: context.requestId,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: '2FA verification failed',
        },
        context.requestId
      );
    }
  }
);

export const POST = verify2FAHandler;
