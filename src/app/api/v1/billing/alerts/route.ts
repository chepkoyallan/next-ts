// Billing Alerts API endpoints
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const listAlertsSchema = z.object({
  billingAccountId: z.string().optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  isResolved: z.coerce.boolean().optional(),
});

const resolveAlertSchema = z.object({
  alertId: z.string(),
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
    // List billing alerts
    GET: async ({ request, context, auth }) => {
      try {
        // Extract query parameters from URL
        const url = new URL(request.url);
        const queryParams = Object.fromEntries(url.searchParams.entries());

        const validation = listAlertsSchema.safeParse(queryParams);
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

        const { billingAccountId, severity, isResolved } = validation.data;

        // Get user's organizations
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
              alerts: [],
              total: 0,
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

        if (severity) {
          where.severity = severity;
        }

        if (isResolved !== undefined) {
          where.isResolved = isResolved;
        }

        // Fetch alerts
        const [alerts, total] = await Promise.all([
          prisma.billingAlert.findMany({
            where,
            include: {
              billingAccount: {
                select: {
                  id: true,
                  name: true,
                  organizationId: true,
                  organization: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
          }),
          prisma.billingAlert.count({ where }),
        ]);

        logger.info('Billing alerts listed', {
          userId: auth.user?.id,
          count: alerts.length,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            alerts,
            total,
            unresolved: alerts.filter((a) => !a.isResolved).length,
            critical: alerts.filter((a) => a.severity === 'CRITICAL' && !a.isResolved).length,
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to list billing alerts', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to list billing alerts' },
          context.requestId
        );
      }
    },

    // Resolve billing alert
    POST: async ({ body, context, auth }) => {
      try {
        const validation = resolveAlertSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid request data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const { alertId } = validation.data;

        // Get alert and check permissions
        const alert = await prisma.billingAlert.findUnique({
          where: { id: alertId },
          include: {
            billingAccount: {
              select: {
                organizationId: true,
              },
            },
          },
        });

        if (!alert) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Alert not found' },
            context.requestId
          );
        }

        // Check permissions
        const userId = auth.user?.id || '';
        const isMember = await prisma.organizationMember.findFirst({
          where: {
            userId,
            organizationId: alert.billingAccount.organizationId,
            isActive: true,
          },
        });

        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        if (!isAdmin && !isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'You do not have access to this alert' },
            context.requestId
          );
        }

        // Resolve alert
        const resolvedAlert = await prisma.billingAlert.update({
          where: { id: alertId },
          data: {
            isResolved: true,
            resolvedAt: new Date(),
          },
        });

        logger.info('Billing alert resolved', {
          alertId,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ alert: resolvedAlert }, 200, context.requestId);
      } catch (error) {
        logger.error('Failed to resolve billing alert', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to resolve billing alert' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
