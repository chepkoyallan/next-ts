/**
 * Redis Health and Monitoring API
 * Provides Redis connection status, stats, and metrics
 */

import { NextRequest, NextResponse } from 'next/server';

import { redisClient } from '@app/cache/client';
import { logger } from 'src/app/api/lib/utils/logger';
import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/redis/health
 * Get Redis health status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: false,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    // Check Redis connection
    let isConnected = false;
    let connectionError = null;

    try {
      await redisClient.ping();
      isConnected = true;
    } catch (error: any) {
      connectionError = error.message;
      logger.error('Redis ping failed', error);
    }

    if (!isConnected) {
      return NextResponse.json(
        {
          success: false,
          error: 'Redis is not connected',
          details: connectionError,
        },
        { status: 503 }
      );
    }

    // Get Redis INFO
    const info = await redisClient.info();
    const parsedInfo = parseRedisInfo(info);

    // Get key statistics
    const keyStats = await getKeyStatistics();

    // Get memory usage
    const memoryInfo = parsedInfo.Memory || {};

    // Get client connections
    const clientInfo = parsedInfo.Clients || {};

    // Get command stats
    const commandStats = parsedInfo.Stats || {};

    return NextResponse.json({
      success: true,
      data: {
        status: 'connected',
        uptime: parsedInfo.Server?.uptime_in_seconds || 0,
        version: parsedInfo.Server?.redis_version || 'unknown',
        mode: parsedInfo.Server?.redis_mode || 'standalone',
        memory: {
          used: memoryInfo.used_memory_human || '0',
          peak: memoryInfo.used_memory_peak_human || '0',
          rss: memoryInfo.used_memory_rss_human || '0',
          fragmentation: memoryInfo.mem_fragmentation_ratio || 0,
        },
        clients: {
          connected: parseInt(clientInfo.connected_clients || '0', 10),
          blocked: parseInt(clientInfo.blocked_clients || '0', 10),
        },
        stats: {
          totalConnections: parseInt(commandStats.total_connections_received || '0', 10),
          totalCommands: parseInt(commandStats.total_commands_processed || '0', 10),
          opsPerSec: parseFloat(commandStats.instantaneous_ops_per_sec || '0'),
          hitRate:
            calculateHitRate(
              parseInt(commandStats.keyspace_hits || '0', 10),
              parseInt(commandStats.keyspace_misses || '0', 10)
            ) || 0,
        },
        keys: keyStats,
        persistence: {
          rdbLastSaveTime: parsedInfo.Persistence?.rdb_last_save_time || 0,
          aofEnabled: parsedInfo.Persistence?.aof_enabled === '1',
        },
        replication: {
          role: parsedInfo.Replication?.role || 'master',
          connectedSlaves: parseInt(parsedInfo.Replication?.connected_slaves || '0', 10),
        },
      },
    });
  } catch (error: any) {
    logger.error('Redis health check error', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get Redis health',
      },
      { status: 500 }
    );
  }
}

/**
 * Parse Redis INFO output
 */
function parseRedisInfo(info: string): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  let currentSection = '';

  info.split('\r\n').forEach((line) => {
    if (line.startsWith('#')) {
      // Section header
      currentSection = line.substring(2).trim();
      result[currentSection] = {};
    } else if (line.includes(':')) {
      // Key-value pair
      const [key, value] = line.split(':');
      if (currentSection && key && value) {
        result[currentSection][key.trim()] = value.trim();
      }
    }
  });

  return result;
}

/**
 * Helper function to count keys for a namespace using recursion
 */
async function countNamespaceKeys(
  namespace: string,
  cursor: number,
  count: number
): Promise<number> {
  const result = await redisClient.scan(cursor as any, {
    MATCH: `${namespace}:*`,
    COUNT: 100,
  });

  const newCount = count + result.keys.length;

  if (result.cursor === '0') {
    return newCount;
  }

  return countNamespaceKeys(namespace, parseInt(result.cursor, 10), newCount);
}

/**
 * Get key statistics by namespace
 */
async function getKeyStatistics(): Promise<{
  total: number;
  byNamespace: Record<string, number>;
}> {
  try {
    const namespaces = [
      'session',
      'blacklist',
      'ratelimit',
      'connector',
      'api-cache',
      'idempotency',
      'lock',
      'oauth',
      '2fa',
      'password-reset',
    ];

    // Process all namespaces in parallel
    const countPromises = namespaces.map(async (namespace) => {
      const count = await countNamespaceKeys(namespace, 0, 0);
      return { namespace, count };
    });

    const results = await Promise.all(countPromises);

    const counts: Record<string, number> = {};
    let total = 0;

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      counts[result.namespace] = result.count;
      total += result.count;
    }

    return {
      total,
      byNamespace: counts,
    };
  } catch (error) {
    logger.error('Failed to get key statistics', error as Error);
    return {
      total: 0,
      byNamespace: {},
    };
  }
}

/**
 * Calculate cache hit rate
 */
function calculateHitRate(hits: number, misses: number): number {
  const total = hits + misses;
  if (total === 0) return 0;
  return parseFloat(((hits / total) * 100).toFixed(2));
}
