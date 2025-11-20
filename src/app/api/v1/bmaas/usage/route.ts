/**
 * BMaaS Usage API
 * Track and report resource usage and costs
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { recordMetric } from '../../../lib/services/metrics-service';
import { getOrganizationContext } from '../../../lib/middleware/tenant-scope';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * GET /api/v1/bmaas/usage
 * Get usage records and cost breakdown
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    // Check if BMaaS is enabled
    if (!isBmaasEnabled()) {
      return NextResponse.json(
        createErrorEnvelope('FEATURE_DISABLED', 'BMaaS feature is not enabled', requestId),
        { status: 403 }
      );
    }

    // Get organization context
    const { organizationId } = await getOrganizationContext(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const resourceType = searchParams.get('resourceType');
    const groupBy = searchParams.get('groupBy') || 'day'; // day, week, month

    // Default to current month if no dates provided
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Build where clause
    const where: any = {
      organizationId,
      startTime: { gte: start },
      endTime: { lte: end },
    };

    if (resourceType) {
      where.resourceType = resourceType;
    }

    // Fetch usage records
    const usageRecords = await prisma.bmaasUsageRecord.findMany({
      where,
      include: {
        instance: {
          select: {
            name: true,
            flavor: {
              select: {
                name: true,
                vcpus: true,
                ram: true,
              },
            },
          },
        },
        volume: {
          select: {
            name: true,
            sizeGb: true,
          },
        },
        network: {
          select: {
            name: true,
          },
        },
        bucket: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    // Calculate totals by resource type
    const costByResourceType = usageRecords.reduce((acc: any, record) => {
      const type = record.resourceType;
      if (!acc[type]) {
        acc[type] = {
          totalCost: 0,
          count: 0,
          quantity: 0,
        };
      }
      acc[type].totalCost += parseFloat(record.totalCost.toString());
      acc[type].count += 1;
      acc[type].quantity += parseFloat(record.quantity.toString());
      return acc;
    }, {});

    // Calculate total cost
    const totalCost = usageRecords.reduce(
      (sum, record) => sum + parseFloat(record.totalCost.toString()),
      0
    );

    // Group records by time period
    const groupedByTime = usageRecords.reduce((acc: any, record) => {
      const date = new Date(record.startTime);
      let key: string;

      if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = date.toISOString().split('T')[0]; // day
      }

      if (!acc[key]) {
        acc[key] = {
          period: key,
          totalCost: 0,
          records: 0,
        };
      }

      acc[key].totalCost += parseFloat(record.totalCost.toString());
      acc[key].records += 1;

      return acc;
    }, {});

    const timeSeriesData = Object.values(groupedByTime).sort((a: any, b: any) =>
      a.period.localeCompare(b.period)
    );

    // Get current active resources
    const activeInstances = await prisma.bmaasInstance.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
    });

    const activeVolumes = await prisma.bmaasVolume.count({
      where: {
        organizationId,
        deletedAt: null,
        status: { in: ['AVAILABLE', 'IN_USE'] },
      },
    });

    const activeBuckets = await prisma.bmaasBucket.count({
      where: {
        organizationId,
        deletedAt: null,
        status: 'ACTIVE',
      },
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/usage',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          period: {
            start,
            end,
            groupBy,
          },
          summary: {
            totalCost,
            currency: 'USD',
            recordCount: usageRecords.length,
            activeResources: {
              instances: activeInstances,
              volumes: activeVolumes,
              buckets: activeBuckets,
            },
          },
          costByResourceType,
          timeSeriesData,
          records: usageRecords.slice(0, 100), // Limit to 100 most recent
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS usage:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/usage',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch usage data', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
