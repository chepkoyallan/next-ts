/**
 * GitHub OAuth Authorization Endpoint
 * Redirects user to GitHub OAuth consent screen
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
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) {
      logger.error('GITHUB_CLIENT_ID not configured');
      return Response.json({ error: 'OAuth not configured' }, { status: 500 });
    }

    // ✅ SECURITY: Generate server-side state for CSRF protection
    const serverState = await StateManager.create(
      undefined,
      clientState ?? undefined,
      codeChallenge ?? undefined
    );

    logger.info('GitHub OAuth authorization initiated', {
      redirectUri,
      hasCodeChallenge: !!codeChallenge,
      state: `${serverState.substring(0, 10)}...`,
    });

    // Build GitHub OAuth URL
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', clientId);
    githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubAuthUrl.searchParams.set('scope', 'read:user user:email');
    githubAuthUrl.searchParams.set('state', serverState);

    // ✅ SECURITY: Add PKCE if provided by client
    if (codeChallenge && codeChallengeMethod === 'S256') {
      githubAuthUrl.searchParams.set('code_challenge', codeChallenge);
      githubAuthUrl.searchParams.set('code_challenge_method', codeChallengeMethod);
      logger.info('PKCE enabled for GitHub OAuth', {
        state: `${serverState.substring(0, 10)}...`,
      });
    }

    // Redirect to GitHub
    return Response.redirect(githubAuthUrl.toString());
  } catch (error) {
    logger.error('GitHub OAuth authorization failed', error as Error);
    return Response.json({ error: 'Failed to initiate OAuth flow' }, { status: 500 });
  }
}
