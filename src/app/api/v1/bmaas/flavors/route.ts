/**
 * BMaaS Flavors API
 * Manage compute instance flavors (sizes)
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { recordMetric } from '../../../lib/services/metrics-service';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * GET /api/v1/bmaas/flavors
 * List all available instance flavors
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Build where clause
    const where: any = {
      isPublic: true,
    };

    if (!includeInactive) {
      where.isActive = true;
    }

    // Fetch flavors from database
    const flavors = await prisma.bmaasFlavor.findMany({
      where,
      orderBy: [{ vcpus: 'asc' }, { ram: 'asc' }],
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/flavors',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          flavors,
          total: flavors.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS flavors:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/flavors',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch flavors', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
