/**
 * BMaaS Buckets API
 * Manage object storage buckets
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
 * GET /api/v1/bmaas/buckets
 * List all buckets for the current organization
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

    // Fetch buckets from database
    const buckets = await prisma.bmaasBucket.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/buckets',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          buckets,
          total: buckets.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS buckets:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/buckets',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch buckets', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bmaas/buckets
 * Create a new bucket
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
    const { name, description, region, storageClass, isPublic } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Missing required field: name', requestId),
        { status: 400 }
      );
    }

    // Validate bucket name format
    const bucketNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
    if (!bucketNameRegex.test(name)) {
      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'Bucket name must start and end with a letter or number, and can only contain lowercase letters, numbers, and hyphens',
          requestId
        ),
        { status: 400 }
      );
    }

    // Check if bucket name already exists
    const existingBucket = await prisma.bmaasBucket.findFirst({
      where: {
        name,
        deletedAt: null,
      },
    });

    if (existingBucket) {
      return NextResponse.json(
        createErrorEnvelope('CONFLICT', 'Bucket name already exists', requestId),
        { status: 409 }
      );
    }

    // Check quota
    const quota = await prisma.bmaasQuota.findUnique({
      where: { organizationId },
    });

    if (quota && quota.usedBuckets >= quota.maxBuckets) {
      return NextResponse.json(
        createErrorEnvelope(
          'QUOTA_EXCEEDED',
          `Bucket quota exceeded. Maximum: ${quota.maxBuckets}`,
          requestId
        ),
        { status: 429 }
      );
    }

    // Get BMaaS service and create bucket in OpenStack Swift
    const bmaasService = getBmaasService();
    await bmaasService.createBucket(name, isPublic || false);

    // Create bucket in database
    const bucket = await prisma.bmaasBucket.create({
      data: {
        organizationId,
        projectId: (await prisma.project.findFirst({ where: { organizationId } }))!.id,
        name,
        description,
        openstackId: name,
        region: region || 'RegionOne',
        storageClass: storageClass || 'STANDARD',
        isPublic: isPublic || false,
        status: 'ACTIVE',
        objectCount: 0,
        sizeBytes: 0,
        storageRatePerGb: 0.023,
        transferRatePerGb: 0.09,
        createdBy: userId,
      },
    });

    // Update quota
    if (quota) {
      await prisma.bmaasQuota.update({
        where: { organizationId },
        data: {
          usedBuckets: { increment: 1 },
        },
      });
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/buckets',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          bucket,
          message: 'Bucket created successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating BMaaS bucket:', error);

    // Check for specific OpenStack errors
    let errorMessage = 'Failed to create bucket';
    let errorDetails: any = { message: error.message };

    // Check for Swift not installed error
    if (error.message && error.message.includes("Service type 'object-store' not found")) {
      errorMessage = 'Object storage service not available';
      errorDetails = {
        message:
          'The object storage service (Swift) is not installed or configured on the OpenStack server.',
        technicalError: error.message,
        resolution:
          'Contact your OpenStack administrator to install and configure the Swift service.',
      };
    }

    recordMetric({
      endpoint: '/api/v1/bmaas/buckets',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('BUCKET_CREATE_ERROR', errorMessage, requestId, errorDetails),
      { status: 500 }
    );
  }
}
