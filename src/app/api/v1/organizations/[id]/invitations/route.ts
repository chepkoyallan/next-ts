// Organization Invitations API
import { z } from 'zod';

import { createApiHandler } from '../../../../lib/handlers/base';
import { commonSchemas } from '../../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { OrganizationService } from '../../../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';
import { OrganizationInvitationService } from '../../../../lib/services/organization-invitation-service';

// Validation schemas
const paramsSchema = z.object({
  id: commonSchemas.id,
});

const createInvitationSchema = z.object({
  email: commonSchemas.email,
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
  message: z.string().max(500).optional(),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

const querySchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED']).optional(),
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
    // List invitations
    GET: async ({ routeParams, context, auth, request }) => {
      try {
        const organizationId = routeParams.id;

        // Check permissions
        const userRole = await OrganizationService.getUserRole(auth.user?.id || '', organizationId);
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');
        const canViewInvitations = isAdmin || userRole === 'OWNER' || userRole === 'ADMIN';

        if (!canViewInvitations) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You do not have permission to view invitations',
            },
            context.requestId
          );
        }

        // Parse query
        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());
        const { status } = querySchema.parse(queryParams);

        const invitations = await OrganizationInvitationService.getOrganizationInvitations(
          organizationId,
          status
        );

        return createSuccessResponse(
          {
            invitations,
            total: invitations.length,
          },
          200,
          context.requestId
        );
      } catch (error) {
        console.error('List invitations error:', error);
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch invitations',
          },
          context.requestId
        );
      }
    },

    // Create invitation
    POST: async ({ routeParams, body, context, auth }) => {
      try {
        const organizationId = routeParams.id;

        // Check permissions
        const userRole = await OrganizationService.getUserRole(auth.user?.id || '', organizationId);
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');
        const canInvite = isAdmin || userRole === 'OWNER' || userRole === 'ADMIN';

        if (!canInvite) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You do not have permission to invite members',
            },
            context.requestId
          );
        }

        const validationResult = createInvitationSchema.safeParse(body);
        if (!validationResult.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              errors: validationResult.error.issues,
            },
            context.requestId
          );
        }

        const { email, role, message, expiresInDays } = validationResult.data;

        // Role restrictions
        if (role === 'OWNER' && userRole !== 'OWNER' && !isAdmin) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'Only organization owners can invite other owners',
            },
            context.requestId
          );
        }

        if (role === 'ADMIN' && userRole === 'ADMIN' && !isAdmin) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'Only organization owners can invite administrators',
            },
            context.requestId
          );
        }

        const invitation = await OrganizationInvitationService.createInvitation({
          organizationId,
          email,
          role,
          invitedBy: auth.user?.id || '',
          message,
          expiresInDays,
        });

        // TODO: Send invitation email
        console.log('TODO: Send invitation email to', email);

        return createSuccessResponse(invitation, 201, context.requestId);
      } catch (error) {
        console.error('Create invitation error:', error);

        if (
          error instanceof Error &&
          (error.message.includes('already has a pending invitation') ||
            error.message.includes('already a member'))
        ) {
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
            message: 'Failed to create invitation',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
