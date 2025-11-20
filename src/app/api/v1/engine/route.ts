/**
 * Engine API - Main Route
 * Provides health check and service status for the engine
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  getEngineManager,
  isEngineInitialized,
  initializeEngineServices,
} from '../../lib/services/engine-initializer';

/**
 * GET /api/v1/engine
 * Get engine status and available services
 */
export async function GET(request: NextRequest) {
  try {
    // Auto-initialize if not initialized
    if (!isEngineInitialized()) {
      try {
        await initializeEngineServices();
      } catch (initError) {
        return NextResponse.json(
          {
            success: false,
            error: `Engine initialization failed: ${
              initError instanceof Error ? initError.message : 'Unknown error'
            }`,
            services: {},
          },
          { status: 503 }
        );
      }
    }

    const engineManager = getEngineManager();

    if (!engineManager) {
      return NextResponse.json(
        {
          success: false,
          error: 'Engine not initialized',
          services: {},
        },
        { status: 503 }
      );
    }

    // Get health status of all services
    const health = await engineManager.healthCheck();

    // Count healthy and configured services
    const totalServices = Object.keys(health).length;
    const healthyServices = Object.values(health).filter((isHealthy) => isHealthy).length;

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unavailable';
    if (healthyServices === totalServices && totalServices > 0) {
      status = 'healthy';
    } else if (healthyServices > 0) {
      status = 'degraded';
    } else {
      status = 'unavailable';
    }

    return NextResponse.json({
      success: true,
      status,
      services: {
        total: totalServices,
        healthy: healthyServices,
        details: health,
      },
      message:
        status === 'unavailable'
          ? 'Engine services configured but gRPC server not available. Ensure Flyte server is running at localhost:8089'
          : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
