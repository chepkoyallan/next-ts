// User logout endpoint
import { z } from 'zod';
import { verify } from 'jsonwebtoken';
import { cookies } from 'next/headers';

import { SessionStore, TokenBlacklist } from '@app/cache';

import { logger } from '../../../lib/utils/logger';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../lib/handlers/base';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Logout validation schema
const logoutSchema = z.object({
  logoutFromAllDevices: z.boolean().optional().default(false),
});

// Logout handler
const logoutHandler = createSingleMethodHandler(
  'POST',
  {
    auth: {
      required: true,
      permissions: [],
    },
    rateLimit: rateLimitConfigs.standard,
    validation: {
      body: logoutSchema,
    },
  },
  async ({ body, context, auth }) => {
    const { logoutFromAllDevices } = body;

    try {
      if (!auth.user) {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'User not authenticated',
          },
          context.requestId
        );
      }

      // ✅ SECURITY: Get tokens from HTTPOnly cookies
      const cookieStore = cookies();
      const accessToken = cookieStore.get('accessToken')?.value;
      const refreshToken = cookieStore.get('refreshToken')?.value;

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      // Decode tokens to get JTIs and expiration
      let accessJti: string | undefined;
      let refreshJti: string | undefined;
      let accessExp: number | undefined;
      let refreshExp: number | undefined;

      if (accessToken) {
        try {
          const decoded: any = verify(accessToken, jwtSecret);
          accessJti = decoded.jti;
          accessExp = decoded.exp;
        } catch {
          // Token might be expired, but we still want to log out
        }
      }

      if (refreshToken) {
        try {
          const decoded: any = verify(refreshToken, jwtSecret);
          refreshJti = decoded.jti;
          refreshExp = decoded.exp;
        } catch {
          // Token might be expired, but we still want to log out
        }
      }

      if (logoutFromAllDevices) {
        // ✅ SECURITY: Revoke all user sessions
        const userSessions = await SessionStore.getUserSessions(auth.user.id);

        // Blacklist all tokens
        const tokensToBlacklist = userSessions
          .map((session) => ({
            jti: session.jti,
            expiresIn: Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
          }))
          .filter((token) => token.expiresIn > 0);

        if (tokensToBlacklist.length > 0) {
          await TokenBlacklist.addMultiple(tokensToBlacklist);
        }

        // Delete all sessions
        await SessionStore.deleteUserSessions(auth.user.id);

        logger.info('User logged out from all devices', {
          userId: auth.user.id,
          email: auth.user.email,
          revokedSessions: userSessions.length,
          requestId: context.requestId,
        });
      } else {
        // ✅ SECURITY: Blacklist current tokens only
        if (accessJti && accessExp) {
          const accessTTL = Math.floor(accessExp - Date.now() / 1000);
          if (accessTTL > 0) {
            await TokenBlacklist.add(accessJti, accessTTL);
          }
        }

        if (refreshJti && refreshExp) {
          const refreshTTL = Math.floor(refreshExp - Date.now() / 1000);
          if (refreshTTL > 0) {
            await TokenBlacklist.add(refreshJti, refreshTTL);
          }
        }

        // Delete current session
        if (accessJti) {
          await SessionStore.delete(accessJti, auth.user.id);
        }

        logger.info('User logged out', {
          userId: auth.user.id,
          email: auth.user.email,
          requestId: context.requestId,
        });
      }

      // ✅ SECURITY: Clear HTTPOnly cookies
      // Must use the same options (especially path) as when cookies were set
      const isProduction = process.env.NODE_ENV === 'production';

      cookieStore.set('accessToken', '', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 0, // Expire immediately
        path: '/',
      });

      cookieStore.set('refreshToken', '', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 0, // Expire immediately
        path: '/api/v1/auth/refresh', // Same path as when set
      });

      return createSuccessResponse(
        {
          message: 'Logged out successfully',
          loggedOutFromAllDevices: logoutFromAllDevices,
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Logout failed', error as Error, {
        userId: auth.user?.id,
        requestId: context.requestId,
      });

      // Even if blacklisting fails, clear cookies
      const cookieStore = cookies();
      const isProduction = process.env.NODE_ENV === 'production';

      cookieStore.set('accessToken', '', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      });

      cookieStore.set('refreshToken', '', {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 0,
        path: '/api/v1/auth/refresh',
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Logout failed',
        },
        context.requestId
      );
    }
  }
);

export const POST = logoutHandler;
