/**
 * Google OAuth Callback Endpoint
 * Handles OAuth callback, exchanges code for tokens, creates/updates user
 */

import { sign } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

import { SessionStore } from '@app/cache';
import type { SessionData } from '@app/cache';
import { logger } from 'src/app/api/lib/utils/logger';
import { StateManager } from 'src/auth/oauth/state-manager';
import { UserService } from 'src/app/api/lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from 'src/app/api/lib/utils/response';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state, code_verifier } = body;

    // ✅ SECURITY: Validate state parameter
    if (!state || !(await StateManager.validate(state))) {
      logger.warn('Invalid or expired OAuth state', { state: state?.substring(0, 10) });
      return createErrorResponse('UNAUTHORIZED', {
        message: 'Invalid or expired state parameter. Possible CSRF attack detected.',
      });
    }

    // Validate authorization code
    if (!code) {
      return createErrorResponse('VALIDATION_ERROR', {
        message: 'Authorization code is required',
      });
    }

    // Validate environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl =
      process.env.GOOGLE_CALLBACK_URL || `${process.env.NEXT_PUBLIC_APP_URL}/auth/google/callback`;

    if (!clientId || !clientSecret) {
      logger.error('Google OAuth not properly configured');
      return createErrorResponse('INTERNAL_SERVER_ERROR', {
        message: 'OAuth not configured',
      });
    }

    // ✅ SECURITY: Exchange authorization code for tokens
    const tokenRequestBody: any = {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: 'authorization_code',
    };

    // ✅ SECURITY: Include code_verifier if PKCE was used
    if (code_verifier) {
      tokenRequestBody.code_verifier = code_verifier;
      logger.info('PKCE code_verifier included in token exchange');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenRequestBody),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => ({}));
      logger.error('Failed to exchange code for tokens', undefined, { errorData: error });
      return createErrorResponse('UNAUTHORIZED', {
        message: 'Failed to exchange authorization code',
        details: error.error_description || error.error,
      });
    }

    const tokens = await tokenResponse.json();

    // Get user profile from Google
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileResponse.ok) {
      logger.error('Failed to fetch Google profile');
      return createErrorResponse('UNAUTHORIZED', {
        message: 'Failed to fetch user profile',
      });
    }

    const profile = await profileResponse.json();

    logger.info('Google OAuth profile fetched', {
      email: profile.email,
      verified: profile.verified_email,
    });

    // Find or create user
    let user = await UserService.findByEmail(profile.email);

    if (!user) {
      // Create new user from OAuth profile
      user = await UserService.create({
        email: profile.email,
        name: profile.name || profile.given_name || 'User',
        // OAuth users don't need password
        password: randomUUID(), // Random password (user won't use it)
        role: 'user',
      });

      // Mark email as verified (Google verified it)
      if (profile.verified_email) {
        await (UserService as any).verifyEmail(user.id);
      }

      // Store OAuth provider info
      await (UserService as any).updateProfile(user.id, {
        photoURL: profile.picture,
        authProvider: 'google',
        authProviderId: profile.id,
      });

      logger.info('New user created from Google OAuth', {
        userId: user.id,
        email: user.email,
      });
    } else {
      // Update existing user with OAuth info
      await (UserService as any).updateProfile(user.id, {
        photoURL: profile.picture || (user as any).photoURL,
        authProvider: 'google',
        authProviderId: profile.id,
      });

      logger.info('Existing user authenticated via Google OAuth', {
        userId: user.id,
        email: user.email,
      });
    }

    // ✅ Generate JWT tokens
    const jwtSecret = process.env.JWT_SECRET!;
    const jti = randomUUID();
    const refreshJti = randomUUID();

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
        expiresIn: '15m',
        issuer: 'icodeai-api',
        audience: 'icodeai-users',
      }
    );

    const refreshToken = sign(
      {
        userId: user.id,
        email: user.email,
        type: 'refresh',
        jti: refreshJti,
      },
      jwtSecret,
      {
        expiresIn: '7d',
        issuer: 'icodeai-api',
        audience: 'icodeai-users',
      }
    );

    // ✅ Create session
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
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    await SessionStore.create(sessionData, 7 * 24 * 60 * 60).catch((err) => {
      logger.error('Failed to create session', err);
    });

    // ✅ Set HTTPOnly cookies
    const cookieStore = cookies();
    const isProduction = process.env.NODE_ENV === 'production';

    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60,
      path: '/',
    });

    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/api/v1/auth/refresh',
    });

    logger.info('Google OAuth authentication successful', {
      userId: user.id,
      email: user.email,
    });

    // Return user data (without tokens in body)
    return createSuccessResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: (user as any).roles || [user.role],
        permissions: (user as any).permissions,
        emailVerified: (user as any).emailVerified,
        photoURL: (user as any).photoURL,
      },
      message: 'Google authentication successful',
    });
  } catch (error) {
    logger.error('Google OAuth callback failed', error as Error);

    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'OAuth authentication failed',
      details: (error as Error).message,
    });
  }
}
