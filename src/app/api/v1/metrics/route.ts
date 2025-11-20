/**
 * API Metrics Endpoint
 * View API metrics and statistics
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireSecureEngine } from '../../lib/services/engine-helper-rbac';
import {
  getAllMetrics,
  getEndpointMetrics,
  exportPrometheusMetrics,
} from '../../lib/services/metrics-service';

// Force dynamic rendering (uses cookies for auth)
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/metrics - Get API metrics
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'metrics', action: 'read' }],
          roles: ['operator', 'project-admin', 'system-admin', 'super-admin'],
        },
      },
      {}
    );

    if (result instanceof NextResponse) {
      return result;
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const format = searchParams.get('format');
    const timeWindow = parseInt(searchParams.get('timeWindow') || '3600000', 10);

    // Export to Prometheus format
    if (format === 'prometheus') {
      const prometheusMetrics = exportPrometheusMetrics();
      return new NextResponse(prometheusMetrics, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4',
        },
      });
    }

    // Get metrics for specific endpoint
    if (endpoint) {
      const metrics = getEndpointMetrics(endpoint, timeWindow);
      return NextResponse.json({
        success: true,
        endpoint,
        metrics,
        timeWindow,
      });
    }

    // Get all metrics summary
    const allMetrics = getAllMetrics(timeWindow);

    return NextResponse.json({
      success: true,
      metrics: allMetrics,
      timeWindow,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch metrics',
      },
      { status: 500 }
    );
  }
}
