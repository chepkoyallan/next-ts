/**
 * Health Check Service
 * Provides health, liveness, and readiness checks for the application
 */

import { prisma } from '@app/database';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      responseTime?: number;
      details?: any;
    };
  };
}

export interface ReadinessCheckResult {
  ready: boolean;
  checks: {
    [key: string]: {
      ready: boolean;
      message?: string;
    };
  };
}

/**
 * Basic health check - is the service running?
 */
export async function healthCheck(): Promise<{ status: 'ok'; timestamp: string }> {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
}

/**
 * Liveness probe - is the application alive?
 * Used by Kubernetes to determine if container should be restarted
 */
export async function livenessCheck(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {
    process: {
      status: 'pass',
      message: 'Process is running',
      details: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    },
  };

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  };
}

/**
 * Readiness probe - is the application ready to serve traffic?
 * Checks all critical dependencies
 */
export async function readinessCheck(): Promise<ReadinessCheckResult> {
  const checks: ReadinessCheckResult['checks'] = {};

  // Check database connection
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      ready: true,
      message: `Database connected (${Date.now() - dbStart}ms)`,
    };
  } catch (error: any) {
    checks.database = {
      ready: false,
      message: `Database connection failed: ${error.message}`,
    };
  }

  // Check Redis connection (if available)
  try {
    const redisHost = process.env.REDIS_HOST;
    if (redisHost) {
      // Redis check would go here
      checks.redis = {
        ready: true,
        message: 'Redis configuration found',
      };
    }
  } catch (error: any) {
    checks.redis = {
      ready: false,
      message: `Redis check failed: ${error.message}`,
    };
  }

  // Check gRPC services (if available)
  try {
    const orchestratorHost = process.env.FLYTE_ADMIN_HOST;
    if (orchestratorHost) {
      checks.orchestrator = {
        ready: true,
        message: 'Orchestrator configuration found',
      };
    }
  } catch (error: any) {
    checks.orchestrator = {
      ready: false,
      message: `Orchestrator check failed: ${error.message}`,
    };
  }

  // Determine overall readiness
  const ready = Object.values(checks).every((check) => check.ready);

  return {
    ready,
    checks,
  };
}

/**
 * Detailed health check - comprehensive system status
 */
export async function detailedHealthCheck(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {};

  // Database check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - dbStart;

    checks.database = {
      status: responseTime < 100 ? 'pass' : 'warn',
      message: 'Database connection successful',
      responseTime,
      details: {
        type: 'PostgreSQL',
        host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown',
      },
    };
  } catch (error: any) {
    checks.database = {
      status: 'fail',
      message: `Database error: ${error.message}`,
    };
  }

  // Memory check
  const memoryUsage = process.memoryUsage();
  const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

  let memoryStatus: 'pass' | 'warn' | 'fail' = 'pass';
  if (memoryUsagePercent >= 95) {
    memoryStatus = 'fail';
  } else if (memoryUsagePercent >= 80) {
    memoryStatus = 'warn';
  }

  checks.memory = {
    status: memoryStatus,
    message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
    details: {
      heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
    },
  };

  // Environment check
  checks.environment = {
    status: 'pass',
    message: 'Environment configuration loaded',
    details: {
      nodeEnv: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  // Determine overall status
  const hasFailures = Object.values(checks).some((check) => check.status === 'fail');
  const hasWarnings = Object.values(checks).some((check) => check.status === 'warn');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (hasFailures) {
    overallStatus = 'unhealthy';
  } else if (hasWarnings) {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  };
}

/**
 * Get service dependencies status
 */
export async function getDependenciesStatus(): Promise<{
  [key: string]: {
    available: boolean;
    configured: boolean;
    message: string;
  };
}> {
  return {
    database: {
      available: !!process.env.DATABASE_URL,
      configured: true,
      message: process.env.DATABASE_URL ? 'Database configured' : 'Database not configured',
    },
    redis: {
      available: !!process.env.REDIS_HOST,
      configured: !!process.env.REDIS_HOST,
      message: process.env.REDIS_HOST ? 'Redis configured' : 'Redis not configured',
    },
    orchestrator: {
      available: !!process.env.FLYTE_ADMIN_HOST,
      configured: !!process.env.FLYTE_ADMIN_HOST,
      message: process.env.FLYTE_ADMIN_HOST
        ? 'Orchestrator configured'
        : 'Orchestrator not configured',
    },
    smtp: {
      available: !!process.env.SMTP_HOST,
      configured: !!process.env.SMTP_HOST,
      message: process.env.SMTP_HOST ? 'SMTP configured' : 'SMTP not configured',
    },
    storage: {
      available: !!process.env.AWS_S3_BUCKET || !!process.env.GCS_BUCKET,
      configured: !!process.env.AWS_S3_BUCKET || !!process.env.GCS_BUCKET,
      message:
        process.env.AWS_S3_BUCKET || process.env.GCS_BUCKET
          ? 'Cloud storage configured'
          : 'Cloud storage not configured',
    },
  };
}

/**
 * Cleanup resources
 * Note: Using singleton prisma client - no manual cleanup needed
 */
export async function cleanup(): Promise<void> {
  // Singleton prisma client is managed globally
  // No manual cleanup needed here
}
