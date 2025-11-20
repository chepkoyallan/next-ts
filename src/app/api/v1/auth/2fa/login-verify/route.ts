/**
 * Two-Factor Authentication Login Verification
 * Exchanges temp token + 2FA code for full access tokens
 */

import { z } from 'zod';
import speakeasy from 'speakeasy';
import { cookies } from 'next/headers';
import { sign, verify } from 'jsonwebtoken';
import { randomUUID, createHash, timingSafeEqual } from 'crypto';

import { SessionStore } from '@app/cache';
import type { SessionData } from '@app/cache';

import { logger } from '../../../../lib/utils/logger';
import { createSingleMethodHandler } from '../../../../lib/handlers/base';
import { UserService } from '../../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// 2FA login verification schema
const verify2FALoginSchema = z.object({
  tempToken: z.string().min(1, 'Temporary token is required'),
  code: z.string().min(1, 'Code is required'),
  useBackupCode: z.boolean().optional().default(false),
});

// Helper: Hash backup code for comparison
function hashBackupCode(code: string, userId: string): string {
  return createHash('sha256').update(`${code}:${userId}`).digest('hex');
}

// 2FA login verification handler
const verify2FALoginHandler = createSingleMethodHandler(
  'POST',
  {
    rateLimit: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 3, // Strict: only 3 attempts per 5 minutes
    },
    validation: {
      body: verify2FALoginSchema,
    },
  },
  async ({ body, context, request }) => {
    const { tempToken, code, useBackupCode } = body;

    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      // ✅ Verify temp token
      let decoded: any;
      try {
        decoded = verify(tempToken, jwtSecret);
      } catch {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid or expired temporary token',
          },
          context.requestId
        );
      }

      // ✅ Validate token type
      if (decoded.type !== 'temp-2fa') {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid token type',
          },
          context.requestId
        );
      }

      // ✅ Get user
      const user = await UserService.findById(decoded.userId);
      if (!user || !(user as any).twoFactorEnabled) {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'User not found or 2FA not enabled',
          },
          context.requestId
        );
      }

      // ✅ Verify 2FA code
      let verified = false;
      let usedBackupCode = false;

      if (useBackupCode) {
        // Verify backup code
        const storedBackupCodes = JSON.parse((user as any).twoFactorBackupCodes || '[]');

        if (storedBackupCodes.length === 0) {
          return createErrorResponse(
            'UNAUTHORIZED',
            {
              message: 'No backup codes available',
            },
            context.requestId
          );
        }

        // Hash input code and compare (constant time)
        const inputHash = hashBackupCode(code.toUpperCase().replace(/\s/g, ''), user.id);

        let matchIndex = -1;
        for (let i = 0; i < storedBackupCodes.length; i += 1) {
          try {
            if (
              timingSafeEqual(
                Buffer.from(storedBackupCodes[i], 'utf8'),
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
          verified = true;
          usedBackupCode = true;

          // Remove used backup code
          storedBackupCodes.splice(matchIndex, 1);
          await (UserService as any).updateTwoFactorBackupCodes(
            user.id,
            JSON.stringify(storedBackupCodes)
          );

          logger.info('2FA backup code used for login', {
            userId: user.id,
            email: user.email,
            remainingBackupCodes: storedBackupCodes.length,
            requestId: context.requestId,
          });
        }
      } else {
        // Verify TOTP
        verified = speakeasy.totp.verify({
          secret: (user as any).twoFactorSecret,
          encoding: 'base32',
          token: code,
          window: 2, // Allow 2 time steps before/after for clock drift
        });
      }

      if (!verified) {
        logger.warn('Invalid 2FA code during login', {
          userId: user.id,
          email: user.email,
          useBackupCode,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid 2FA code',
            field: 'code',
          },
          context.requestId
        );
      }

      // ✅ 2FA verification successful - generate full tokens
      const rememberMe = decoded.rememberMe || false;
      const tokenExpiry = rememberMe ? '1h' : '15m';
      const refreshExpiry = rememberMe ? '30d' : '7d';

      const jti = randomUUID();
      const refreshJti = randomUUID();

      // Generate access token
      const accessToken = sign(
        {
          userId: user.id,
          email: user.email,
          roles: (user as any).roles || [user.role],
          permissions: (user as any).permissions,
          type: 'access',
          jti,
        },
        jwtSecret,
        {
          expiresIn: tokenExpiry,
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      // Generate refresh token
      const refreshToken = sign(
        {
          userId: user.id,
          email: user.email,
          type: 'refresh',
          jti: refreshJti,
        },
        jwtSecret,
        {
          expiresIn: refreshExpiry,
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      // ✅ Create session in Redis
      const userAgent = request.headers.get('user-agent') || 'Unknown';
      const ipAddress =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown';

      const sessionData: SessionData = {
        sessionId: jti,
        userId: user.id,
        jti,
        deviceInfo: userAgent,
        userAgent,
        ipAddress,
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000),
      };

      const sessionTTL = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
      await SessionStore.create(sessionData, sessionTTL).catch((err) => {
        console.error('Failed to create session:', err);
      });

      // ✅ Set HTTPOnly cookies
      const cookieStore = cookies();
      const isProduction = process.env.NODE_ENV === 'production';

      cookieStore.set('accessToken', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: rememberMe ? 60 * 60 : 15 * 60,
        path: '/',
      });

      cookieStore.set('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60,
        path: '/api/v1/auth/refresh',
      });

      logger.info('2FA login verification successful', {
        userId: user.id,
        email: user.email,
        usedBackupCode,
        requestId: context.requestId,
      });

      // Return user data (without tokens)
      return createSuccessResponse(
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: (user as any).roles || [user.role],
            permissions: (user as any).permissions,
            emailVerified: (user as any).emailVerified,
            twoFactorEnabled: (user as any).twoFactorEnabled,
          },
          message: '2FA verification successful',
          ...(usedBackupCode && {
            warning: 'You used a backup code. Consider regenerating backup codes.',
          }),
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('2FA login verification failed', error as Error, {
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

export const POST = verify2FALoginHandler;
