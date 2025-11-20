/**
 * BMaaS Single Bucket API
 * Get, update, or delete a specific bucket
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { getBmaasService } from 'src/app/api/lib/services/bmaas-service';
import { getOrganizationContext } from 'src/app/api/lib/middleware/tenant-scope';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

export const dynamic = 'force-dynamic';

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * GET /api/v1/bmaas/buckets/[id]
 * Get details of a specific bucket
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Fetch bucket from database
    const bucket = await prisma.bmaasBucket.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!bucket) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Bucket not found', requestId), {
        status: 404,
      });
    }

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}`,
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          bucket,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS bucket:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}`,
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch bucket', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/bmaas/buckets/[id]
 * Update bucket metadata
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Parse request body
    const body = await request.json();
    const { description, isPublic } = body;

    // Find bucket
    const bucket = await prisma.bmaasBucket.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!bucket) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Bucket not found', requestId), {
        status: 404,
      });
    }

    // Update bucket access control in OpenStack Swift if isPublic changed
    if (isPublic !== undefined && isPublic !== bucket.isPublic) {
      const bmaasService = getBmaasService();
      await bmaasService.updateBucketAccess(bucket.openstackId, isPublic);
    }

    // Update bucket in database
    const updatedBucket = await prisma.bmaasBucket.update({
      where: { id: params.id },
      data: {
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic }),
      },
    });

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}`,
      method: 'PATCH',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          bucket: updatedBucket,
          message: 'Bucket updated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating BMaaS bucket:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}`,
      method: 'PATCH',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to update bucket', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bmaas/buckets/[id]
 * Delete a bucket
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Find bucket
    const bucket = await prisma.bmaasBucket.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!bucket) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Bucket not found', requestId), {
        status: 404,
      });
    }

    // Check if bucket has objects (optional - can force delete)
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    if (bucket.objectCount > 0 && !force) {
      return NextResponse.json(
        createErrorEnvelope(
          'CONFLICT',
          `Bucket contains ${bucket.objectCount} objects. Use force=true to delete anyway.`,
          requestId
        ),
        { status: 409 }
      );
    }

    // Delete bucket from OpenStack Swift
    const bmaasService = getBmaasService();
    await bmaasService.deleteBucket(bucket.openstackId);

    // Soft delete bucket in database
    await prisma.bmaasBucket.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        status: 'DELETED',
      },
    });

    // Update quota
    const quota = await prisma.bmaasQuota.findUnique({
      where: { organizationId },
    });

    if (quota) {
      await prisma.bmaasQuota.update({
        where: { organizationId },
        data: {
          usedBuckets: { decrement: 1 },
        },
      });
    }

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}`,
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Bucket deleted successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting BMaaS bucket:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}`,
      method: 'DELETE',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to delete bucket', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
