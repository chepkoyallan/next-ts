// Individual billing account management API endpoints
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../../lib/utils/logger';
import { createApiHandler } from '../../../../lib/handlers/base';
import { commonSchemas } from '../../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { OrganizationService } from '../../../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Validation schemas
const paramsSchema = z.object({
  id: commonSchemas.id,
});

const updateBillingAccountSchema = z.object({
  name: z.string().min(1).optional(),
  email: commonSchemas.email.optional(),
  billingAddress: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string().optional(),
      postalCode: z.string(),
      country: z.string(),
    })
    .optional(),
  taxId: z.string().optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'PUT'],
    validation: {
      params: paramsSchema,
    },
  },
  {
    // Get billing account details
    GET: async ({ routeParams, context, auth }) => {
      try {
        const accountId = routeParams.id;

        const account = await prisma.billingAccount.findUnique({
          where: { id: accountId },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            subscriptions: {
              include: {
                plan: {
                  select: {
                    name: true,
                    tier: true,
                    pricing: true,
                    features: true,
                  },
                },
                project: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            invoices: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 10,
            },
            paymentHistory: {
              orderBy: {
                processedAt: 'desc',
              },
              take: 10,
            },
            billingAlerts: {
              where: {
                isResolved: false,
              },
            },
            _count: {
              select: {
                invoices: true,
                paymentHistory: true,
                subscriptions: true,
              },
            },
          },
        });

        if (!account) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Billing account not found' },
            context.requestId
          );
        }

        // Check permissions
        const userRole = await OrganizationService.getUserRole(
          auth.user?.id || '',
          account.organizationId
        );

        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        if (!isAdmin && !userRole) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'You do not have access to this billing account' },
            context.requestId
          );
        }

        logger.info('Billing account retrieved', {
          accountId,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ account }, 200, context.requestId);
      } catch (error) {
        logger.error('Failed to get billing account', error as Error, {
          accountId: routeParams.id,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to get billing account' },
          context.requestId
        );
      }
    },

    // Update billing account
    PUT: async ({ routeParams, body, context, auth }) => {
      try {
        const accountId = routeParams.id;

        const validation = updateBillingAccountSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid update data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const updateData = validation.data;

        // Get existing account
        const account = await prisma.billingAccount.findUnique({
          where: { id: accountId },
        });

        if (!account) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Billing account not found' },
            context.requestId
          );
        }

        // Check permissions
        const userRole = await OrganizationService.getUserRole(
          auth.user?.id || '',
          account.organizationId
        );

        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        const canUpdate = isAdmin || userRole === 'OWNER' || userRole === 'ADMIN';

        if (!canUpdate) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'You do not have permission to update this billing account' },
            context.requestId
          );
        }

        // Update account
        const updatedAccount = await prisma.billingAccount.update({
          where: { id: accountId },
          data: {
            ...(updateData.name && { name: updateData.name }),
            ...(updateData.email && { email: updateData.email }),
            ...(updateData.billingAddress && { billingAddress: updateData.billingAddress }),
            ...(updateData.taxId !== undefined && { taxId: updateData.taxId }),
            ...(updateData.currency && { currency: updateData.currency }),
            ...(updateData.status && { status: updateData.status }),
            ...(updateData.metadata && { metadata: updateData.metadata }),
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        logger.info('Billing account updated', {
          accountId,
          changes: updateData,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ account: updatedAccount }, 200, context.requestId);
      } catch (error) {
        logger.error('Failed to update billing account', error as Error, {
          accountId: routeParams.id,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to update billing account' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const PUT = handler;
