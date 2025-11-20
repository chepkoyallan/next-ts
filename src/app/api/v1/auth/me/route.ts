// Get current user profile endpoint
import { logger } from '../../../lib/utils/logger';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../../../lib/handlers/base';
import { UserService } from '../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Get current user handler
const getCurrentUserHandler = createSingleMethodHandler(
  'GET',
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
  },
  async ({ auth, context }) => {
    try {
      const userId = auth.user!.id;

      // Fetch latest user data from database
      const user = await UserService.findById(userId);

      if (!user) {
        return createErrorResponse(
          'RESOURCE_NOT_FOUND',
          {
            message: 'User not found',
          },
          context.requestId
        );
      }

      // Return current user information with latest data from database
      return createSuccessResponse(
        {
          user,
          lastLogin: new Date().toISOString(),
          sessionInfo: {
            requestId: context.requestId,
            timestamp: context.timestamp,
          },
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Failed to get current user', error as Error, {
        userId: auth.user?.id,
        requestId: context.requestId,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Failed to get user information',
        },
        context.requestId
      );
    }
  }
);

export const GET = getCurrentUserHandler;
