/**
 * BMaaS Volumes API
 * Manage block storage volumes
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { recordMetric } from '../../../lib/services/metrics-service';
import { getBmaasService } from '../../../lib/services/bmaas-service';
import { getBmaasContext, getOrganizationContext } from '../../../lib/middleware/tenant-scope';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * GET /api/v1/bmaas/volumes
 * List all volumes for the current organization
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

    // Get BMaaS context (allows superadmins to see all orgs)
    const { organizationId, isSuperAdmin } = await getBmaasContext(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Build where clause
    const where: any = {
      deletedAt: null,
    };

    // Regular users: filter by their organization
    // Superadmins: see all organizations
    if (!isSuperAdmin && organizationId) {
      where.organizationId = organizationId;
    }

    if (status) {
      where.status = status;
    }

    // Fetch volumes from database
    const volumes = await prisma.bmaasVolume.findMany({
      where,
      include: {
        instance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/volumes',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          volumes,
          total: volumes.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS volumes:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/volumes',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch volumes', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bmaas/volumes
 * Create a new volume
 */
export async function POST(request: NextRequest) {
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
    const { organizationId, userId } = await getOrganizationContext(request);

    // Parse request body
    const body = await request.json();
    const { name, description, sizeGb, volumeType, availabilityZone } = body;

    // Validate required fields
    if (!name || !sizeGb) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Missing required fields: name, sizeGb', requestId),
        { status: 400 }
      );
    }

    // Validate size
    if (sizeGb < 1 || sizeGb > 10000) {
      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'Volume size must be between 1 and 10000 GB',
          requestId
        ),
        { status: 400 }
      );
    }

    // Check quota
    const quota = await prisma.bmaasQuota.findUnique({
      where: { organizationId },
    });

    if (quota) {
      if (quota.usedVolumes >= quota.maxVolumes) {
        return NextResponse.json(
          createErrorEnvelope(
            'QUOTA_EXCEEDED',
            `Volume quota exceeded. Maximum: ${quota.maxVolumes}`,
            requestId
          ),
          { status: 429 }
        );
      }

      if (quota.usedStorageGb + sizeGb > quota.maxStorageGb) {
        return NextResponse.json(
          createErrorEnvelope(
            'QUOTA_EXCEEDED',
            `Storage quota exceeded. Available: ${
              quota.maxStorageGb - quota.usedStorageGb
            } GB, Required: ${sizeGb} GB`,
            requestId
          ),
          { status: 429 }
        );
      }
    }

    // Calculate pricing based on volume type
    let monthlyRatePerGb: number;
    if (volumeType === 'nvme') {
      monthlyRatePerGb = 14.6; // ~$0.2/hour * 730 hours
    } else if (volumeType === 'hdd') {
      monthlyRatePerGb = 3.65; // ~$0.05/hour * 730 hours
    } else {
      monthlyRatePerGb = 7.3; // ~$0.1/hour * 730 hours
    }

    // Get BMaaS service and create volume in OpenStack
    const bmaasService = getBmaasService();
    const openstackVolume = await bmaasService.createVolume({
      name,
      size: sizeGb,
      volumeType: volumeType || '__DEFAULT__',
      availabilityZone,
    });

    // Create volume in database
    const volume = await prisma.bmaasVolume.create({
      data: {
        organizationId,
        projectId: (await prisma.project.findFirst({ where: { organizationId } }))!.id,
        name,
        description,
        sizeGb,
        volumeType: volumeType || '__DEFAULT__',
        openstackId: openstackVolume.id,
        status: 'CREATING',
        monthlyRatePerGb,
        currency: 'USD',
        createdBy: userId,
      },
    });

    // Update quota
    if (quota) {
      await prisma.bmaasQuota.update({
        where: { organizationId },
        data: {
          usedVolumes: { increment: 1 },
          usedStorageGb: { increment: sizeGb },
        },
      });
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/volumes',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          volume,
          message: 'Volume creation initiated',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating BMaaS volume:', error);

    // Check for specific OpenStack errors
    let errorMessage = 'Failed to create volume';
    let errorDetails: any = { message: error.message };

    // Check for backend allocation error
    if (error.message && error.message.includes('weighted backend')) {
      errorMessage = 'Storage backend not available';
      errorDetails = {
        message:
          'The storage backend (cinder-volume) is not configured or running on the OpenStack server.',
        technicalError: error.message,
        resolution: 'Contact your OpenStack administrator to configure the cinder-volume service.',
      };
    } else if (error.response?.status === 404) {
      errorMessage = 'Volume type not found';
      errorDetails = {
        message: error.message,
        suggestion: 'The specified volume type may not be available.',
      };
    }

    recordMetric({
      endpoint: '/api/v1/bmaas/volumes',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('VOLUME_CREATE_ERROR', errorMessage, requestId, errorDetails),
      { status: 500 }
    );
  }
}
