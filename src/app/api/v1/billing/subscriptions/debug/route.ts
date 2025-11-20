// Debug endpoint to check subscription issues
import { prisma } from '@app/database';

import { logger } from '../../../../lib/utils/logger';
import { createApiHandler } from '../../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET'],
  },
  {
    GET: async ({ context, auth }) => {
      try {
        const userId = auth.user?.id;

        if (!userId) {
          return createErrorResponse(
            'UNAUTHORIZED',
            { message: 'User not authenticated' },
            context.requestId
          );
        }

        // Get user info
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            organizationMembers: {
              where: { isActive: true },
              include: {
                organization: {
                  include: {
                    billingAccounts: {
                      include: {
                        subscriptions: {
                          include: {
                            plan: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        // Get all subscriptions in the database (for debugging)
        const allSubscriptions = await prisma.subscription.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            plan: true,
            billingAccount: {
              include: {
                organization: true,
              },
            },
          },
        });

        // Get user's organizations
        const userOrganizations = await prisma.organizationMember.findMany({
          where: {
            userId,
            isActive: true,
          },
          include: {
            organization: true,
          },
        });

        return createSuccessResponse(
          {
            debug: {
              userId,
              userEmail: user?.email,
              organizationMemberships: user?.organizationMembers.map((m) => ({
                organizationId: m.organizationId,
                organizationName: m.organization.name,
                isActive: m.isActive,
                role: m.role,
                billingAccountsCount: m.organization.billingAccounts.length,
                subscriptions: m.organization.billingAccounts.flatMap((ba) =>
                  ba.subscriptions.map((sub) => ({
                    id: sub.id,
                    status: sub.status,
                    planTier: sub.plan.tier,
                    createdAt: sub.createdAt,
                  }))
                ),
              })),
              userOrganizationsCount: userOrganizations.length,
              recentSubscriptions: allSubscriptions.map((sub) => ({
                id: sub.id,
                status: sub.status,
                planTier: sub.plan.tier,
                organizationId: sub.billingAccount.organizationId,
                organizationName: sub.billingAccount.organization.name,
                createdAt: sub.createdAt,
              })),
            },
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Debug endpoint error', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Debug endpoint failed',
            details: error instanceof Error ? error.message : String(error),
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
