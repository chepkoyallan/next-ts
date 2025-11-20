/**
 * Admin API - Overview Dashboard
 * Provides high-level system metrics and health status
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/overview
 * Get system overview metrics
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const adminContext = await requireAdmin(request, {
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');

    // Get current date for time-based queries
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ⚡ Performance: Parallel queries with caching for dashboard
    const [
      totalOrganizations,
      activeOrganizations,
      totalUsers,
      activeUsers,
      totalProjects,
      totalWorkflows,
      totalExecutions,
      monthlyExecutions,
      activeSubscriptions,
      subscriptionsByTier,
      recentUsers,
      recentOrganizations,
      systemHealth,
    ] = await Promise.all([
      // Organization metrics
      prisma.organization.count({ cacheStrategy: { ttl: 120, swr: 30 } } as any),
      prisma.organization.count({
        where: { status: 'ACTIVE' },
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),

      // User metrics
      prisma.user.count({ cacheStrategy: { ttl: 120, swr: 30 } } as any),
      prisma.user.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),

      // Resource metrics
      prisma.project.count({
        where: { isArchived: false },
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),
      prisma.workflow.count({
        where: { isDeleted: false },
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),
      prisma.workflowExecution.count({ cacheStrategy: { ttl: 120, swr: 30 } } as any),
      prisma.workflowExecution.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),

      // Subscription metrics
      prisma.subscription.count({
        where: {
          status: {
            in: ['ACTIVE', 'TRIALING'],
          },
        },
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),
      prisma.subscription.groupBy({
        by: ['planId'],
        where: {
          status: {
            in: ['ACTIVE', 'TRIALING'],
          },
        },
        _count: true,
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),

      // Recent activity
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),
      prisma.organization.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
        },
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),

      // System health check
      getSystemHealth(),
    ]);

    // ⚡ Performance: Calculate growth rates with caching
    const thirtyDaysAgoDate = new Date(thirtyDaysAgo);
    const [orgGrowth, userGrowth] = await Promise.all([
      prisma.organization.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgoDate,
          },
        },
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),
      prisma.user.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgoDate,
          },
        },
        cacheStrategy: { ttl: 120, swr: 30 },
      } as any),
    ]);

    // Get tier information for subscription breakdown
    const subscriptionDetails = await Promise.all(
      subscriptionsByTier.map(async (sub: any) => {
        const plan = await prisma.subscriptionPlan.findUnique({
          where: { id: sub.planId },
          select: { name: true, tier: true, pricing: true },
        });
        // Extract price from pricing JSON object (assuming it has a monthly/price field)
        const pricing = plan?.pricing as any;
        const monthlyPrice = pricing?.monthly || pricing?.price || 0;
        const count = typeof sub._count === 'number' ? sub._count : sub._count?._all || 0;
        return {
          tier: plan?.tier || 'UNKNOWN',
          name: plan?.name || 'Unknown',
          count,
          mrr: monthlyPrice * count,
        };
      })
    );

    // Calculate total MRR
    const totalMRR = subscriptionDetails.reduce((sum, sub) => sum + sub.mrr, 0);

    return NextResponse.json({
      success: true,
      data: {
        metrics: {
          organizations: {
            total: totalOrganizations,
            active: activeOrganizations,
            growth: orgGrowth,
            growthPercent:
              totalOrganizations > 0 ? ((orgGrowth / totalOrganizations) * 100).toFixed(1) : 0,
          },
          users: {
            total: totalUsers,
            active: activeUsers,
            growth: userGrowth,
            growthPercent: totalUsers > 0 ? ((userGrowth / totalUsers) * 100).toFixed(1) : 0,
          },
          resources: {
            projects: totalProjects,
            workflows: totalWorkflows,
            executions: totalExecutions,
            monthlyExecutions,
          },
          revenue: {
            mrr: totalMRR,
            arr: totalMRR * 12,
            activeSubscriptions,
            byTier: subscriptionDetails,
          },
        },
        recentActivity: {
          users: recentUsers,
          organizations: recentOrganizations,
        },
        systemHealth,
      },
    });
  } catch (error) {
    console.error('Error fetching admin overview:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch overview',
      },
      { status: 500 }
    );
  }
}

/**
 * Get system health status
 */
async function getSystemHealth() {
  try {
    const { prisma } = await import('src/lib/prisma');

    // Check database connection
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    // Check Redis if available
    let redisStatus = 'unknown';
    let redisLatency = 0;
    try {
      const { redisClient } = await import('src/lib/redis/client');
      const start = Date.now();
      await redisClient.ping();
      redisLatency = Date.now() - start;
      redisStatus = redisLatency < 100 ? 'healthy' : 'degraded';
    } catch {
      redisStatus = 'error';
    }

    // Check Flyte engine
    let flyteStatus = 'unknown';
    try {
      const { getOrInitializeEngine } = await import('src/app/api/lib/services/engine-helper');
      const engine = await getOrInitializeEngine();
      flyteStatus = engine ? 'healthy' : 'unavailable';
    } catch {
      flyteStatus = 'error';
    }

    return {
      database: {
        status: dbLatency < 100 ? 'healthy' : 'degraded',
        latency: dbLatency,
      },
      redis: {
        status: redisStatus,
        latency: redisLatency,
      },
      flyte: {
        status: flyteStatus,
      },
      overall: dbLatency < 100 && flyteStatus === 'healthy' ? 'healthy' : 'degraded',
    };
  } catch {
    return {
      database: { status: 'error', latency: 0 },
      redis: { status: 'unknown', latency: 0 },
      flyte: { status: 'unknown' },
      overall: 'error',
    };
  }
}
