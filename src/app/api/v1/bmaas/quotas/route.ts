/**
 * BMaaS Quotas API
 * Manage resource quotas and usage limits
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
 * GET /api/v1/bmaas/quotas
 * Get quota information for the current organization
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

    // Fetch or create quota
    let quota = await prisma.bmaasQuota.findUnique({
      where: { organizationId },
    });

    // Create default quota if it doesn't exist
    if (!quota) {
      quota = await prisma.bmaasQuota.create({
        data: {
          organizationId,
          maxInstances: parseInt(process.env.BMAAS_MAX_INSTANCES_PER_USER || '10', 10),
          maxVcpus: parseInt(process.env.BMAAS_MAX_VCPUS_PER_USER || '50', 10),
          maxRamMb: parseInt(process.env.BMAAS_MAX_RAM_GB_PER_USER || '128', 10) * 1024,
          maxStorageGb: parseInt(process.env.BMAAS_MAX_STORAGE_GB_PER_USER || '1000', 10),
        },
      });
    }

    // Calculate usage percentages
    const usage = {
      instances: {
        used: quota.usedInstances,
        max: quota.maxInstances,
        percentage: (quota.usedInstances / quota.maxInstances) * 100,
        available: quota.maxInstances - quota.usedInstances,
      },
      vcpus: {
        used: quota.usedVcpus,
        max: quota.maxVcpus,
        percentage: (quota.usedVcpus / quota.maxVcpus) * 100,
        available: quota.maxVcpus - quota.usedVcpus,
      },
      ram: {
        used: quota.usedRamMb / 1024, // Convert to GB
        max: quota.maxRamMb / 1024,
        percentage: (quota.usedRamMb / quota.maxRamMb) * 100,
        available: (quota.maxRamMb - quota.usedRamMb) / 1024,
        unit: 'GB',
      },
      volumes: {
        used: quota.usedVolumes,
        max: quota.maxVolumes,
        percentage: (quota.usedVolumes / quota.maxVolumes) * 100,
        available: quota.maxVolumes - quota.usedVolumes,
      },
      storage: {
        used: quota.usedStorageGb,
        max: quota.maxStorageGb,
        percentage: (quota.usedStorageGb / quota.maxStorageGb) * 100,
        available: quota.maxStorageGb - quota.usedStorageGb,
        unit: 'GB',
      },
      networks: {
        used: quota.usedNetworks,
        max: quota.maxNetworks,
        percentage: (quota.usedNetworks / quota.maxNetworks) * 100,
        available: quota.maxNetworks - quota.usedNetworks,
      },
      buckets: {
        used: quota.usedBuckets,
        max: quota.maxBuckets,
        percentage: (quota.usedBuckets / quota.maxBuckets) * 100,
        available: quota.maxBuckets - quota.usedBuckets,
      },
    };

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/quotas',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          quota,
          usage,
          lastSynced: quota.lastSyncedAt,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS quotas:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/quotas',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch quotas', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
