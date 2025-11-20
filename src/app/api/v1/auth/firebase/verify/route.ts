// Firebase token verification endpoint
import { z } from 'zod';

import { logger } from '../../../../lib/utils/logger';
import { AuthFactory } from '../../../../lib/auth/auth-factory';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../../lib/handlers/base';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Firebase token verification schema
const firebaseVerifySchema = z.object({
  idToken: z.string().min(1, 'Firebase ID token is required'),
});

// Firebase verification handler
const firebaseVerifyHandler = createSingleMethodHandler(
  'POST',
  {
    rateLimit: rateLimitConfigs.standard,
    validation: {
      body: firebaseVerifySchema,
    },
  },
  async ({ body, context }) => {
    const { idToken } = body;

    try {
      // Get Firebase provider
      const authProvider = AuthFactory.getProvider('firebase');

      // Verify Firebase ID token and authenticate
      const authResult = await authProvider.authenticate({
        token: idToken,
        provider: 'firebase',
      });

      logger.info('Firebase authentication successful', {
        userId: authResult.user.id,
        email: authResult.user.email,
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
          message: 'Firebase authentication successful',
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Firebase verification failed', error as Error, {
        requestId: context.requestId,
      });

      return createErrorResponse(
        'UNAUTHORIZED',
        {
          message: 'Firebase authentication failed',
          details: (error as Error).message,
        },
        context.requestId
      );
    }
  }
);

export const POST = firebaseVerifyHandler;
