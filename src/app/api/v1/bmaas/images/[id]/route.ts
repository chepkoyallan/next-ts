/**
 * BMaaS Image Detail API
 * Manage individual image operations
 */

import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../../lib/services/metrics-service';
import { getBmaasService } from '../../../../lib/services/bmaas-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * DELETE /api/v1/bmaas/images/[id]
 * Delete an image from OpenStack
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const imageId = params.id;

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

    // Delete image
    await bmaasService.deleteImage(imageId);

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/images/${imageId}`,
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Image deleted successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting BMaaS image:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/images/${imageId}`,
      method: 'DELETE',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to delete image', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
