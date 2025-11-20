/**
 * Redis Statistics API
 * Provides detailed Redis usage statistics
 */

import { NextRequest, NextResponse } from 'next/server';

import { redisClient } from '@app/cache/client';
import { logger } from 'src/app/api/lib/utils/logger';
import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/redis/stats
 * Get detailed Redis usage statistics
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

    // Get query parameters
    const { searchParams } = request.nextUrl;
    const namespace = searchParams.get('namespace');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Get keys by namespace
    const keys = namespace
      ? await getKeysByNamespace(namespace, limit)
      : await getAllKeysByNamespace(limit);

    // Get key details
    const keyDetails = await Promise.all(
      keys.slice(0, Math.min(keys.length, 50)).map(async (key) => {
        try {
          const [type, ttl, memoryUsage] = await Promise.all([
            redisClient.type(key),
            redisClient.ttl(key),
            redisClient.memoryUsage(key).catch(() => 0),
          ]);

          return {
            key,
            type,
            ttl: ttl === -1 ? 'persistent' : `${ttl}s`,
            memory: memoryUsage ? `${(memoryUsage / 1024).toFixed(2)} KB` : 'N/A',
          };
        } catch {
          return {
            key,
            type: 'error',
            ttl: 'N/A',
            memory: 'N/A',
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        totalKeys: keys.length,
        keys: keyDetails,
        namespace: namespace || 'all',
      },
    });
  } catch (error: any) {
    logger.error('Redis stats error', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get Redis stats',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/redis/stats
 * Clear Redis cache by namespace
 */
export async function DELETE(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'super-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { searchParams } = request.nextUrl;
    const namespace = searchParams.get('namespace');

    if (!namespace) {
      return NextResponse.json(
        {
          success: false,
          error: 'Namespace parameter is required',
        },
        { status: 400 }
      );
    }

    const deletedCount = await clearNamespace(namespace);

    return NextResponse.json({
      success: true,
      data: {
        namespace,
        deletedKeys: deletedCount,
      },
      message: `Cleared ${deletedCount} keys from namespace: ${namespace}`,
    });
  } catch (error: any) {
    logger.error('Redis clear error', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to clear Redis cache',
      },
      { status: 500 }
    );
  }
}

/**
 * Get keys by namespace
 */
async function getKeysByNamespace(namespace: string, limit: number): Promise<string[]> {
  async function scanKeys(cursor: number, keys: string[]): Promise<string[]> {
    const result = await redisClient.scan(cursor as any, {
      MATCH: `${namespace}:*`,
      COUNT: Math.min(limit, 100),
    });

    const newKeys = [...keys, ...result.keys];

    if (newKeys.length >= limit || result.cursor === '0') {
      return newKeys.slice(0, limit);
    }

    return scanKeys(parseInt(result.cursor, 10), newKeys);
  }

  return scanKeys(0, []);
}

/**
 * Get all keys grouped by namespace
 */
async function getAllKeysByNamespace(limit: number): Promise<string[]> {
  async function scanAllKeys(cursor: number, keys: string[]): Promise<string[]> {
    const result = await redisClient.scan(cursor as any, {
      COUNT: Math.min(limit, 100),
    });

    const newKeys = [...keys, ...result.keys];

    if (newKeys.length >= limit || result.cursor === '0') {
      return newKeys.slice(0, limit);
    }

    return scanAllKeys(parseInt(result.cursor, 10), newKeys);
  }

  return scanAllKeys(0, []);
}

/**
 * Clear namespace
 */
async function clearNamespace(namespace: string): Promise<number> {
  async function scanAndDelete(cursor: number, deletedCount: number): Promise<number> {
    const result = await redisClient.scan(cursor as any, {
      MATCH: `${namespace}:*`,
      COUNT: 100,
    });

    const resultKeys = result.keys;
    let newDeletedCount = deletedCount;

    if (resultKeys.length > 0) {
      await redisClient.del(resultKeys);
      newDeletedCount += resultKeys.length;
    }

    if (result.cursor === '0') {
      return newDeletedCount;
    }

    return scanAndDelete(parseInt(result.cursor, 10), newDeletedCount);
  }

  return scanAndDelete(0, 0);
}
