// Invoice management API endpoints
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const listInvoicesSchema = z.object({
  billingAccountId: z.string().optional(),
  status: z.enum(['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE']).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

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
    // List invoices
    GET: async ({ query, context, auth, request }) => {
      try {
        // Parse query parameters from URL
        const { searchParams } = new URL(request.url);
        const queryParams = {
          billingAccountId: searchParams.get('billingAccountId') || undefined,
          status: searchParams.get('status') || undefined,
          limit: searchParams.get('limit') || undefined,
          offset: searchParams.get('offset') || undefined,
        };

        const validation = listInvoicesSchema.safeParse(queryParams);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid query parameters',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const { billingAccountId, status, limit, offset } = validation.data;

        // Get user's organization
        const userId = auth.user?.id || '';
        const userOrganizations = await prisma.organizationMember.findMany({
          where: {
            userId,
            isActive: true,
          },
          select: {
            organizationId: true,
          },
        });

        const organizationIds = userOrganizations.map((m) => m.organizationId);

        if (organizationIds.length === 0) {
          return createSuccessResponse(
            {
              invoices: [],
              pagination: {
                limit,
                offset,
                total: 0,
                hasMore: false,
              },
            },
            200,
            context.requestId
          );
        }

        // Build where clause
        const where: any = {
          billingAccount: {
            organizationId: {
              in: organizationIds,
            },
          },
        };

        if (billingAccountId) {
          where.billingAccountId = billingAccountId;
        }

        if (status) {
          where.status = status;
        }

        // Fetch invoices
        const [invoices, total] = await Promise.all([
          prisma.invoice.findMany({
            where,
            include: {
              billingAccount: {
                select: {
                  id: true,
                  name: true,
                  organizationId: true,
                },
              },
              subscription: {
                select: {
                  id: true,
                  projectId: true,
                  plan: {
                    select: {
                      name: true,
                      tier: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            skip: offset,
            take: limit,
          }),
          prisma.invoice.count({ where }),
        ]);

        logger.info('Invoices listed', {
          userId: auth.user?.id,
          count: invoices.length,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            invoices,
            pagination: {
              limit,
              offset,
              total,
              hasMore: offset + limit < total,
            },
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to list invoices', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to list invoices' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
