/**
 * Resend Email Verification Endpoint
 * Allows users to request a new verification email
 */

import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { logger } from 'src/app/api/lib/utils/logger';
import { authMiddleware } from 'src/app/api/lib/middleware/auth';
import { emailService } from 'src/app/api/lib/services/email-service';
import { tempStorage } from 'src/app/api/lib/redis/temp-storage-service';

/**
 * POST /api/v1/auth/resend-verification
 * Resend verification email to authenticated user
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await authMiddleware(request);

    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const user = await prisma.user.findUnique({
      where: { id: authContext.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email is already verified',
        },
        { status: 400 }
      );
    }

    // Generate new verification token
    const token = randomBytes(32).toString('hex');

    // Store token in Redis (24 hour expiry)
    await tempStorage.set(
      `email-verify:${token}`,
      {
        userId: user.id,
        email: user.email,
        createdAt: new Date().toISOString(),
      },
      86400 // 24 hours
    );

    // Send verification email
    await emailService.sendVerificationEmail(user.email, token, user.name);

    logger.info('Verification email resent', {
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'Verification email sent successfully',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Resend verification error', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend verification email',
      },
      { status: 500 }
    );
  }
}
