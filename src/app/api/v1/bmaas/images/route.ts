/**
 * BMaaS Images API
 * Manage compute instance images (OS images)
 */

import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../lib/services/metrics-service';
import { getBmaasService } from '../../../lib/services/bmaas-service';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for image uploads

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * GET /api/v1/bmaas/images
 * List all available instance images from OpenStack
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

    // Get BMaaS service
    const bmaasService = getBmaasService();

    // Fetch images from OpenStack
    const result = await bmaasService.listImages();

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    // Filter images by status
    let images = result.images || [];
    if (status !== 'all') {
      images = images.filter((img: any) => img.status === status);
    }

    // Transform images to a simplified format
    const transformedImages = images.map((img: any) => ({
      id: img.id,
      name: img.name,
      status: img.status,
      visibility: img.visibility,
      size: img.size,
      minDisk: img.min_disk,
      minRam: img.min_ram,
      createdAt: img.created_at,
      updatedAt: img.updated_at,
    }));

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/images',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          images: transformedImages,
          total: transformedImages.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS images:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/images',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch images', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
