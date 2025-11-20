/**
 * Forgot Password Endpoint
 * Generates a password reset token and sends reset email
 */

import { z } from 'zod';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { logger } from 'src/app/api/lib/utils/logger';
import { emailService } from 'src/app/api/lib/services/email-service';
import { tempStorage } from 'src/app/api/lib/redis/temp-storage-service';

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * POST /api/v1/auth/forgot-password
 * Request a password reset email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = ForgotPasswordSchema.parse(body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Generate reset token
      const token = randomBytes(32).toString('hex');

      // Store token in Redis (1 hour expiry)
      await tempStorage.set(
        `password-reset:${token}`,
        {
          userId: user.id,
          email: user.email,
          createdAt: new Date().toISOString(),
        },
        3600 // 1 hour
      );

      // Send reset email
      await emailService.sendPasswordResetEmail(user.email, token, user.name);

      logger.info('Password reset email sent', {
        userId: user.id,
        email: user.email,
      });
    } else {
      logger.warn('Password reset requested for non-existent email', {
        email: validatedData.email,
      });
    }

    // Always return success to prevent email enumeration
    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'If an account exists with this email, a password reset link has been sent',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    logger.error('Forgot password error', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process password reset request',
      },
      { status: 500 }
    );
  }
}
