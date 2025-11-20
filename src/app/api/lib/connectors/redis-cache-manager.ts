/**
 * Redis Cache Manager
 * Production-ready distributed caching using Redis
 */

import { redisClient, connectRedis } from '@app/cache/client';

import { ICacheService } from './types';
import { logger } from '../utils/logger';

export class RedisCacheManager implements ICacheService {
  private isConnected: boolean = false;

  constructor() {
    this.ensureConnection();
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await connectRedis();
        this.isConnected = true;
        logger.info('Redis connector cache manager initialized');
      } catch (error) {
        logger.error('Failed to connect Redis for connector caching', error as Error);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureConnection();

    try {
      const value = await redisClient.get(key);
      if (!value) {
        logger.debug('Redis cache miss', { key });
        return null;
      }

      logger.debug('Redis cache hit', { key });
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis get error', error, { key });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await this.ensureConnection();

    try {
      const serialized = JSON.stringify(value);
      await redisClient.setEx(key, ttl, serialized);

      logger.debug('Redis cache set', {
        key,
        ttl,
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
      });
    } catch (error) {
      logger.error('Redis set error', error, { key });
      // Don't throw - caching is not critical
    }
  }

  async delete(key: string): Promise<void> {
    await this.ensureConnection();

    try {
      await redisClient.del(key);
      logger.debug('Redis cache entry deleted', { key });
    } catch (error) {
      logger.error('Redis delete error', error, { key });
    }
  }

  async invalidate(pattern: string): Promise<void> {
    await this.ensureConnection();

    try {
      const deletedCount = await this.scanAndDelete(pattern, 0, 0);
      logger.info('Redis cache invalidated', { pattern, count: deletedCount });
    } catch (error) {
      logger.error('Redis invalidate error', error, { pattern });
    }
  }

  /**
   * Recursively scan and delete keys matching pattern
   */
  private async scanAndDelete(
    pattern: string,
    cursor: number,
    deletedCount: number
  ): Promise<number> {
    const result = await redisClient.scan(cursor as any, {
      MATCH: pattern,
      COUNT: 100,
    });

    const newCursor = result.cursor;
    const matchedKeys = result.keys;
    let newDeletedCount = deletedCount;

    if (matchedKeys.length > 0) {
      await redisClient.del(matchedKeys);
      newDeletedCount += matchedKeys.length;
    }

    if (newCursor === '0') {
      return newDeletedCount;
    }

    return this.scanAndDelete(pattern, parseInt(newCursor, 10), newDeletedCount);
  }

  async has(key: string): Promise<boolean> {
    await this.ensureConnection();

    try {
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Redis has error', error, { key });
      return false;
    }
  }

  async getOrFetch<T>(key: string, ttl: number, fetchFn: () => Promise<T>): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    logger.debug('Fetching fresh data', { key });
    const value = await fetchFn();

    // Store in cache
    await this.set(key, value, ttl);

    return value;
  }

  async clear(): Promise<void> {
    await this.ensureConnection();

    try {
      // Clear only connector-related keys, not all Redis data
      await this.invalidate('connector:*');
      logger.info('Connector cache cleared');
    } catch (error) {
      logger.error('Redis clear error', error);
    }
  }

  static getStats(): {
    size: number;
    totalHits: number;
    entries: Array<{ key: string; hits: number; age: number; ttl: number }>;
  } {
    // Redis doesn't track hit counts per key by default
    // Would need to implement custom hit counting if needed
    return {
      size: 0,
      totalHits: 0,
      entries: [],
    };
  }
}
