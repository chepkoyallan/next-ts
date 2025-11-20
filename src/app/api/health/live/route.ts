/**
 * Liveness Probe Endpoint
 * GET /api/health/live
 * Used by Kubernetes to determine if container should be restarted
 */

import { NextResponse } from 'next/server';

import { livenessCheck } from '../../lib/services/health-check-service';

export async function GET() {
  try {
    const health = await livenessCheck();
    return NextResponse.json(health);
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message,
      },
      { status: 503 }
    );
  }
}
