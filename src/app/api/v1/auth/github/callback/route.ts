/**
 * GitHub OAuth Callback Endpoint
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

    if (!code) {
      return createErrorResponse('VALIDATION_ERROR', {
        message: 'Authorization code is required',
      });
    }

    // Validate environment variables
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error('GitHub OAuth not properly configured');
      return createErrorResponse('INTERNAL_SERVER_ERROR', {
        message: 'OAuth not configured',
      });
    }

    // ✅ SECURITY: Exchange authorization code for token
    const tokenRequestBody: any = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    };

    if (code_verifier) {
      tokenRequestBody.code_verifier = code_verifier;
      logger.info('PKCE code_verifier included in token exchange');
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
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

    if (tokens.error) {
      logger.error('GitHub token exchange error', undefined, { tokenError: tokens.error });
      return createErrorResponse('UNAUTHORIZED', {
        message: tokens.error_description || tokens.error,
      });
    }

    // Get user profile from GitHub
    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: 'application/json',
      },
    });

    if (!profileResponse.ok) {
      logger.error('Failed to fetch GitHub profile');
      return createErrorResponse('UNAUTHORIZED', {
        message: 'Failed to fetch user profile',
      });
    }

    const profile = await profileResponse.json();

    // Get user email (GitHub may not include it in profile)
    let { email } = profile;
    if (!email) {
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        const primaryEmail = emails.find((e: any) => e.primary);
        email = primaryEmail?.email || emails[0]?.email;
      }
    }

    if (!email) {
      return createErrorResponse('VALIDATION_ERROR', {
        message: 'Email is required. Please make your email public on GitHub.',
      });
    }

    logger.info('GitHub OAuth profile fetched', {
      email,
      login: profile.login,
      verified: !!profile.email,
    });

    // Find or create user
    let user = await UserService.findByEmail(email);

    if (!user) {
      // Create new user from OAuth profile
      user = await UserService.create({
        email,
        name: profile.name || profile.login || 'User',
        password: randomUUID(), // Random password (user won't use it)
        role: 'user',
      });

      // Mark email as verified if GitHub verified it
      const verifiedEmail = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      })
        .then((r) => r.json())
        .then((emails) => emails.find((e: any) => e.email === email && e.verified))
        .catch(() => null);

      if (verifiedEmail) {
        await (UserService as any).verifyEmail(user.id);
      }

      // Store OAuth provider info
      await (UserService as any).updateProfile(user.id, {
        photoURL: profile.avatar_url,
        authProvider: 'github',
        authProviderId: profile.id.toString(),
      });

      logger.info('New user created from GitHub OAuth', {
        userId: user.id,
        email,
      });
    } else {
      // Update existing user with OAuth info
      await (UserService as any).updateProfile(user.id, {
        photoURL: profile.avatar_url || (user as any).photoURL,
        authProvider: 'github',
        authProviderId: profile.id.toString(),
      });

      logger.info('Existing user authenticated via GitHub OAuth', {
        userId: user.id,
        email,
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

    logger.info('GitHub OAuth authentication successful', {
      userId: user.id,
      email,
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
      message: 'GitHub authentication successful',
    });
  } catch (error) {
    logger.error('GitHub OAuth callback failed', error as Error);

    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'OAuth authentication failed',
      details: (error as Error).message,
    });
  }
}
