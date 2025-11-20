// OAuth2 authorization redirect endpoint
import crypto from 'crypto';
import { NextResponse } from 'next/server';

import { logger } from '../../../../lib/utils/logger';
import { createErrorResponse } from '../../../../lib/utils/response';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../../lib/handlers/base';
import { OAuth2Provider } from '../../../../lib/auth/providers/oauth2-provider';

// OAuth2 authorization handler
const oauth2AuthorizeHandler = createSingleMethodHandler(
  'GET',
  {
    rateLimit: rateLimitConfigs.standard,
  },
  async ({ context }) => {
    try {
      const clientId = process.env.OAUTH2_CLIENT_ID;
      const clientSecret = process.env.OAUTH2_CLIENT_SECRET;
      const redirectUri = process.env.OAUTH2_REDIRECT_URI;

      if (!clientId || !clientSecret || !redirectUri) {
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'OAuth2 not configured',
          },
          context.requestId
        );
      }

      // Create OAuth2 provider
      const provider = new OAuth2Provider(clientId, clientSecret, redirectUri);

      // Generate random state for CSRF protection
      const state = crypto.randomBytes(32).toString('hex');

      // Get authorization URL
      const authUrl = provider.getAuthorizationUrl(state);

      logger.info('OAuth2 authorization initiated', {
        state,
        requestId: context.requestId,
      });

      // Redirect to OAuth2 provider
      return NextResponse.redirect(authUrl);
    } catch (error) {
      logger.error('OAuth2 authorization failed', error as Error, {
        requestId: context.requestId,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Failed to initiate OAuth2 authorization',
        },
        context.requestId
      );
    }
  }
);

export const GET = oauth2AuthorizeHandler;
