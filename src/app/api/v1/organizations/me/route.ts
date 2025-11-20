// Get current user's organizations
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { OrganizationService } from '../../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';
import {
  isHeadlessMode,
  HEADLESS_EMAIL,
  HEADLESS_ORG_ID,
  HEADLESS_USER_ID,
} from '../../../lib/headless-mode';

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET'],
  },
  {
    // Get current user's organizations
    GET: async ({ context, auth }) => {
      try {
        if (!auth.user?.id) {
          return createErrorResponse(
            'UNAUTHORIZED',
            {
              message: 'User not authenticated',
            },
            context.requestId
          );
        }

        // In headless mode, return or create a default organization
        if (isHeadlessMode()) {
          const { prisma } = await import('src/lib/prisma');

          // Ensure headless user exists in database with fixed ID
          let headlessUser = await prisma.user.findUnique({
            where: { id: HEADLESS_USER_ID },
          });

          if (!headlessUser) {
            console.log('[Headless Mode] Creating headless user in database with fixed ID');
            headlessUser = await prisma.user.create({
              data: {
                id: HEADLESS_USER_ID,
                email: HEADLESS_EMAIL,
                name: 'Headless User',
                emailVerified: true,
                twoFactorEnabled: false,
                passwordHash: 'headless-mode-no-password', // Not used in headless mode
              },
            });
          }

          // Try to find existing default organization with fixed ID
          let defaultOrg = await prisma.organization.findUnique({
            where: { id: HEADLESS_ORG_ID },
          });

          // If no default org exists, create it with fixed ID
          if (!defaultOrg) {
            console.log('[Headless Mode] Creating default organization with fixed ID');
            defaultOrg = await prisma.organization.create({
              data: {
                id: HEADLESS_ORG_ID,
                name: 'Default Organization',
                slug: 'default',
                description: 'Default organization for headless mode',
                settings: {},
              },
            });

            // Create organization member for the headless user
            await prisma.organizationMember.create({
              data: {
                userId: HEADLESS_USER_ID,
                organizationId: HEADLESS_ORG_ID,
                role: 'OWNER',
                isActive: true,
              },
            });

            // Get default project name from environment or use fallback
            const defaultProjectId = process.env.FLYTE_DEFAULT_PROJECT || 'flytesnacks';

            // Create default domains configuration
            const domains = [
              { id: 'development', name: 'Development' },
              { id: 'staging', name: 'Staging' },
              { id: 'production', name: 'Production' },
            ];

            // Create default project with domains in JSON field
            const defaultProject = await prisma.project.create({
              data: {
                id: defaultProjectId,
                name: defaultProjectId,
                description: 'Default project for headless mode',
                organizationId: HEADLESS_ORG_ID,
                flyteProjectId: defaultProjectId,
                flyteState: 0, // ACTIVE
                flyteDomains: domains,
                isArchived: false,
              },
            });

            console.log('[Headless Mode] Created default project with domains:', defaultProject.id);
          } else {
            // Ensure membership exists
            const membership = await prisma.organizationMember.findFirst({
              where: {
                userId: HEADLESS_USER_ID,
                organizationId: HEADLESS_ORG_ID,
              },
            });

            if (!membership) {
              await prisma.organizationMember.create({
                data: {
                  userId: HEADLESS_USER_ID,
                  organizationId: HEADLESS_ORG_ID,
                  role: 'OWNER',
                  isActive: true,
                },
              });
            }

            // Get default project name from environment or use fallback
            const defaultProjectId = process.env.FLYTE_DEFAULT_PROJECT || 'flytesnacks';

            // Ensure default project exists
            let defaultProject = await prisma.project.findUnique({
              where: { id: defaultProjectId },
            });

            if (!defaultProject) {
              console.log('[Headless Mode] Creating missing default project');

              // Create default domains configuration
              const domains = [
                { id: 'development', name: 'Development' },
                { id: 'staging', name: 'Staging' },
                { id: 'production', name: 'Production' },
              ];

              defaultProject = await prisma.project.create({
                data: {
                  id: defaultProjectId,
                  name: defaultProjectId,
                  description: 'Default project for headless mode',
                  organizationId: HEADLESS_ORG_ID,
                  flyteProjectId: defaultProjectId,
                  flyteState: 0, // ACTIVE
                  flyteDomains: domains,
                  isArchived: false,
                },
              });

              console.log(
                '[Headless Mode] Created default project with domains:',
                defaultProject.id
              );
            }
          }

          return createSuccessResponse(
            {
              organizations: [
                {
                  ...defaultOrg,
                  userRole: 'OWNER',
                  stats: {
                    memberCount: 1,
                    projectCount: 1,
                  },
                },
              ],
              count: 1,
            },
            200,
            context.requestId
          );
        }

        const organizations = await OrganizationService.getUserOrganizations(auth.user.id);

        // Get role for each organization
        const organizationsWithRole = await Promise.all(
          organizations.map(async (org) => {
            const role = await OrganizationService.getUserRole(auth.user!.id, org.id);
            const stats = await OrganizationService.getStats(org.id);

            return {
              ...org,
              userRole: role,
              stats,
            };
          })
        );

        return createSuccessResponse(
          {
            organizations: organizationsWithRole,
            count: organizationsWithRole.length,
          },
          200,
          context.requestId
        );
      } catch (error: any) {
        console.error('Get user organizations error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error message:', error.message);
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch user organizations',
            error: error.message,
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
