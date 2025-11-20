/**
 * Google OAuth Authorization Endpoint
 * Redirects user to Google OAuth consent screen
 */

import { NextRequest } from 'next/server';

import { logger } from 'src/app/api/lib/utils/logger';
import { StateManager } from 'src/auth/oauth/state-manager';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const redirectUri = searchParams.get('redirect_uri');
    const clientState = searchParams.get('state');
    const codeChallenge = searchParams.get('code_challenge');
    const codeChallengeMethod = searchParams.get('code_challenge_method');

    if (!redirectUri) {
      return Response.json({ error: 'redirect_uri is required' }, { status: 400 });
    }

    // Validate environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      logger.error('GOOGLE_CLIENT_ID not configured');
      return Response.json({ error: 'OAuth not configured' }, { status: 500 });
    }

    // ✅ SECURITY: Generate server-side state for CSRF protection
    const serverState = await StateManager.create(
      undefined, // userId (unknown at this point)
      clientState ?? undefined, // Store client's state to return later
      codeChallenge ?? undefined // Store code challenge for validation
    );

    logger.info('Google OAuth authorization initiated', {
      redirectUri,
      hasCodeChallenge: !!codeChallenge,
      state: `${serverState.substring(0, 10)}...`,
    });

    // Build Google OAuth URL
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', serverState);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');

    // ✅ SECURITY: Add PKCE if provided by client
    if (codeChallenge && codeChallengeMethod === 'S256') {
      googleAuthUrl.searchParams.set('code_challenge', codeChallenge);
      googleAuthUrl.searchParams.set('code_challenge_method', codeChallengeMethod);
      logger.info('PKCE enabled for Google OAuth', {
        state: `${serverState.substring(0, 10)}...`,
      });
    }

    // Redirect to Google
    return Response.redirect(googleAuthUrl.toString());
  } catch (error) {
    logger.error('Google OAuth authorization failed', error as Error);
    return Response.json({ error: 'Failed to initiate OAuth flow' }, { status: 500 });
  }
}
