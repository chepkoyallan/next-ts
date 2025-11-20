/**
 * Admin API - System Health Check
 * Check health status of all system components
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/system/health
 * Get comprehensive system health status
 */
export async function GET(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: false, // Don't log health checks
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const healthChecks = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkFlyte(),
      checkStorage(),
    ]);

    const [dbHealth, redisHealth, flyteHealth, storageHealth] = healthChecks.map((result) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        status: 'error',
        message: result.reason?.message || 'Unknown error',
      };
    });

    // Overall system status
    // Storage is optional, so not_configured is acceptable
    const storageHealthy =
      storageHealth.status === 'healthy' ||
      storageHealth.status === 'not_configured' ||
      storageHealth.status === 'unknown';

    const allHealthy =
      dbHealth.status === 'healthy' &&
      flyteHealth.status === 'healthy' &&
      (redisHealth.status === 'healthy' || redisHealth.status === 'unknown') &&
      storageHealthy;

    let overallStatus: string;
    if (allHealthy) {
      overallStatus = 'healthy';
    } else if (dbHealth.status === 'error' || flyteHealth.status === 'error') {
      overallStatus = 'critical';
    } else {
      overallStatus = 'degraded';
    }

    return NextResponse.json({
      success: true,
      data: {
        overall: overallStatus,
        components: {
          database: dbHealth,
          redis: redisHealth,
          flyte: flyteHealth,
          storage: storageHealth,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error checking system health:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check system health',
      },
      { status: 500 }
    );
  }
}

/**
 * Check database health
 */
async function checkDatabase() {
  try {
    const { prisma } = await import('src/lib/prisma');

    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    // Check connection pool
    // Note: $metrics doesn't exist in Prisma client
    const metrics: any = null; // await prisma.$metrics.json();

    return {
      status: latency < 100 ? 'healthy' : 'degraded',
      latency,
      connections:
        metrics?.counters?.find((c: any) => c.key.includes('pool.connections.open'))?.value || 0,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Database error',
      latency: 0,
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedis() {
  try {
    const { redisClient } = await import('src/lib/redis/client');

    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;

    return {
      status: latency < 100 ? 'healthy' : 'degraded',
      latency,
    };
  } catch (error) {
    return {
      status: 'unknown',
      message: error instanceof Error ? error.message : 'Redis error',
    };
  }
}

/**
 * Check Flyte engine health
 */
async function checkFlyte() {
  try {
    const { getOrInitializeEngine } = await import('src/app/api/lib/services/engine-helper');

    const start = Date.now();
    const engine = await getOrInitializeEngine();
    const latency = Date.now() - start;

    if (!engine || !engine.services.admin) {
      return {
        status: 'unavailable',
        message: 'Flyte engine not available',
      };
    }

    // Try to list projects as a health check
    try {
      await engine.services.admin.listProjects({ limit: 1 } as any);
      return {
        status: 'healthy',
        latency,
      };
    } catch {
      return {
        status: 'degraded',
        message: 'Flyte responding but errors occurred',
        latency,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Flyte error',
    };
  }
}

/**
 * Check storage (S3) health
 */
async function checkStorage() {
  try {
    // Check if S3 is configured
    const awsRegion = process.env.AWS_REGION;
    const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const awsBucket = process.env.AWS_S3_BUCKET;

    if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey || !awsBucket) {
      return {
        status: 'not_configured',
        message: 'S3 storage is not configured',
      };
    }

    // Import S3 client
    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');

    const s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });

    const start = Date.now();
    await s3Client.send(new HeadBucketCommand({ Bucket: awsBucket }));
    const latency = Date.now() - start;

    return {
      status: latency < 500 ? 'healthy' : 'degraded',
      latency,
      bucket: awsBucket,
      region: awsRegion,
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Storage error',
    };
  }
}
