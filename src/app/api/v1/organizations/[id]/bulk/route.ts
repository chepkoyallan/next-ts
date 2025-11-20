// Bulk Operations API for Organizations
import { z } from 'zod';

import { createApiHandler } from '../../../../lib/handlers/base';
import { commonSchemas } from '../../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { OrganizationService } from '../../../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';
import { OrganizationAuditService } from '../../../../lib/services/organization-audit-service';
import { OrganizationMemberService } from '../../../../lib/services/organization-member-service';
import { OrganizationInvitationService } from '../../../../lib/services/organization-invitation-service';

// Validation schemas
const paramsSchema = z.object({
  id: commonSchemas.id,
});

const bulkInviteSchema = z.object({
  invitations: z
    .array(
      z.object({
        email: commonSchemas.email,
        role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
        message: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(50), // Limit to 50 invitations at once
});

const bulkUpdateRolesSchema = z.object({
  updates: z
    .array(
      z.object({
        memberId: commonSchemas.id,
        role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']),
      })
    )
    .min(1)
    .max(50),
});

const bulkRemoveMembersSchema = z.object({
  memberIds: z.array(commonSchemas.id).min(1).max(50),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
      permissions: ['organizations:write'],
    },
    rateLimit: rateLimitConfigs.strict, // Use strict rate limiting for bulk operations
    allowedMethods: ['POST'],
    validation: {
      params: paramsSchema,
    },
  },
  {
    // Bulk operations
    POST: async ({ routeParams, body, context, auth }) => {
      try {
        const organizationId = routeParams.id;

        // Check permissions
        const userRole = await OrganizationService.getUserRole(auth.user?.id || '', organizationId);
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');
        const canManage = isAdmin || userRole === 'OWNER' || userRole === 'ADMIN';

        if (!canManage) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You do not have permission to perform bulk operations',
            },
            context.requestId
          );
        }

        // Determine operation type
        const { operation } = body;

        if (!operation) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Operation type is required',
            },
            context.requestId
          );
        }

        // Handle different bulk operations
        switch (operation) {
          case 'bulk_invite': {
            const validationResult = bulkInviteSchema.safeParse(body);
            if (!validationResult.success) {
              return createErrorResponse(
                'VALIDATION_ERROR',
                {
                  errors: validationResult.error.issues,
                },
                context.requestId
              );
            }

            const { invitations } = validationResult.data;

            // Process all invitations in parallel
            const bulkResults = await Promise.all(
              invitations.map(async (invitation) => {
                try {
                  // Role restrictions
                  if (invitation.role === 'OWNER' && userRole !== 'OWNER' && !isAdmin) {
                    return {
                      type: 'error',
                      email: invitation.email,
                      error: 'Only organization owners can invite other owners',
                    };
                  }

                  if (invitation.role === 'ADMIN' && userRole === 'ADMIN' && !isAdmin) {
                    return {
                      type: 'error',
                      email: invitation.email,
                      error: 'Only organization owners can invite administrators',
                    };
                  }

                  const result = await OrganizationInvitationService.createInvitation({
                    organizationId,
                    email: invitation.email,
                    role: invitation.role,
                    invitedBy: auth.user?.id || '',
                    message: invitation.message,
                  });

                  await OrganizationAuditService.logInvitationCreated(
                    organizationId,
                    auth.user?.id || '',
                    result.id,
                    invitation.email,
                    invitation.role
                  );

                  return {
                    type: 'success',
                    email: invitation.email,
                    invitationId: result.id,
                  };
                } catch (error: any) {
                  return {
                    type: 'error',
                    email: invitation.email,
                    error: error.message || 'Failed to create invitation',
                  };
                }
              })
            );

            // Separate results by type
            const results = bulkResults
              .filter((r) => r.type === 'success')
              .map((r) => ({
                email: r.email,
                success: true,
                invitationId: (r as any).invitationId,
              }));

            const errors = bulkResults
              .filter((r) => r.type === 'error')
              .map((r) => ({
                email: r.email,
                error: (r as any).error,
              }));

            return createSuccessResponse(
              {
                operation: 'bulk_invite',
                total: invitations.length,
                successful: results.length,
                failed: errors.length,
                results,
                errors,
              },
              200,
              context.requestId
            );
          }

          case 'bulk_update_roles': {
            const validationResult = bulkUpdateRolesSchema.safeParse(body);
            if (!validationResult.success) {
              return createErrorResponse(
                'VALIDATION_ERROR',
                {
                  errors: validationResult.error.issues,
                },
                context.requestId
              );
            }

            const { updates } = validationResult.data;

            // Process all updates in parallel
            const bulkResults = await Promise.all(
              updates.map(async (update) => {
                try {
                  const member = await OrganizationMemberService.getMember(update.memberId);

                  if (!member || member.organizationId !== organizationId) {
                    return {
                      type: 'error',
                      memberId: update.memberId,
                      error: 'Member not found',
                    };
                  }

                  // Permission checks
                  const canManageMember = await OrganizationMemberService.canManageMember(
                    auth.user?.id || '',
                    organizationId,
                    update.memberId
                  );

                  if (!canManageMember && !isAdmin) {
                    return {
                      type: 'error',
                      memberId: update.memberId,
                      error: 'Insufficient permissions to update this member',
                    };
                  }

                  const oldRole = member.role;
                  await OrganizationMemberService.updateMember(update.memberId, {
                    role: update.role,
                  });

                  await OrganizationAuditService.logRoleChanged(
                    organizationId,
                    auth.user?.id || '',
                    update.memberId,
                    oldRole,
                    update.role
                  );

                  return {
                    type: 'success',
                    memberId: update.memberId,
                    oldRole,
                    newRole: update.role,
                  };
                } catch (error: any) {
                  return {
                    type: 'error',
                    memberId: update.memberId,
                    error: error.message || 'Failed to update role',
                  };
                }
              })
            );

            // Separate results by type
            const results = bulkResults
              .filter((r) => r.type === 'success')
              .map((r) => ({
                memberId: r.memberId,
                success: true,
                oldRole: (r as any).oldRole,
                newRole: (r as any).newRole,
              }));

            const errors = bulkResults
              .filter((r) => r.type === 'error')
              .map((r) => ({
                memberId: r.memberId,
                error: (r as any).error,
              }));

            return createSuccessResponse(
              {
                operation: 'bulk_update_roles',
                total: updates.length,
                successful: results.length,
                failed: errors.length,
                results,
                errors,
              },
              200,
              context.requestId
            );
          }

          case 'bulk_remove_members': {
            const validationResult = bulkRemoveMembersSchema.safeParse(body);
            if (!validationResult.success) {
              return createErrorResponse(
                'VALIDATION_ERROR',
                {
                  errors: validationResult.error.issues,
                },
                context.requestId
              );
            }

            const { memberIds } = validationResult.data;

            // Process all removals in parallel
            const bulkResults = await Promise.all(
              memberIds.map(async (memberId) => {
                try {
                  const member = await OrganizationMemberService.getMember(memberId);

                  if (!member || member.organizationId !== organizationId) {
                    return {
                      type: 'error',
                      memberId,
                      error: 'Member not found',
                    };
                  }

                  // Permission checks
                  const canManageMember = await OrganizationMemberService.canManageMember(
                    auth.user?.id || '',
                    organizationId,
                    memberId
                  );

                  if (!canManageMember && !isAdmin) {
                    return {
                      type: 'error',
                      memberId,
                      error: 'Insufficient permissions to remove this member',
                    };
                  }

                  // Cannot remove last owner
                  if (member.role === 'OWNER') {
                    const roleCount =
                      await OrganizationMemberService.getMemberCountByRole(organizationId);
                    if (roleCount.OWNER <= 1) {
                      return {
                        type: 'error',
                        memberId,
                        error: 'Cannot remove the last owner',
                      };
                    }
                  }

                  await OrganizationMemberService.removeMember(memberId);

                  await OrganizationAuditService.logMemberRemoved(
                    organizationId,
                    auth.user?.id || '',
                    memberId
                  );

                  return {
                    type: 'success',
                    memberId,
                  };
                } catch (error: any) {
                  return {
                    type: 'error',
                    memberId,
                    error: error.message || 'Failed to remove member',
                  };
                }
              })
            );

            // Separate results by type
            const results = bulkResults
              .filter((r) => r.type === 'success')
              .map((r) => ({
                memberId: r.memberId,
                success: true,
              }));

            const errors = bulkResults
              .filter((r) => r.type === 'error')
              .map((r) => ({
                memberId: r.memberId,
                error: (r as any).error,
              }));

            return createSuccessResponse(
              {
                operation: 'bulk_remove_members',
                total: memberIds.length,
                successful: results.length,
                failed: errors.length,
                results,
                errors,
              },
              200,
              context.requestId
            );
          }

          default:
            return createErrorResponse(
              'VALIDATION_ERROR',
              {
                message: `Unknown operation: ${operation}`,
              },
              context.requestId
            );
        }
      } catch (error) {
        console.error('Bulk operation error:', error);
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to perform bulk operation',
          },
          context.requestId
        );
      }
    },
  }
);

export const POST = handler;
