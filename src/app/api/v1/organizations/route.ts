// Organizations API - List and Create
import { z } from 'zod';
import { NextRequest } from 'next/server';

import { createApiHandler } from '../../lib/handlers/base';
import { commonSchemas } from '../../lib/utils/validation';
import { rateLimitConfigs } from '../../lib/middleware/rate-limit';
import { OrganizationService } from '../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../lib/utils/response';

// Validation schemas
const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  website: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val) return null;
      // Add https:// if no protocol specified
      if (!/^https?:\/\//i.test(val)) {
        return `https://${val}`;
      }
      return val;
    }),
  industry: z.string().max(100).optional().nullable(),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional().nullable(),
  ownerId: commonSchemas.id.optional(),
  settings: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const listOrganizationsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_DELETION', 'DELETED']).optional(),
  industry: z.string().optional(),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']).optional(),
  ownerId: commonSchemas.id.optional(),
  search: z.string().optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'POST'],
  },
  {
    // List organizations
    GET: async ({ context, auth, request }) => {
      try {
        // Parse query parameters
        const url = new URL((request as NextRequest).url);
        const queryParams = Object.fromEntries(url.searchParams.entries());

        const validationResult = listOrganizationsSchema.safeParse(queryParams);
        if (!validationResult.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              errors: validationResult.error.issues,
            },
            context.requestId
          );
        }

        const { page, limit, status, industry, size, ownerId, search } = validationResult.data;

        // Check if user is admin
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        // Non-admin users can only see their own organizations
        const filters: any = {
          ...(status && { status }),
          ...(industry && { industry }),
          ...(size && { size }),
          ...(search && { search }),
        };

        // If not admin, filter by user's organizations
        if (!isAdmin) {
          filters.ownerId = auth.user?.id;
        } else if (ownerId) {
          filters.ownerId = ownerId;
        }

        const result = await OrganizationService.list(filters, page, limit);

        return createSuccessResponse(
          {
            organizations: result.organizations,
            pagination: {
              page,
              limit,
              total: result.total,
              pages: result.pages,
            },
          },
          200,
          context.requestId
        );
      } catch (error) {
        console.error('List organizations error:', error);
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch organizations',
          },
          context.requestId
        );
      }
    },

    // Create organization
    POST: async ({ body, context, auth }) => {
      try {
        console.log('Create organization request body:', JSON.stringify(body, null, 2));
        const validationResult = createOrganizationSchema.safeParse(body);
        if (!validationResult.success) {
          console.error('Validation failed:');
          console.error(validationResult.error.issues);
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              errors: validationResult.error.issues,
              message: 'Validation failed',
            },
            context.requestId
          );
        }

        const { data } = validationResult;

        // If ownerId is not provided, use the authenticated user
        if (!data.ownerId) {
          data.ownerId = auth.user?.id;
        }

        // Check permissions: users can create orgs for themselves, admins can create for anyone
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        if (!isAdmin && data.ownerId !== auth.user?.id) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You can only create organizations for yourself',
            },
            context.requestId
          );
        }

        const organization = await OrganizationService.create(data);

        return createSuccessResponse(organization, 201, context.requestId);
      } catch (error) {
        console.error('Create organization error:', error);

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
            message: 'Failed to create organization',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
