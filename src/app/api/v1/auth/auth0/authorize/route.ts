// Auth0 authorization redirect endpoint
import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { logger } from '../../../../lib/utils/logger';
import { createErrorResponse } from '../../../../lib/utils/response';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../../lib/handlers/base';
import { Auth0Provider } from '../../../../lib/auth/providers/auth0-provider';

// Auth0 authorization handler
const auth0AuthorizeHandler = createSingleMethodHandler(
  'GET',
  {
    rateLimit: rateLimitConfigs.standard,
  },
  async ({ context }) => {
    try {
      const domain = process.env.AUTH0_DOMAIN;
      const clientId = process.env.AUTH0_CLIENT_ID;
      const clientSecret = process.env.AUTH0_CLIENT_SECRET;
      const redirectUri = process.env.AUTH0_REDIRECT_URI;

      if (!domain || !clientId || !clientSecret || !redirectUri) {
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Auth0 not configured',
          },
          context.requestId
        );
      }

      // Create Auth0 provider
      const provider = new Auth0Provider(domain, clientId, {
        clientSecret,
        redirectUri,
      });

      // Generate random state for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');

      // Get authorization URL
      const authUrl = provider.getAuthorizationUrl(state);

      logger.info('Auth0 authorization initiated', {
        state,
        requestId: context.requestId,
      });

      // Redirect to Auth0
      return NextResponse.redirect(authUrl);
    } catch (error) {
      logger.error('Auth0 authorization failed', error as Error, {
        requestId: context.requestId,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Failed to initiate Auth0 authorization',
        },
        context.requestId
      );
    }
  }
);

export const GET = auth0AuthorizeHandler;
