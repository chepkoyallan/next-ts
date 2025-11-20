// Individual user API endpoint
import { z } from 'zod';

import { createApiHandler } from '../../../lib/handlers/base';
import { commonSchemas } from '../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
// Import user service for database operations
import { UserService } from '../../../lib/services/user-service-prisma';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const paramsSchema = z.object({
  id: commonSchemas.id,
});

const updateUserSchema = z.object({
  email: commonSchemas.email.optional(),
  name: commonSchemas.name.optional(),
  role: z.enum(['user', 'admin', 'moderator']).optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
      permissions: ['users:read', 'users:write'],
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'PUT', 'DELETE'],
    validation: {
      params: paramsSchema,
      body: updateUserSchema,
    },
  },
  {
    // Get single user
    GET: async ({ routeParams, context, auth }) => {
      try {
        const user = await UserService.findById(routeParams.id);

        if (!user) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'user',
              id: routeParams.id,
            },
            context.requestId
          );
        }

        // Check if user can access this user's data
        const isAdmin =
          auth.user?.roles?.includes('admin') || auth.user?.roles?.includes('system-admin');
        if (!isAdmin && auth.user?.id !== user.id) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You can only access your own user data',
            },
            context.requestId
          );
        }

        return createSuccessResponse(user, 200, context.requestId);
      } catch {
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch user',
          },
          context.requestId
        );
      }
    },

    // Update user
    PUT: async ({ routeParams, body, context, auth }) => {
      try {
        const existingUser = await UserService.findById(routeParams.id);

        if (!existingUser) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'user',
              id: routeParams.id,
            },
            context.requestId
          );
        }

        // Check permissions
        const isAdmin =
          auth.user?.roles?.includes('admin') || auth.user?.roles?.includes('system-admin');
        if (!isAdmin && auth.user?.id !== existingUser.id) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You can only update your own user data',
            },
            context.requestId
          );
        }

        const updatedUser = await UserService.update(routeParams.id, {
          email: body.email,
          name: body.name,
          role: body.role,
        });

        if (!updatedUser) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'user',
              id: routeParams.id,
            },
            context.requestId
          );
        }

        return createSuccessResponse(updatedUser, 200, context.requestId);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          return createErrorResponse(
            'RESOURCE_ALREADY_EXISTS',
            {
              field: 'email',
              value: body.email,
            },
            context.requestId
          );
        }

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to update user',
          },
          context.requestId
        );
      }
    },

    // Delete user
    DELETE: async ({ routeParams, context, auth }) => {
      try {
        const user = await UserService.findById(routeParams.id);

        if (!user) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'user',
              id: routeParams.id,
            },
            context.requestId
          );
        }

        // Only admins can delete users, or users can delete themselves
        const isAdmin =
          auth.user?.roles?.includes('admin') || auth.user?.roles?.includes('system-admin');
        if (!isAdmin && auth.user?.id !== user.id) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'Insufficient permissions to delete this user',
            },
            context.requestId
          );
        }

        // Delete the user (soft delete)
        await UserService.delete(routeParams.id);

        // Verify the user was deleted by checking if it still exists
        const deletedUser = await UserService.findById(routeParams.id);
        if (deletedUser && !(deletedUser as any).deletedAt) {
          return createErrorResponse(
            'INTERNAL_SERVER_ERROR',
            {
              message: 'Failed to delete user',
            },
            context.requestId
          );
        }

        return createSuccessResponse(
          { message: 'User deleted successfully', id: routeParams.id },
          200,
          context.requestId
        );
      } catch {
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to delete user',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
