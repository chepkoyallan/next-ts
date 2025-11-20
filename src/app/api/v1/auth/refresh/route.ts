// Token refresh endpoint
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { sign, verify } from 'jsonwebtoken';

import { SessionStore, TokenBlacklist } from '@app/cache';

import { logger } from '../../../lib/utils/logger';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../lib/handlers/base';
import { UserService } from '../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Refresh token handler - No body validation needed (reads from cookies)
const refreshHandler = createSingleMethodHandler(
  'POST',
  {
    rateLimit: rateLimitConfigs.standard,
  },
  async ({ context, request }) => {
    // ✅ SECURITY: Get refresh token from HTTPOnly cookie
    const cookieStore = cookies();
    const refreshToken = cookieStore.get('refreshToken')?.value;

    try {
      if (!refreshToken) {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Refresh token not found',
          },
          context.requestId
        );
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      // Verify refresh token
      let decoded: any;
      try {
        decoded = verify(refreshToken, jwtSecret);
      } catch {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid or expired refresh token',
          },
          context.requestId
        );
      }

      // Check if token is a refresh token
      if (decoded.type !== 'refresh') {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid token type',
          },
          context.requestId
        );
      }

      // ✅ SECURITY: Check if refresh token is blacklisted (reuse detection)
      // Grace period: Allow token reuse within 30 seconds of rotation to handle concurrent requests
      if (decoded.jti) {
        const blacklistStatus = await TokenBlacklist.isBlacklistedWithGracePeriod(
          decoded.jti,
          30000 // 30 second grace period
        );

        if (blacklistStatus.blacklisted) {
          if (blacklistStatus.withinGracePeriod) {
            // Token was recently rotated - allow it (concurrent request handling)
            logger.info('Allowing blacklisted token within grace period (concurrent requests)', {
              userId: decoded.userId,
              jti: decoded.jti,
              timeSinceRevocation: Date.now() - (blacklistStatus.revokedAt || 0),
              requestId: context.requestId,
            });
          } else {
            // Token was rotated a while ago - this is likely token theft
            logger.warn('Attempted reuse of blacklisted refresh token - possible token theft', {
              userId: decoded.userId,
              jti: decoded.jti,
              revokedAt: blacklistStatus.revokedAt,
              timeSinceRevocation: Date.now() - (blacklistStatus.revokedAt || 0),
              requestId: context.requestId,
            });

            // ✅ SECURITY: Revoke ALL user sessions on token reuse (security breach indicator)
            await SessionStore.deleteUserSessions(decoded.userId);

            return createErrorResponse(
              'UNAUTHORIZED',
              {
                message:
                  'Refresh token has been revoked. All sessions have been terminated for security.',
              },
              context.requestId
            );
          }
        }
      }

      // Get current user data
      const user = await UserService.findById(decoded.userId);
      if (!user || (user as any).isActive === false) {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'User not found or inactive',
          },
          context.requestId
        );
      }

      // ✅ SECURITY: Generate new JTIs for token rotation
      const newAccessJti = randomUUID();
      const newRefreshJti = randomUUID();

      // Generate new access token
      const accessToken = sign(
        {
          userId: user.id,
          email: user.email,
          roles: (user as any).roles || [user.role],
          permissions: (user as any).permissions,
          type: 'access',
          jti: newAccessJti, // New JTI
        },
        jwtSecret,
        {
          expiresIn: '15m', // Short-lived access token
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      // Generate new refresh token
      const newRefreshToken = sign(
        {
          userId: user.id,
          email: user.email,
          type: 'refresh',
          jti: newRefreshJti, // New JTI
        },
        jwtSecret,
        {
          expiresIn: '7d', // Long-lived refresh token
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      // ✅ SECURITY: Blacklist old refresh token (prevent reuse)
      if (decoded.jti) {
        const oldTokenTTL = Math.floor(decoded.exp - Date.now() / 1000);
        if (oldTokenTTL > 0) {
          await TokenBlacklist.add(decoded.jti, oldTokenTTL).catch((err) => {
            logger.error('Failed to blacklist old refresh token', err);
          });
        }
      }

      // ✅ Update session activity
      const userAgent = request.headers.get('user-agent') || 'Unknown';
      const ipAddress =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown';

      // Update session with new JTI
      if (decoded.jti) {
        await SessionStore.delete(decoded.jti, user.id).catch(() => {});
      }

      // Create new session
      await SessionStore.create(
        {
          sessionId: newAccessJti,
          userId: user.id,
          jti: newAccessJti,
          deviceInfo: userAgent,
          userAgent,
          ipAddress,
          createdAt: new Date(),
          lastActivity: new Date(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        7 * 24 * 60 * 60
      ).catch((err) => {
        logger.error('Failed to create new session', err);
      });

      // ✅ SECURITY: Set new HTTPOnly cookies
      const isProduction = process.env.NODE_ENV === 'production';

      cookieStore.set('accessToken', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
      });

      cookieStore.set('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/api/v1/auth/refresh',
      });

      logger.info('Token refreshed successfully', {
        userId: user.id,
        email: user.email,
        oldJti: decoded.jti,
        newJti: newAccessJti,
        requestId: context.requestId,
      });

      // ✅ SECURITY: Don't return tokens in body
      return createSuccessResponse(
        {
          message: 'Token refreshed successfully',
          // ❌ DO NOT include: accessToken, refreshToken
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Token refresh failed', error as Error, { requestId: context.requestId });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Token refresh failed',
        },
        context.requestId
      );
    }
  }
);

export const POST = refreshHandler;
