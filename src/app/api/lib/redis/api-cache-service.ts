/**
 * API Response Caching Service
 * High-performance caching layer for API responses using Redis
 * Supplements Prisma Accelerate for custom cache control
 */

import { createHash } from 'crypto';

import { redisClient, connectRedis } from '@app/cache/client';

import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  namespace?: string; // Cache namespace
  compress?: boolean; // Compress large responses
}

export class ApiCacheService {
  private isConnected = false;

  constructor() {
    this.ensureConnection();
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await connectRedis();
        this.isConnected = true;
        logger.info('API Cache Service initialized');
      } catch (error) {
        logger.error('Failed to connect Redis for API caching', error as Error);
      }
    }
  }

  /**
   * Generate cache key from request parameters
   */
  private static generateKey(
    endpoint: string,
    params: Record<string, any>,
    userId?: string,
    namespace?: string
  ): string {
    // Sort params for consistent keys
    const sortedParams = Object.keys(params)
      .sort()
      .reduce(
        (acc, key) => {
          acc[key] = params[key];
          return acc;
        },
        {} as Record<string, any>
      );

    const paramsHash = createHash('md5')
      .update(JSON.stringify(sortedParams))
      .digest('hex')
      .substring(0, 8);

    const parts = ['api-cache'];

    if (namespace) parts.push(namespace);
    if (userId) parts.push(`user:${userId}`);

    parts.push(endpoint, paramsHash);

    return parts.join(':');
  }

  /**
   * Get cached response
   */
  async get<T>(
    endpoint: string,
    params: Record<string, any> = {},
    userId?: string,
    namespace?: string
  ): Promise<T | null> {
    await this.ensureConnection();

    const key = ApiCacheService.generateKey(endpoint, params, userId, namespace);

    try {
      const cached = await redisClient.get(key);

      if (!cached) {
        logger.debug('API cache miss', { endpoint, key });
        return null;
      }

      logger.debug('API cache hit', { endpoint, key });

      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error('API cache get error', error, { endpoint, key });
      return null;
    }
  }

  /**
   * Set cached response
   */
  async set<T>(
    endpoint: string,
    data: T,
    options: CacheOptions,
    params: Record<string, any> = {},
    userId?: string
  ): Promise<void> {
    await this.ensureConnection();

    const key = ApiCacheService.generateKey(endpoint, params, userId, options.namespace);

    try {
      const serialized = JSON.stringify(data);

      // Set main cache entry
      await redisClient.setEx(key, options.ttl, serialized);

      // Add to tag sets for invalidation
      if (options.tags && options.tags.length > 0) {
        const multi = redisClient.multi();

        for (let i = 0; i < options.tags.length; i += 1) {
          const tag = options.tags[i];
          const tagKey = `cache-tag:${tag}`;
          multi.sAdd(tagKey, key);
          multi.expire(tagKey, options.ttl + 60); // Tag expires slightly after cache
        }

        await multi.exec();
      }

      logger.debug('API cache set', {
        endpoint,
        key,
        ttl: options.ttl,
        tags: options.tags,
      });
    } catch (error) {
      logger.error('API cache set error', error, { endpoint, key });
    }
  }

  /**
   * Get or fetch pattern
   */
  async getOrFetch<T>(
    endpoint: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions,
    params: Record<string, any> = {},
    userId?: string
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(endpoint, params, userId, options.namespace);

    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    logger.debug('API cache fetch', { endpoint });
    const data = await fetchFn();

    // Cache result (don't await to not block response)
    this.set(endpoint, data, options, params, userId).catch((err) => {
      logger.error('Background cache set failed', err, { endpoint });
    });

    return data;
  }

  /**
   * Invalidate cache by tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    await this.ensureConnection();

    const tagKey = `cache-tag:${tag}`;

    try {
      // Get all keys with this tag
      const keys = await redisClient.sMembers(tagKey);

      if (keys.length === 0) {
        logger.debug('No keys found for tag', { tag });
        return 0;
      }

      // Delete all keys
      await redisClient.del(keys);

      // Delete tag set
      await redisClient.del(tagKey);

      logger.info('Cache invalidated by tag', { tag, count: keys.length });

      return keys.length;
    } catch (error) {
      logger.error('Cache invalidation error', error, { tag });
      return 0;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    await this.ensureConnection();

    const scanAndDelete = async (cursor: string, deletedCount: number): Promise<number> => {
      const result = await redisClient.scan(cursor, {
        MATCH: pattern,
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

      return scanAndDelete(result.cursor, newDeletedCount);
    };

    try {
      const deletedCount = await scanAndDelete('0', 0);

      logger.info('Cache invalidated by pattern', { pattern, count: deletedCount });

      return deletedCount;
    } catch (error) {
      logger.error('Cache invalidation error', error, { pattern });
      return 0;
    }
  }

  /**
   * Clear all API cache
   */
  async clearAll(namespace?: string): Promise<void> {
    await this.ensureConnection();

    const pattern = namespace ? `api-cache:${namespace}:*` : 'api-cache:*';

    await this.invalidateByPattern(pattern);

    logger.info('API cache cleared', { namespace });
  }
}

// Export singleton
export const apiCache = new ApiCacheService();

// Predefined cache configurations
export const CacheProfiles = {
  // Quick cache for frequently changing data (30 seconds)
  QUICK: { ttl: 30 },

  // Standard cache for semi-static data (5 minutes)
  STANDARD: { ttl: 300 },

  // Long cache for static data (1 hour)
  LONG: { ttl: 3600 },

  // Dashboard metrics (2 minutes with tags)
  DASHBOARD: {
    ttl: 120,
    tags: ['dashboard', 'metrics'],
    namespace: 'admin',
  },

  // Organization data (5 minutes with tags)
  ORGANIZATION: {
    ttl: 300,
    tags: ['organization'],
    namespace: 'admin',
  },

  // User permissions (10 minutes with tags)
  PERMISSIONS: {
    ttl: 600,
    tags: ['permissions', 'roles'],
    namespace: 'auth',
  },

  // Subscription plans (1 hour - rarely changes)
  PLANS: {
    ttl: 3600,
    tags: ['billing', 'plans'],
    namespace: 'billing',
  },
};
