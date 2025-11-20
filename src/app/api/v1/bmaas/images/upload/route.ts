/**
 * BMaaS Image Upload API
 * Upload OS images to OpenStack Glance
 */

import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../../lib/services/metrics-service';
import { getBmaasService } from '../../../../lib/services/bmaas-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for image uploads

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * POST /api/v1/bmaas/images/upload
 * Upload an image from URL to OpenStack
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

    // Parse request body
    const body = await request.json();
    const { name, url, format = 'qcow2', minDisk = 0, minRam = 0, visibility = 'public' } = body;

    // Validate required fields
    if (!name || !url) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Missing required fields: name and url', requestId),
        { status: 400 }
      );
    }

    // Get BMaaS service
    const bmaasService = getBmaasService();

    // Upload image
    const image = await bmaasService.uploadImage({
      name,
      url,
      format,
      minDisk,
      minRam,
      visibility,
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/images/upload',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          image: {
            id: image.id,
            name: image.name,
            status: image.status,
            visibility: image.visibility,
          },
          message: 'Image upload started successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error uploading BMaaS image:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/images/upload',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to upload image', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
