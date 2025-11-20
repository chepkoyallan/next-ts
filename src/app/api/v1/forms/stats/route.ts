import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../lib/services/metrics-service';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';
import {
  getAvailableTags,
  getFormStatistics,
  getAvailableCategories,
} from '../../../lib/services/form-generation-service';

/**
 * GET /api/v1/forms/stats
 * Get form generation statistics and metadata
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { searchParams } = request.nextUrl;
    const includeCategories = searchParams.get('includeCategories') === 'true';
    const includeTags = searchParams.get('includeTags') === 'true';

    // Get basic statistics
    const stats = getFormStatistics();

    // Prepare response
    const response: any = {
      stats,
    };

    // Include additional data if requested
    if (includeCategories) {
      response.availableCategories = getAvailableCategories();
    }

    if (includeTags) {
      response.availableTags = getAvailableTags();
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/stats',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching form statistics:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/stats',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch form statistics', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
