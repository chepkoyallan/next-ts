/**
 * BMaaS Bucket Objects API
 * Upload and list objects in a bucket
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
 * GET /api/v1/bmaas/buckets/[id]/objects
 * List objects in a bucket
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || '';
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const marker = searchParams.get('marker') || '';

    // List objects from OpenStack Swift
    const bmaasService = getBmaasService();
    const objects = await bmaasService.listBucketObjects(bucket.openstackId, {
      prefix,
      limit,
      marker,
    });

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}/objects`,
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          objects,
          total: objects.length,
          bucket: {
            id: bucket.id,
            name: bucket.name,
            objectCount: bucket.objectCount,
            sizeBytes: bucket.sizeBytes,
          },
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error listing bucket objects:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}/objects`,
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to list bucket objects', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bmaas/buckets/[id]/objects
 * Upload an object to a bucket
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const objectKey = formData.get('key') as string;
    const contentType = formData.get('contentType') as string | null;

    if (!file || !objectKey) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Missing required fields: file, key', requestId),
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload object to OpenStack Swift
    const bmaasService = getBmaasService();
    const uploadResult = await bmaasService.uploadBucketObject(
      bucket.openstackId,
      objectKey,
      buffer,
      contentType || file.type
    );

    // Update bucket stats in database
    const updatedBucket = await prisma.bmaasBucket.update({
      where: { id: params.id },
      data: {
        objectCount: { increment: 1 },
        sizeBytes: { increment: buffer.length },
        updatedAt: new Date(),
      },
    });

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}/objects`,
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          object: {
            key: objectKey,
            size: buffer.length,
            contentType: contentType || file.type,
            etag: uploadResult.etag,
          },
          bucket: {
            objectCount: updatedBucket.objectCount,
            sizeBytes: updatedBucket.sizeBytes,
          },
          message: 'Object uploaded successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error uploading object:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/buckets/${params.id}/objects`,
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to upload object', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
