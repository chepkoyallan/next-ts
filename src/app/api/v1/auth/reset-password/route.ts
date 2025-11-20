/**
 * Reset Password Endpoint
 * Verifies token and updates user password
 */

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { logger } from 'src/app/api/lib/utils/logger';
import { tempStorage } from 'src/app/api/lib/redis/temp-storage-service';

const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

/**
 * POST /api/v1/auth/reset-password
 * Reset password using token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = ResetPasswordSchema.parse(body);

    // Retrieve token data from Redis
    const data = (await tempStorage.get(`password-reset:${validatedData.token}`, true)) as {
      userId: string;
      email: string;
    } | null;

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired reset token',
        },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10);

    // Update user password
    const user = await prisma.user.update({
      where: { id: data.userId || '' },
      data: {
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    logger.info('Password reset successful', {
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'Password has been reset successfully',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
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

    logger.error('Reset password error', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset password',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/auth/reset-password
 * Verify if a reset token is valid
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Token is required',
        },
        { status: 400 }
      );
    }

    // Check if token exists in Redis
    const data = (await tempStorage.get(`password-reset:${token}`, false)) as {
      userId: string;
      email: string;
    } | null;

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired reset token',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          valid: true,
          email: data.email || '',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Verify reset token error', error as Error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify token',
      },
      { status: 500 }
    );
  }
}
