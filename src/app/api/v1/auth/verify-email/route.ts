// Email verification endpoint
import { z } from 'zod';
import { sign, verify } from 'jsonwebtoken';

import { logger } from '../../../lib/utils/logger';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../lib/handlers/base';
import { UserService } from '../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Email verification validation schema
const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// Resend verification email schema
const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
});

// Email verification handler
const verifyEmailHandler = createSingleMethodHandler(
  'POST',
  {
    rateLimit: rateLimitConfigs.standard,
    validation: {
      body: verifyEmailSchema,
    },
  },
  async ({ body, context }) => {
    const { token } = body;

    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      // Verify email verification token
      let decoded: any;
      try {
        decoded = verify(token, jwtSecret);
      } catch {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid or expired verification token',
          },
          context.requestId
        );
      }

      // Check if token is an email verification token
      if (decoded.type !== 'email-verification') {
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: 'Invalid token type',
          },
          context.requestId
        );
      }

      // Get user
      const user = await UserService.findById(decoded.userId);
      if (!user) {
        return createErrorResponse(
          'RESOURCE_NOT_FOUND',
          {
            message: 'User not found',
          },
          context.requestId
        );
      }

      // Check if email is already verified
      if ((user as any).emailVerified) {
        return createSuccessResponse(
          {
            message: 'Email is already verified',
          },
          200,
          context.requestId
        );
      }

      // Mark email as verified
      // Note: This method needs to be implemented in UserService
      await (UserService as any).verifyEmail(user.id);

      logger.info('Email verified successfully', {
        userId: user.id,
        email: user.email,
        requestId: context.requestId,
      });

      return createSuccessResponse(
        {
          message: 'Email verified successfully',
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Email verification failed', error as Error, { requestId: context.requestId });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Email verification failed',
        },
        context.requestId
      );
    }
  }
);

// Resend verification email handler
const resendVerificationHandler = createSingleMethodHandler(
  'POST',
  {
    auth: {
      required: false, // Optional auth
      permissions: [],
    },
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 3, // Limit resend attempts
    },
    validation: {
      body: resendVerificationSchema,
    },
  },
  async ({ body, context, auth }) => {
    try {
      let user;

      // Get user either from auth context or email
      if (auth.user) {
        user = await UserService.findById(auth.user.id);
      } else if (body.email) {
        user = await UserService.findByEmail(body.email);
      } else {
        return createErrorResponse(
          'VALIDATION_ERROR',
          {
            message: 'Either authenticate or provide email address',
          },
          context.requestId
        );
      }

      if (!user) {
        // Don't reveal if user exists or not
        return createSuccessResponse(
          {
            message: 'If the email exists and is unverified, a verification email has been sent',
          },
          200,
          context.requestId
        );
      }

      // Check if email is already verified
      if ((user as any).emailVerified) {
        return createSuccessResponse(
          {
            message: 'Email is already verified',
          },
          200,
          context.requestId
        );
      }

      // Generate verification token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET environment variable is not set');
      }

      const verificationToken = sign(
        {
          userId: user.id,
          email: user.email,
          type: 'email-verification',
        },
        jwtSecret,
        {
          expiresIn: '24h',
          issuer: 'icodeai-api',
          audience: 'icodeai-users',
        }
      );

      // Send verification email
      const { sendEmailVerification } = await import('src/lib/email/email-manager').catch(() => ({
        sendEmailVerification: null,
      }));

      let emailResult: { success: boolean; error?: string } = {
        success: false,
        error: 'Email service not available',
      };

      if (sendEmailVerification) {
        emailResult = await sendEmailVerification(user.email, {
          name: user.name,
          verificationToken,
        });

        if (!emailResult.success) {
          logger.error(
            'Failed to send verification email',
            new Error(emailResult.error || 'Unknown error'),
            { userId: user.id }
          );
          // Don't fail the request - user can request resend
        }
      }

      logger.info('Verification email sent', {
        userId: user.id,
        email: user.email,
        emailSent: emailResult.success,
        requestId: context.requestId,
      });

      return createSuccessResponse(
        {
          message: 'If the email exists and is unverified, a verification email has been sent',
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Resend verification failed', error as Error, { requestId: context.requestId });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Failed to resend verification email',
        },
        context.requestId
      );
    }
  }
);

export const POST = verifyEmailHandler;

// Export resend handler as PUT method
export const PUT = resendVerificationHandler;
