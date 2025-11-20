/**
 * Dependencies Status Endpoint
 * GET /api/health/dependencies
 * Shows status of all external dependencies
 */

import { NextResponse } from 'next/server';

import { getDependenciesStatus } from '../../lib/services/health-check-service';

export async function GET() {
  try {
    const dependencies = await getDependenciesStatus();
    return NextResponse.json({
      status: 'ok',
      dependencies,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
