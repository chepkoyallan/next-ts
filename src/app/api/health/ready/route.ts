/**
 * Readiness Probe Endpoint
 * GET /api/health/ready
 * Used by Kubernetes to determine if pod can serve traffic
 */

import { NextResponse } from 'next/server';

import { readinessCheck } from '../../lib/services/health-check-service';

export async function GET() {
  try {
    const readiness = await readinessCheck();
    const statusCode = readiness.ready ? 200 : 503;

    return NextResponse.json(readiness, { status: statusCode });
  } catch (error: any) {
    return NextResponse.json(
      {
        ready: false,
        error: error.message,
      },
      { status: 503 }
    );
  }
}
