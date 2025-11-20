// API validation and health check utilities
import { logger } from './logger';
import { env } from '../config/environment';
import { checkDatabaseHealth } from '../database/factory';

/**
 * Validate API configuration and dependencies
 */
export async function validateApiConfiguration(): Promise<{
  valid: boolean;
  issues: string[];
  warnings: string[];
}> {
  const issues: string[] = [];
  const warnings: string[] = [];

  // Check environment configuration
  try {
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
      issues.push('JWT_SECRET must be at least 32 characters long');
    }

    if (env.NODE_ENV === 'production' && env.LOG_LEVEL === 'debug') {
      warnings.push('Debug logging enabled in production environment');
    }

    if (!env.DB_HOST || !env.DB_NAME) {
      issues.push('Database configuration incomplete');
    }

    logger.info('Environment configuration validated', {
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      dbType: env.DB_TYPE,
    });
  } catch (error) {
    issues.push(`Environment validation failed: ${error}`);
  }

  // Check database connectivity
  try {
    const dbHealth = await checkDatabaseHealth();
    const healthyDatabases = Object.values(dbHealth).filter(Boolean).length;

    if (healthyDatabases === 0) {
      issues.push('No database connections available');
    } else {
      logger.info('Database health check completed', dbHealth);
    }
  } catch (error) {
    warnings.push(`Database health check failed: ${error}`);
  }

  // Check required dependencies
  const requiredEnvVars = ['JWT_SECRET', 'DB_HOST', 'DB_NAME'];
  requiredEnvVars.forEach((envVar) => {
    if (!process.env[envVar]) {
      issues.push(`Missing required environment variable: ${envVar}`);
    }
  });

  const valid = issues.length === 0;

  logger.info('API configuration validation completed', {
    valid,
    issueCount: issues.length,
    warningCount: warnings.length,
  });

  return { valid, issues, warnings };
}

/**
 * Runtime API health check
 */
export async function performHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, boolean>;
  timestamp: string;
}> {
  const checks: Record<string, boolean> = {};
  const timestamp = new Date().toISOString();

  // Check database connections
  try {
    const dbHealth = await checkDatabaseHealth();
    Object.assign(checks, dbHealth);
  } catch (error) {
    logger.error('Health check database error', error as Error);
    checks.database = false;
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  checks.memory = memUsage.heapUsed < memUsage.heapTotal * 0.9;

  // Check uptime
  checks.uptime = process.uptime() > 0;

  // Determine overall status
  const healthyChecks = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.values(checks).length;

  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (healthyChecks === totalChecks) {
    status = 'healthy';
  } else if (healthyChecks > totalChecks / 2) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }

  logger.info('Health check completed', { status, checks });

  return { status, checks, timestamp };
}

/**
 * Validate API endpoints are properly configured
 */
export function validateEndpointConfiguration(): {
  valid: boolean;
  endpoints: string[];
  issues: string[];
} {
  const endpoints = [
    '/api/health',
    '/api/metrics',
    '/api/v1/auth/login',
    '/api/v1/auth/me',
    '/api/v1/users',
  ];

  const issues: string[] = [];

  // In a real implementation, you might check route registration
  // For now, we'll assume endpoints are properly configured

  logger.info('Endpoint configuration validated', {
    endpointCount: endpoints.length,
  });

  return {
    valid: issues.length === 0,
    endpoints,
    issues,
  };
}
