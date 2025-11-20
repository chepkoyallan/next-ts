// OAuth2 callback endpoint
import { NextRequest } from 'next/server';

import { logger } from '../../../../lib/utils/logger';
import { AuthFactory } from '../../../../lib/auth/auth-factory';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../../lib/handlers/base';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// OAuth2 callback handler
const oauth2CallbackHandler = createSingleMethodHandler(
  'GET',
  {
    rateLimit: rateLimitConfigs.standard,
  },
  async ({ context, request }) => {
    try {
      const { searchParams } = new URL((request as NextRequest).url);
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      // Check for OAuth error
      if (error) {
        logger.warn('OAuth2 callback error', { error, state });
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: `OAuth2 authentication failed: ${error}`,
          },
          context.requestId
        );
      }

      // Validate authorization code
      if (!code) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          {
            message: 'Authorization code is required',
          },
          context.requestId
        );
      }

      // Get OAuth2 provider
      const authProvider = AuthFactory.getProvider('oauth2');

      // Exchange code for tokens
      const authResult = await authProvider.authenticate({
        token: code,
        provider: 'oauth2',
      });

      logger.info('OAuth2 authentication successful via callback', {
        userId: authResult.user.id,
        email: authResult.user.email,
        state,
        requestId: context.requestId,
      });

      // Return tokens
      return createSuccessResponse(
        {
          user: authResult.user,
          token: authResult.accessToken,
          refreshToken: authResult.refreshToken,
          expiresIn: authResult.expiresIn,
          tokenType: 'Bearer',
          message: 'OAuth2 authentication successful',
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('OAuth2 callback failed', error as Error, { requestId: context.requestId });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'OAuth2 authentication failed',
          details: (error as Error).message,
        },
        context.requestId
      );
    }
  }
);

export const GET = oauth2CallbackHandler;
