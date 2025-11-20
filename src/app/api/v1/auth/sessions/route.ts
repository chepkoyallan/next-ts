// Session management endpoint
import { z } from 'zod';

import { SessionStore, TokenBlacklist } from '@app/cache';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Session revocation schema
const revokeSessionSchema = z.object({
  sessionId: z.string().optional(),
  revokeAll: z.boolean().optional().default(false),
});

// Session management handler
// ✅ SECURITY: Strict rate limiting for sensitive session data
const handler = createApiHandler(
  {
    auth: {
      required: true, // ✅ Only authenticated users can access
      permissions: [], // No special permissions needed - users can only see their own sessions
    },
    rateLimit: rateLimitConfigs.strict, // ✅ Very strict: 5 requests per 15 minutes in production
    allowedMethods: ['GET', 'DELETE'],
  },
  {
    // Get active sessions
    // ✅ SECURITY: Users can ONLY see their own sessions (filtered by auth.user.id)
    GET: async ({ context, auth }) => {
      try {
        if (!auth.user) {
          logger.warn('Unauthorized session access attempt', {
            requestId: context.requestId,
            ipAddress: (context as any).ipAddress,
          });
          return createErrorResponse(
            'UNAUTHORIZED',
            {
              message: 'User not authenticated',
            },
            context.requestId
          );
        }

        // ✅ SECURITY: Fetch ONLY this user's sessions from Redis (scoped to auth.user.id)
        const userSessions = await SessionStore.getUserSessions(auth.user.id);

        // Get current session JTI from auth token
        const currentJti = auth.tokenPayload?.jti;

        // Format sessions for response
        const sessions = userSessions.map((session) => ({
          id: session.sessionId,
          sessionId: session.sessionId,
          deviceInfo: session.deviceInfo || 'Unknown Device',
          ipAddress: session.ipAddress || 'Unknown',
          userAgent: session.userAgent,
          lastActivity: session.lastActivity,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          isCurrentSession: session.jti === currentJti,
        }));

        // ✅ SECURITY: Log session access for audit trail
        logger.info('User sessions accessed', {
          userId: auth.user.id,
          sessionCount: sessions.length,
          currentJti,
          requestId: context.requestId,
          ipAddress: (context as any).ipAddress,
        });

        return createSuccessResponse(
          {
            sessions,
            totalSessions: sessions.length,
            currentSessionId: currentJti,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to retrieve sessions', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to retrieve sessions',
          },
          context.requestId
        );
      }
    },

    // Revoke sessions
    // ✅ SECURITY: Users can ONLY revoke their own sessions
    DELETE: async ({ body, context, auth }) => {
      try {
        if (!auth.user) {
          logger.warn('Unauthorized session revocation attempt', {
            requestId: context.requestId,
            ipAddress: (context as any).ipAddress,
          });
          return createErrorResponse(
            'UNAUTHORIZED',
            {
              message: 'User not authenticated',
            },
            context.requestId
          );
        }

        const validation = revokeSessionSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid request data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const { sessionId, revokeAll } = validation.data;
        const currentJti = auth.tokenPayload?.jti;

        if (revokeAll) {
          // ✅ Revoke all sessions except current one
          const userSessions = await SessionStore.getUserSessions(auth.user.id);

          const tokensToBlacklist = userSessions
            .filter((session) => session.jti !== currentJti)
            .map((session) => ({
              jti: session.jti,
              expiresIn: Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
            }));

          // Blacklist all tokens
          if (tokensToBlacklist.length > 0) {
            await TokenBlacklist.addMultiple(tokensToBlacklist);
          }

          // Delete all sessions except current
          const deletedCount = await SessionStore.deleteUserSessions(auth.user.id, currentJti);

          logger.info('All sessions revoked', {
            userId: auth.user.id,
            revokedCount: deletedCount,
            requestId: context.requestId,
          });

          return createSuccessResponse(
            {
              message: 'All other sessions have been revoked',
              revokedSessions: deletedCount,
            },
            200,
            context.requestId
          );
        }

        if (sessionId) {
          // ✅ Revoke specific session
          if (sessionId === currentJti) {
            return createErrorResponse(
              'VALIDATION_ERROR',
              {
                message: 'Cannot revoke current session. Use logout instead.',
              },
              context.requestId
            );
          }

          // ✅ SECURITY: Get session details and verify it belongs to this user
          const session = await SessionStore.get(sessionId, auth.user.id);
          if (!session) {
            logger.warn('Session revocation failed - session not found or unauthorized', {
              userId: auth.user.id,
              sessionId,
              requestId: context.requestId,
              ipAddress: (context as any).ipAddress,
            });
            return createErrorResponse(
              'RESOURCE_NOT_FOUND',
              {
                message: 'Session not found or access denied',
              },
              context.requestId
            );
          }

          // ✅ SECURITY: Double-check session belongs to user
          if (session.userId !== auth.user.id) {
            logger.error(
              'SECURITY ALERT: Attempted session revocation for another user',
              new Error('Unauthorized session access'),
              {
                attackerUserId: auth.user!.id,
                targetUserId: session.userId,
                sessionId,
                requestId: context.requestId,
                ipAddress: (context as any).ipAddress,
              }
            );
            return createErrorResponse(
              'FORBIDDEN',
              {
                message: 'Access denied',
              },
              context.requestId
            );
          }

          // Calculate remaining TTL
          const expiresIn = Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000);

          if (expiresIn > 0) {
            // Blacklist the token
            await TokenBlacklist.add(session.jti, expiresIn);
          }

          // Delete the session
          await SessionStore.delete(sessionId, auth.user.id);

          logger.info('Session revoked', {
            userId: auth.user.id,
            sessionId,
            requestId: context.requestId,
          });

          return createSuccessResponse(
            {
              message: 'Session revoked successfully',
              revokedSessionId: sessionId,
            },
            200,
            context.requestId
          );
        }

        return createErrorResponse(
          'VALIDATION_ERROR',
          {
            message: 'Either sessionId or revokeAll must be specified',
          },
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to revoke sessions', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to revoke sessions',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const DELETE = handler;
