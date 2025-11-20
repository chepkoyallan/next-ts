// Usage analytics and reporting API endpoints
import { z } from 'zod';

import { logger } from '../../../lib/utils/logger';
import { UsageMetric } from '../../../lib/types/billing';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { BillingService } from '../../../lib/services/billing-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const usageReportSchema = z.object({
  projectId: z.string().optional(),
  organizationId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  metrics: z
    .array(
      z.enum([
        'executions',
        'cpu_hours',
        'memory_gb_hours',
        'storage_gb',
        'network_gb',
        'users',
        'projects',
      ])
    )
    .optional(),
  groupBy: z.enum(['project', 'workflow', 'user', 'domain']).optional(),
  includeForecasts: z.boolean().default(false),
});

const currentUsageSchema = z.object({
  projectId: z.string().optional(),
  organizationId: z.string().optional(),
  period: z.enum(['today', 'week', 'month', 'quarter']).default('month'),
});

// Initialize billing service
const billingService = new BillingService(
  null, // Database connection
  null // Payment service
);

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
    // Get current usage summary
    GET: async ({ query, context, auth }) => {
      try {
        const validation = currentUsageSchema.safeParse(query);
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

        const { projectId, organizationId, period } = validation.data;

        // Check permissions
        const isAdmin =
          (auth.user as any)?.roles?.includes('admin') ||
          (auth.user as any)?.roles?.includes('billing-admin');

        if (!isAdmin) {
          // Users can only see their own organization's usage
          const userOrgId = (auth.user as any)?.organizationId;
          if (organizationId && organizationId !== userOrgId) {
            return createErrorResponse(
              'FORBIDDEN',
              { message: 'Access denied to organization usage' },
              context.requestId
            );
          }
        }

        // Calculate date range based on period
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case 'quarter':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
          default:
            // Default to month if period is not recognized
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        }

        // Get current usage analytics
        const currentUsage = await billingService.getCurrentUsageAnalytics(
          projectId || undefined,
          organizationId || (auth.user as any)?.organizationId
        );

        // Get usage trends
        const usageReport = await billingService.getUsageReport({
          projectId,
          startDate,
          endDate,
          granularity: period === 'today' ? 'hour' : 'day',
        });

        // Get cost breakdown
        const costBreakdown = await billingService.getCostBreakdown(
          projectId || undefined,
          organizationId || (auth.user as any)?.organizationId,
          startDate,
          endDate
        );

        logger.info('Current usage retrieved', {
          projectId,
          organizationId,
          period,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            period: {
              start: startDate,
              end: endDate,
              type: period,
            },
            currentUsage,
            trends: usageReport.analytics.trends,
            costBreakdown,
            summary: {
              totalCost: usageReport.cost.total,
              totalExecutions: currentUsage.metrics.totalExecutions,
              successRate:
                (currentUsage.metrics.successfulExecutions / currentUsage.metrics.totalExecutions) *
                100,
              averageCost: currentUsage.metrics.averageCost,
            },
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to get current usage', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to get current usage' },
          context.requestId
        );
      }
    },

    // Generate detailed usage report
    POST: async ({ body, context, auth }) => {
      try {
        const validation = usageReportSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid report parameters',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const reportRequest = validation.data;

        // Check permissions
        const isAdmin =
          (auth.user as any)?.roles?.includes('admin') ||
          (auth.user as any)?.roles?.includes('billing-admin');

        if (!isAdmin) {
          // Users can only see their own organization's usage
          const userOrgId = (auth.user as any)?.organizationId;
          if (reportRequest.organizationId && reportRequest.organizationId !== userOrgId) {
            return createErrorResponse(
              'FORBIDDEN',
              { message: 'Access denied to organization usage' },
              context.requestId
            );
          }
        }

        // Validate date range
        const startDate = new Date(reportRequest.startDate);
        const endDate = new Date(reportRequest.endDate);
        const daysDiff = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff > 365) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Date range cannot exceed 365 days' },
            context.requestId
          );
        }

        if (startDate >= endDate) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            { message: 'Start date must be before end date' },
            context.requestId
          );
        }

        // Generate usage report
        const usageReport = await billingService.getUsageReport({
          projectId: reportRequest.projectId,
          startDate,
          endDate,
          granularity: reportRequest.granularity,
          metrics: reportRequest.metrics as UsageMetric[],
        });

        // Add forecasts if requested
        let forecasts;
        if (reportRequest.includeForecasts) {
          forecasts = await BillingService.generateUsageForecasts(
            reportRequest.projectId || undefined,
            reportRequest.organizationId || (auth.user as any)?.organizationId,
            endDate
          );
        }

        // Group data if requested
        let groupedData;
        if (reportRequest.groupBy) {
          groupedData = await billingService.getUsageByGroup(
            reportRequest.groupBy,
            reportRequest.projectId || undefined,
            startDate,
            endDate
          );
        }

        logger.info('Usage report generated', {
          projectId: reportRequest.projectId,
          organizationId: reportRequest.organizationId,
          dateRange: `${startDate.toISOString()} - ${endDate.toISOString()}`,
          granularity: reportRequest.granularity,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            report: usageReport,
            forecasts,
            groupedData,
            metadata: {
              generatedAt: new Date(),
              generatedBy: auth.user?.id,
              parameters: reportRequest,
            },
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to generate usage report', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to generate usage report' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
