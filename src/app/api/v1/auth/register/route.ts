// User registration endpoint
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { sign } from 'jsonwebtoken';
import { cookies } from 'next/headers';

import { SessionStore, type SessionData } from '@app/cache';

import { logger } from '../../../lib/utils/logger';
import { commonSchemas } from '../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../lib/handlers/base';
import { UserService } from '../../../lib/services/user-service-prisma';
import { OrganizationService } from '../../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Force dynamic rendering (uses cookies for auth)
export const dynamic = 'force-dynamic';

// Registration validation schema
const registerSchema = z
  .object({
    email: commonSchemas.email,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
    confirmPassword: z.string(),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100),
    acceptTerms: z
      .boolean()
      .refine((val) => val === true, 'You must accept the terms and conditions'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Registration handler
const registerHandler = createSingleMethodHandler(
  'POST',
  {
    rateLimit: rateLimitConfigs.strict, // Strict rate limiting for registration
    validation: {
      body: registerSchema,
    },
  },
  async ({ body, context, request }) => {
    const { email, password, name } = body;

    try {
      // Check if user already exists
      const existingUser = await UserService.findByEmail(email);
      if (existingUser) {
        return createErrorResponse(
          'RESOURCE_ALREADY_EXISTS',
          {
            message: 'User with this email already exists',
            field: 'email',
          },
          context.requestId
        );
      }

      // Create user with default role
      // In headless mode, all users are superusers
      const isHeadlessMode =
        process.env.HEADLESS?.toLowerCase() === 'true' || process.env.HEADLESS === '1';
      const defaultRole = isHeadlessMode ? 'super-admin' : process.env.RBAC_DEFAULT_ROLE || 'user';
      const newUser = await UserService.create({
        email,
        password,
        name,
        role: defaultRole as 'user' | 'admin' | 'moderator',
      });

      // Create default personal organization for the user
      // Generate unique slug from name
      const baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-');
      const uniqueSlug = `${baseSlug}-${Date.now()}`;

      const defaultOrg = await OrganizationService.create({
        name: `${name}'s Organization`,
        slug: uniqueSlug,
        description: 'Personal workspace',
        ownerId: newUser.id,
      });

      // Generate JWT tokens (access + refresh)
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      const jti = randomUUID(); // Unique token ID for blacklisting

      const token = sign(
        {
          userId: newUser.id,
          email: newUser.email,
          roles: (newUser as any).roles || [newUser.role], // Support both formats
          permissions: (newUser as any).permissions,
          jti, // Token ID for revocation
        },
        jwtSecret,
        {
          expiresIn: '24h', // Use literal instead of env var to satisfy TypeScript
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      // Generate refresh token
      const refreshTokenJti = randomUUID();

      const refreshToken = sign(
        {
          userId: newUser.id,
          email: newUser.email,
          type: 'refresh',
          jti: refreshTokenJti,
        },
        jwtSecret,
        {
          expiresIn: '7d',
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      // Store session in Redis
      const userAgent = request.headers.get('user-agent') || 'Unknown';
      const ipAddress =
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown';

      const sessionData: SessionData = {
        sessionId: jti,
        userId: newUser.id,
        jti,
        deviceInfo: userAgent,
        userAgent,
        ipAddress,
        createdAt: new Date(),
        lastActivity: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      const sessionTTL = 7 * 24 * 60 * 60; // 7 days in seconds
      await SessionStore.create(sessionData, sessionTTL).catch((err) => {
        // Log but don't fail registration if session creation fails
        console.error('Failed to create session:', err);
      });

      // Set HTTPOnly cookies instead of returning tokens
      const cookieStore = cookies();
      const isProduction = process.env.NODE_ENV === 'production';

      cookieStore.set('accessToken', token, {
        httpOnly: true, // JavaScript cannot access
        secure: isProduction, // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
      });

      cookieStore.set('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      // Send welcome email (non-blocking)
      const { sendWelcomeEmail } = await import('../../../../../lib/email/email-manager');

      sendWelcomeEmail(newUser.email, {
        name: newUser.name,
      }).catch((error) => {
        logger.error('Failed to send welcome email', error as Error, {
          userId: newUser.id,
          email: newUser.email,
        });
      });

      // Log successful registration
      logger.info('User registered successfully', {
        userId: newUser.id,
        email: newUser.email,
        requestId: context.requestId,
      });

      // Prepare user response (exclude sensitive data)
      const userResponse = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        roles: (newUser as any).roles || [newUser.role], // Support both formats
        permissions: (newUser as any).permissions,
        emailVerified: (newUser as any).emailVerified,
        createdAt: newUser.createdAt,
      };

      return createSuccessResponse(
        {
          user: userResponse,
          organization: {
            id: defaultOrg.id,
            name: defaultOrg.name,
          },
          message: 'Registration successful. You are now logged in.',
        },
        201,
        context.requestId
      );
    } catch (error) {
      logger.error('Registration failed', error as Error, { email, requestId: context.requestId });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Registration failed',
        },
        context.requestId
      );
    }
  }
);

export const POST = registerHandler;
