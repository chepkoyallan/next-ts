/**
 * Admin API - System Metrics
 * Get system performance metrics and statistics
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

const MetricsQuerySchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']).optional().default('day'),
});

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/system/metrics
 * Get system performance metrics
 */
export async function GET(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: false,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = MetricsQuerySchema.parse(queryParams);

    // Calculate time range
    const now = new Date();
    const timeRanges = {
      hour: new Date(now.getTime() - 60 * 60 * 1000),
      day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    };

    const startTime = timeRanges[validatedQuery.period];

    // Get metrics in parallel
    const [executionMetrics, apiCallMetrics, errorMetrics, userActivityMetrics, resourceMetrics] =
      await Promise.all([
        getExecutionMetrics(prisma, startTime),
        getApiCallMetrics(prisma, startTime),
        getErrorMetrics(prisma, startTime),
        getUserActivityMetrics(prisma, startTime),
        getResourceMetrics(prisma, startTime),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        period: validatedQuery.period,
        startTime,
        endTime: now,
        metrics: {
          executions: executionMetrics,
          apiCalls: apiCallMetrics,
          errors: errorMetrics,
          userActivity: userActivityMetrics,
          resources: resourceMetrics,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error fetching system metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch system metrics',
      },
      { status: 500 }
    );
  }
}

/**
 * Get execution metrics
 */
async function getExecutionMetrics(prisma: any, startTime: Date) {
  const [total, byPhase] = await Promise.all([
    prisma.workflowExecution.count({
      where: { createdAt: { gte: startTime } },
    }),
    prisma.workflowExecution.groupBy({
      by: ['phase'],
      where: { createdAt: { gte: startTime } },
      _count: { id: true },
    }),
  ]);

  return {
    total,
    byPhase: byPhase.map((p: any) => ({
      phase: p.phase,
      count: p._count.id,
    })),
  };
}

/**
 * Get API call metrics
 */
async function getApiCallMetrics(prisma: any, startTime: Date) {
  const total = await prisma.usageRecord.count({
    where: {
      timestamp: { gte: startTime },
    },
  });

  return {
    total,
    ratePerMinute: total / ((Date.now() - startTime.getTime()) / 60000),
  };
}

/**
 * Get error metrics
 */
async function getErrorMetrics(prisma: any, startTime: Date) {
  const [failedExecutions, errorLogs] = await Promise.all([
    prisma.workflowExecution.count({
      where: {
        phase: 'FAILED',
        createdAt: { gte: startTime },
      },
    }),
    prisma.auditLog.count({
      where: {
        action: { contains: 'error' },
        timestamp: { gte: startTime },
      },
    }),
  ]);

  return {
    failedExecutions,
    errorLogs,
    total: failedExecutions + errorLogs,
  };
}

/**
 * Get user activity metrics
 */
async function getUserActivityMetrics(prisma: any, startTime: Date) {
  const [newUsers, loginCount] = await Promise.all([
    prisma.user.count({
      where: {
        createdAt: { gte: startTime },
      },
    }),
    prisma.auditLog.count({
      where: {
        action: 'user_login',
        timestamp: { gte: startTime },
      },
    }),
  ]);

  return {
    activeUsers: loginCount, // Use login count as proxy for active users
    newUsers,
    loginCount,
  };
}

/**
 * Get resource metrics
 */
async function getResourceMetrics(prisma: any, startTime: Date) {
  const [newProjects, newWorkflows, activeOrganizations] = await Promise.all([
    prisma.project.count({
      where: {
        createdAt: { gte: startTime },
      },
    }),
    prisma.workflow.count({
      where: {
        createdAt: { gte: startTime },
      },
    }),
    prisma.organization.count({
      where: {
        status: 'ACTIVE',
      },
    }),
  ]);

  return {
    newProjects,
    newWorkflows,
    activeOrganizations,
  };
}
