// Organization Members API - List and Add
import { z } from 'zod';

import { createApiHandler } from '../../../../lib/handlers/base';
import { commonSchemas } from '../../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { OrganizationService } from '../../../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';
import { OrganizationMemberService } from '../../../../lib/services/organization-member-service';

// Validation schemas
const paramsSchema = z.object({
  id: commonSchemas.id,
});

const addMemberSchema = z.object({
  userId: commonSchemas.id,
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
});

const querySchema = z.object({
  activeOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val !== 'false'),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'POST'],
    validation: {
      params: paramsSchema,
    },
  },
  {
    // List organization members
    GET: async ({ routeParams, context, auth, request }) => {
      try {
        const organizationId = routeParams.id;

        // Check if user has access to this organization
        const isMember = await OrganizationService.isMember(auth.user?.id || '', organizationId);
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        if (!isAdmin && !isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You do not have access to this organization',
            },
            context.requestId
          );
        }

        // Parse query parameters
        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());
        const { activeOnly } = querySchema.parse(queryParams);

        const members = await OrganizationMemberService.getMembers(organizationId, activeOnly);

        const roleCount = await OrganizationMemberService.getMemberCountByRole(organizationId);

        return createSuccessResponse(
          {
            members,
            total: members.length,
            roleCount,
          },
          200,
          context.requestId
        );
      } catch (error) {
        console.error('List members error:', error);
        console.error('Error details:', error instanceof Error ? error.message : error);
        console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch organization members',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          context.requestId
        );
      }
    },

    // Add member to organization
    POST: async ({ routeParams, body, context, auth }) => {
      try {
        const organizationId = routeParams.id;

        // Check if user has permission to add members
        const userRole = await OrganizationService.getUserRole(auth.user?.id || '', organizationId);
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');
        const canAddMembers = isAdmin || userRole === 'OWNER' || userRole === 'ADMIN';

        if (!canAddMembers) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You do not have permission to add members to this organization',
            },
            context.requestId
          );
        }

        const validationResult = addMemberSchema.safeParse(body);
        if (!validationResult.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              errors: validationResult.error.issues,
            },
            context.requestId
          );
        }

        const { userId, role } = validationResult.data;

        // Non-OWNER members cannot add OWNER role
        if (role === 'OWNER' && userRole !== 'OWNER' && !isAdmin) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'Only organization owners can assign the OWNER role',
            },
            context.requestId
          );
        }

        // ADMIN cannot add ADMIN role unless they are OWNER
        if (role === 'ADMIN' && userRole === 'ADMIN' && !isAdmin) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'Only organization owners can add other administrators',
            },
            context.requestId
          );
        }

        const member = await OrganizationMemberService.addMember({
          organizationId,
          userId,
          role,
          invitedBy: auth.user?.id,
        });

        return createSuccessResponse(member, 201, context.requestId);
      } catch (error) {
        console.error('Add member error:', error);

        if (error instanceof Error && error.message.includes('already a member')) {
          return createErrorResponse(
            'RESOURCE_ALREADY_EXISTS',
            {
              message: error.message,
            },
            context.requestId
          );
        }

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to add member to organization',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
