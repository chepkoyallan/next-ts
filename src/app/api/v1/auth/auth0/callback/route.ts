// Auth0 callback endpoint
import { NextRequest } from 'next/server';

import { logger } from '../../../../lib/utils/logger';
import { AuthFactory } from '../../../../lib/auth/auth-factory';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../../lib/handlers/base';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Auth0 callback handler
const auth0CallbackHandler = createSingleMethodHandler(
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
      const errorDescription = searchParams.get('error_description');

      // Check for Auth0 error
      if (error) {
        logger.warn('Auth0 callback error', { error, errorDescription, state });
        return createErrorResponse(
          'UNAUTHORIZED',
          {
            message: `Auth0 authentication failed: ${errorDescription || error}`,
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

      // Get Auth0 provider
      const authProvider = AuthFactory.getProvider('auth0');

      // Exchange code for tokens
      const authResult = await authProvider.authenticate({
        token: code,
        provider: 'auth0',
      });

      logger.info('Auth0 authentication successful via callback', {
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
          message: 'Auth0 authentication successful',
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Auth0 callback failed', error as Error, { requestId: context.requestId });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Auth0 authentication failed',
          details: (error as Error).message,
        },
        context.requestId
      );
    }
  }
);

export const GET = auth0CallbackHandler;
