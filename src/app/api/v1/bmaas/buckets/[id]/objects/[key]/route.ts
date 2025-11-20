/**
 * BMaaS Bucket Single Object API
 * Delete object and get download URL
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
 * GET /api/v1/bmaas/buckets/[id]/objects/[key]
 * Get object details or generate download URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; key: string } }
) {
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

    // Get bucket from database
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

    // Decode object key (URL encoded)
    const objectKey = decodeURIComponent(params.key);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'url' or 'metadata'
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600', 10); // Default 1 hour

    const bmaasService = getBmaasService();

    if (action === 'url') {
      // Generate temporary download URL
      const url = await bmaasService.getBucketObjectUrl(bucket.openstackId, objectKey, expiresIn);

      recordMetric({
        endpoint: `/api/v1/bmaas/buckets/${params.id}/objects/${params.key}`,
        method: 'GET',
        statusCode: 200,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createSuccessEnvelope(
          {
            url,
            expiresIn,
            expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
          },
          requestId
        ),
        { status: 200 }
      );
    }

    // Get object metadata
    const metadata = await bmaasService.getBucketObjectMetadata(bucket.openstackId, objectKey);

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}/objects/${params.key}`,
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          object: {
            key: objectKey,
            ...metadata,
          },
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting bucket object:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}/objects/${params.key}`,
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to get object', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bmaas/buckets/[id]/objects/[key]
 * Delete an object from a bucket
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; key: string } }
) {
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

    // Get bucket from database
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

    // Decode object key
    const objectKey = decodeURIComponent(params.key);

    // Get object size before deleting (for quota update)
    const bmaasService = getBmaasService();
    const metadata = await bmaasService.getBucketObjectMetadata(bucket.openstackId, objectKey);
    const objectSize = metadata.size || 0;

    // Delete object from OpenStack Swift
    await bmaasService.deleteBucketObject(bucket.openstackId, objectKey);

    // Update bucket stats in database
    const updatedBucket = await prisma.bmaasBucket.update({
      where: { id: params.id },
      data: {
        objectCount: { decrement: 1 },
        sizeBytes: { decrement: objectSize },
        updatedAt: new Date(),
      },
    });

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}/objects/${params.key}`,
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Object deleted successfully',
          bucket: {
            objectCount: updatedBucket.objectCount,
            sizeBytes: updatedBucket.sizeBytes,
          },
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting bucket object:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}/objects/${params.key}`,
      method: 'DELETE',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to delete object', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
