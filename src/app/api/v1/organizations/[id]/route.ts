// Individual Organization API endpoint
import { z } from 'zod';

import { createApiHandler } from '../../../lib/handlers/base';
import { commonSchemas } from '../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { OrganizationService } from '../../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const paramsSchema = z.object({
  id: commonSchemas.id,
});

const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional().nullable(),
  website: z.string().url().optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional().nullable(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION', 'DELETED']).optional(),
  ownerId: commonSchemas.id.optional().nullable(),
  settings: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'PUT', 'DELETE'],
    validation: {
      params: paramsSchema,
    },
  },
  {
    // Get single organization
    GET: async ({ routeParams, context, auth }) => {
      try {
        const organization = await OrganizationService.findById(routeParams.id);

        if (!organization) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'organization',
              id: routeParams.id,
            },
            context.requestId
          );
        }

        // Check if user has access to this organization
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        const isMember = await OrganizationService.isMember(auth.user?.id || '', routeParams.id);

        if (!isAdmin && !isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You do not have access to this organization',
            },
            context.requestId
          );
        }

        // Get organization stats
        const stats = await OrganizationService.getStats(routeParams.id);

        return createSuccessResponse(
          {
            ...organization,
            stats,
          },
          200,
          context.requestId
        );
      } catch (error) {
        console.error('Get organization error:', error);
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch organization',
          },
          context.requestId
        );
      }
    },

    // Update organization
    PUT: async ({ routeParams, body, context, auth }) => {
      try {
        const existingOrg = await OrganizationService.findById(routeParams.id);

        if (!existingOrg) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'organization',
              id: routeParams.id,
            },
            context.requestId
          );
        }

        // Check permissions
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        const userRole = await OrganizationService.getUserRole(auth.user?.id || '', routeParams.id);
        const isOwnerOrAdmin = userRole === 'OWNER' || userRole === 'ADMIN';

        if (!isAdmin && !isOwnerOrAdmin) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You do not have permission to update this organization',
            },
            context.requestId
          );
        }

        const validationResult = updateOrganizationSchema.safeParse(body);
        if (!validationResult.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              errors: validationResult.error.issues,
            },
            context.requestId
          );
        }

        // Only system admins can change status and ownerId
        const updateData = { ...validationResult.data };
        if (!isAdmin) {
          delete updateData.status;
          delete updateData.ownerId;
        }

        const updatedOrg = await OrganizationService.update(routeParams.id, updateData);

        if (!updatedOrg) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'organization',
              id: routeParams.id,
            },
            context.requestId
          );
        }

        return createSuccessResponse(updatedOrg, 200, context.requestId);
      } catch (error) {
        console.error('Update organization error:', error);

        if (error instanceof Error && error.message.includes('already exists')) {
          return createErrorResponse(
            'RESOURCE_ALREADY_EXISTS',
            {
              field: 'slug',
              message: error.message,
            },
            context.requestId
          );
        }

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to update organization',
          },
          context.requestId
        );
      }
    },

    // Delete organization
    DELETE: async ({ routeParams, context, auth }) => {
      try {
        const organization = await OrganizationService.findById(routeParams.id);

        if (!organization) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'organization',
              id: routeParams.id,
            },
            context.requestId
          );
        }

        // Only system admins or organization owners can delete
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        const userRole = await OrganizationService.getUserRole(auth.user?.id || '', routeParams.id);
        const isOwner = userRole === 'OWNER';

        if (!isAdmin && !isOwner) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'Only organization owners or system administrators can delete organizations',
            },
            context.requestId
          );
        }

        // Soft delete the organization
        await OrganizationService.delete(routeParams.id);

        return createSuccessResponse(
          { message: 'Organization deleted successfully', id: routeParams.id },
          200,
          context.requestId
        );
      } catch (error) {
        console.error('Delete organization error:', error);
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to delete organization',
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
