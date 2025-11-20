// Billing Account management API endpoints
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { commonSchemas } from '../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { OrganizationService } from '../../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const createBillingAccountSchema = z.object({
  organizationId: commonSchemas.id,
  name: z.string().min(1, 'Name is required'),
  email: commonSchemas.email,
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
  currency: z.string().length(3).default('USD'),
  metadata: z.record(z.string(), z.any()).optional(),
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
    // Get user's billing accounts
    GET: async ({ context, auth }) => {
      try {
        const userId = auth.user?.id || '';

        // Get user's organizations
        const userOrganizations = await prisma.organizationMember.findMany({
          where: {
            userId,
            isActive: true,
          },
          select: {
            organizationId: true,
            role: true,
          },
        });

        const organizationIds = userOrganizations.map((m) => m.organizationId);

        if (organizationIds.length === 0) {
          return createSuccessResponse(
            {
              accounts: [],
              total: 0,
            },
            200,
            context.requestId
          );
        }

        // Fetch billing accounts for these organizations
        const accounts = await prisma.billingAccount.findMany({
          where: {
            organizationId: {
              in: organizationIds,
            },
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            subscriptions: {
              where: {
                status: {
                  in: ['ACTIVE', 'TRIALING'],
                },
              },
              include: {
                plan: {
                  select: {
                    name: true,
                    tier: true,
                  },
                },
              },
            },
            _count: {
              select: {
                invoices: true,
                paymentHistory: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        logger.info('Billing accounts listed', {
          userId: auth.user?.id,
          count: accounts.length,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            accounts,
            total: accounts.length,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to list billing accounts', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to list billing accounts' },
          context.requestId
        );
      }
    },

    // Create billing account
    POST: async ({ body, context, auth }) => {
      try {
        const validation = createBillingAccountSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid billing account data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const accountData = validation.data;

        // Check if user has permission to create billing account for this organization
        const userRole = await OrganizationService.getUserRole(
          auth.user?.id || '',
          accountData.organizationId
        );

        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        const canCreateBillingAccount = isAdmin || userRole === 'OWNER' || userRole === 'ADMIN';

        if (!canCreateBillingAccount) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message:
                'You do not have permission to create a billing account for this organization',
            },
            context.requestId
          );
        }

        // Check if billing account already exists for this organization
        const existingAccount = await prisma.billingAccount.findFirst({
          where: {
            organizationId: accountData.organizationId,
          },
        });

        if (existingAccount) {
          return createErrorResponse(
            'RESOURCE_ALREADY_EXISTS',
            {
              message: 'A billing account already exists for this organization',
            },
            context.requestId
          );
        }

        // Create billing account
        const billingAccount = await prisma.billingAccount.create({
          data: {
            organizationId: accountData.organizationId,
            name: accountData.name,
            email: accountData.email,
            billingAddress: accountData.billingAddress || {},
            taxId: accountData.taxId,
            currency: accountData.currency,
            status: 'ACTIVE',
            metadata: accountData.metadata || {},
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

        logger.info('Billing account created', {
          billingAccountId: billingAccount.id,
          organizationId: accountData.organizationId,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ account: billingAccount }, 201, context.requestId);
      } catch (error) {
        logger.error('Failed to create billing account', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to create billing account' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
