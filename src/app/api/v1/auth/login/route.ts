// Authentication login endpoint
import { z } from 'zod';
import { sign } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';

import { SessionStore } from '@app/cache';
import type { SessionData } from '@app/cache';
import { commonSchemas } from 'src/app/api/lib/utils/validation';
import { AccountLockout } from '@app/security/account-lockout';
import { rateLimitConfigs } from 'src/app/api/lib/middleware/rate-limit';
import { createSingleMethodHandler } from 'src/app/api/lib/handlers/base';
// User service for database operations
import { UserService } from 'src/app/api/lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from 'src/app/api/lib/utils/response';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Login validation schema
const loginSchema = z.object({
  email: commonSchemas.email,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

// Login handler
const loginHandler = createSingleMethodHandler(
  'POST',
  {
    rateLimit: rateLimitConfigs.strict, // Strict rate limiting for login
    validation: {
      body: loginSchema,
    },
  },
  async ({ body, context, request }) => {
    const { email, password, rememberMe } = body;

    try {
      // Check if account is locked
      const lockoutStatus = await AccountLockout.isLocked(email);
      if (lockoutStatus?.locked) {
        const remainingMinutes = Math.ceil((lockoutStatus.remainingTime || 0) / 60);
        return createErrorResponse(
          'FORBIDDEN',
          {
            message: `Account locked due to too many failed login attempts. Try again in ${remainingMinutes} minutes.`,
            lockedUntil: lockoutStatus.lockedUntil,
            remainingTime: lockoutStatus.remainingTime,
          },
          context.requestId
        );
      }

      // Verify user credentials
      const isValidPassword = await UserService.verifyPassword(email, password);
      if (!isValidPassword) {
        // Record failed attempt
        const isNowLocked = await AccountLockout.recordFailedAttempt(email);

        if (isNowLocked) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message:
                'Account locked due to too many failed login attempts. Try again in 15 minutes.',
            },
            context.requestId
          );
        }

        const remainingAttempts = await AccountLockout.getRemainingAttempts(email);

        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid email or password',
            remainingAttempts,
          },
          context.requestId
        );
      }

      // Get user data
      const user = await UserService.findByEmail(email);
      if (!user) {
        // Record failed attempt even if user not found (prevents enumeration)
        await AccountLockout.recordFailedAttempt(email);

        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid email or password',
          },
          context.requestId
        );
      }

      // Check if user account is active
      if ((user as any).isActive === false) {
        return createErrorResponse(
          'FORBIDDEN',
          {
            message: 'Account has been deactivated. Please contact support.',
          },
          context.requestId
        );
      }

      // Clear failed login attempts on successful authentication
      await AccountLockout.clearAttempts(email);

      // Track login activity
      const ipAddress =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown';
      await UserService.updateProfile(user.id, {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      });

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      // ✅ SECURITY: Shorter token expiry (15m instead of 24h)
      const tokenExpiry = rememberMe ? '1h' : '15m'; // Reduced from 30d/24h
      const refreshExpiry = rememberMe ? '30d' : '7d';

      // Check if 2FA is enabled
      if ((user as any).twoFactorEnabled) {
        // Generate temporary token for 2FA verification
        const tempJti = randomUUID();
        const tempToken = sign(
          {
            userId: user.id,
            email: user.email,
            type: 'temp-2fa',
            requiresTwoFactor: true,
            jti: tempJti,
            rememberMe, // Include for later use
          },
          jwtSecret,
          {
            expiresIn: '10m', // Short-lived temp token
            issuer: 'icodeai-api',
            audience: 'icodeai-users',
          }
        );

        return createSuccessResponse(
          {
            requiresTwoFactor: true,
            tempToken,
            message: 'Please provide your 2FA code to complete login',
          },
          200,
          context.requestId
        );
      }

      // ✅ SECURITY: Generate JTI (JWT ID) for token revocation
      const jti = randomUUID();
      const refreshJti = randomUUID();

      // Generate full access token (no 2FA required)
      const token = sign(
        {
          userId: user.id,
          email: user.email,
          roles: (user as any).roles || [user.role],
          permissions: user.permissions,
          type: 'access',
          jti, // ✅ Unique token ID for blacklisting
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
          jti: refreshJti, // ✅ Unique refresh token ID
        },
        jwtSecret,
        {
          expiresIn: refreshExpiry,
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      // ✅ SECURITY: Create session in Redis
      const userAgent = request.headers.get('user-agent') || 'Unknown';

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

      const sessionTTL = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // seconds
      await SessionStore.create(sessionData, sessionTTL).catch((err) => {
        // Log but don't fail login if session creation fails
        console.error('Failed to create session:', err);
      });

      // ✅ SECURITY: Set HTTPOnly cookies instead of returning tokens
      const cookieStore = cookies();
      const isProduction = process.env.NODE_ENV === 'production';

      cookieStore.set('accessToken', token, {
        httpOnly: true, // ✅ JavaScript cannot access
        secure: isProduction, // ✅ HTTPS only in production
        sameSite: 'strict', // ✅ CSRF protection
        maxAge: rememberMe ? 60 * 60 : 15 * 60, // seconds
        path: '/',
      });

      cookieStore.set('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60,
        path: '/api/v1/auth/refresh', // ✅ Limited scope
      });

      // Prepare user response (exclude sensitive data)
      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: (user as any).roles || [user.role],
        permissions: user.permissions,
        emailVerified: (user as any).emailVerified,
        twoFactorEnabled: (user as any).twoFactorEnabled,
      };

      // ✅ SECURITY: Don't return tokens in response body
      return createSuccessResponse(
        {
          user: userResponse,
          message: 'Login successful',
          // ❌ DO NOT include: token, refreshToken
        },
        200,
        context.requestId
      );
    } catch {
      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Authentication failed',
        },
        context.requestId
      );
    }
  }
);

export const POST = loginHandler;
