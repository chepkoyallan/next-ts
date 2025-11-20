// Individual Organization Member API endpoint
import { z } from 'zod';

import { createApiHandler } from '../../../../../lib/handlers/base';
import { commonSchemas } from '../../../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../../../lib/middleware/rate-limit';
import { OrganizationService } from '../../../../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../../../../lib/utils/response';
import { OrganizationMemberService } from '../../../../../lib/services/organization-member-service';

// Validation schemas
const paramsSchema = z.object({
  id: commonSchemas.id,
  memberId: commonSchemas.id,
});

const updateMemberSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
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
    // Get single member
    GET: async ({ routeParams, context, auth }) => {
      try {
        const { id: organizationId, memberId } = routeParams;

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

        const member = await OrganizationMemberService.getMember(memberId);

        if (!member || member.organizationId !== organizationId) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'member',
              id: memberId,
            },
            context.requestId
          );
        }

        return createSuccessResponse(member, 200, context.requestId);
      } catch (error) {
        console.error('Get member error:', error);
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch member',
          },
          context.requestId
        );
      }
    },

    // Update member
    PUT: async ({ routeParams, body, context, auth }) => {
      try {
        const { id: organizationId, memberId } = routeParams;

        // Get current member to check permissions
        const member = await OrganizationMemberService.getMember(memberId);

        if (!member || member.organizationId !== organizationId) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'member',
              id: memberId,
            },
            context.requestId
          );
        }

        // Check if user can manage this member
        const canManage = await OrganizationMemberService.canManageMember(
          auth.user?.id || '',
          organizationId,
          memberId
        );
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        if (!isAdmin && !canManage) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You do not have permission to update this member',
            },
            context.requestId
          );
        }

        const validationResult = updateMemberSchema.safeParse(body);
        if (!validationResult.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              errors: validationResult.error.issues,
            },
            context.requestId
          );
        }

        const { role, isActive } = validationResult.data;

        // Additional permission checks for role changes
        if (role) {
          const userRole = await OrganizationService.getUserRole(
            auth.user?.id || '',
            organizationId
          );

          // Only OWNER can assign OWNER role
          if (role === 'OWNER' && userRole !== 'OWNER' && !isAdmin) {
            return createErrorResponse(
              'FORBIDDEN',
              {
                message: 'Only organization owners can assign the OWNER role',
              },
              context.requestId
            );
          }

          // ADMIN cannot promote to ADMIN unless they are OWNER
          if (role === 'ADMIN' && userRole === 'ADMIN' && !isAdmin) {
            return createErrorResponse(
              'FORBIDDEN',
              {
                message: 'Only organization owners can promote members to administrator',
              },
              context.requestId
            );
          }
        }

        const updatedMember = await OrganizationMemberService.updateMember(memberId, {
          role,
          isActive,
        });

        return createSuccessResponse(updatedMember, 200, context.requestId);
      } catch (error) {
        console.error('Update member error:', error);
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to update member',
          },
          context.requestId
        );
      }
    },

    // Remove member
    DELETE: async ({ routeParams, context, auth }) => {
      try {
        const { id: organizationId, memberId } = routeParams;

        // Get current member to check permissions
        const member = await OrganizationMemberService.getMember(memberId);

        if (!member || member.organizationId !== organizationId) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            {
              resource: 'member',
              id: memberId,
            },
            context.requestId
          );
        }

        // Check if user can manage this member
        const canManage = await OrganizationMemberService.canManageMember(
          auth.user?.id || '',
          organizationId,
          memberId
        );
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        // Users can remove themselves
        const isSelf = member.userId === auth.user?.id;

        if (!isAdmin && !canManage && !isSelf) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You do not have permission to remove this member',
            },
            context.requestId
          );
        }

        // Cannot remove the last OWNER
        if (member.role === 'OWNER') {
          const roleCount = await OrganizationMemberService.getMemberCountByRole(organizationId);
          if (roleCount.OWNER <= 1) {
            return createErrorResponse(
              'VALIDATION_ERROR',
              {
                message: 'Cannot remove the last owner of the organization',
              },
              context.requestId
            );
          }
        }

        // Soft delete (deactivate)
        await OrganizationMemberService.removeMember(memberId);

        return createSuccessResponse(
          { message: 'Member removed successfully', id: memberId },
          200,
          context.requestId
        );
      } catch (error) {
        console.error('Remove member error:', error);
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to remove member',
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
