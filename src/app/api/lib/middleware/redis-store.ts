/**
 * Redis-based Rate Limit Store
 * Distributed rate limiting using Redis for multi-instance deployments
 */

import { redisClient, connectRedis } from '@app/cache/client';

import { logger } from '../utils/logger';
import type { RateLimitEntry } from './rate-limit-store';

/**
 * Redis-based rate limit store (for production use)
 * Uses Redis sorted sets for accurate sliding window rate limiting
 */
export class RedisStore {
  private static isInitialized = false;

  /**
   * Initialize Redis connection
   * Returns false if connection fails (for fail-open behavior)
   */
  private static async ensureConnection(): Promise<boolean> {
    if (!this.isInitialized) {
      try {
        await connectRedis();
        this.isInitialized = true;
        return true;
      } catch (error) {
        logger.error('Failed to connect to Redis for rate limiting', error as Error);
        // Don't throw - fail open
        return false;
      }
    }
    return true;
  }

  /**
   * Increment request count using sliding window algorithm
   * @param key - Rate limit key
   * @param windowMs - Time window in milliseconds
   * @returns Current rate limit entry
   */
  static async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const connected = await this.ensureConnection();
    const now = Date.now();

    // Fail open if Redis unavailable
    if (!connected) {
      return {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    const windowStart = now - windowMs;
    const redisKey = `ratelimit:${key}`;

    try {
      // Use Redis transaction for atomic operations
      const multi = redisClient.multi();

      // Remove old entries outside the window
      multi.zRemRangeByScore(redisKey, 0, windowStart);

      // Add current request with timestamp as score
      multi.zAdd(redisKey, { score: now, value: `${now}-${Math.random()}` });

      // Count requests in current window
      multi.zCard(redisKey);

      // Set expiry to prevent memory leaks
      multi.expire(redisKey, Math.ceil(windowMs / 1000) + 10);

      const results = await multi.exec();

      // Extract count from zCard result
      const count = (results?.[2] as any as number) || 0;

      const entry: RateLimitEntry = {
        count,
        resetTime: now + windowMs,
      };

      return entry;
    } catch (error) {
      logger.error('Redis rate limit increment error', error as Error, { key });
      // Fail open - allow request if Redis is down
      return {
        count: 0,
        resetTime: now + windowMs,
      };
    }
  }

  /**
   * Get current rate limit entry
   * @param key - Rate limit key
   * @returns Current entry or undefined
   */
  static async get(key: string): Promise<RateLimitEntry | undefined> {
    const connected = await this.ensureConnection();
    if (!connected) return undefined;

    const redisKey = `ratelimit:${key}`;
    const now = Date.now();

    try {
      const count = await redisClient.zCard(redisKey);
      const ttl = await redisClient.ttl(redisKey);

      if (ttl <= 0) {
        return undefined;
      }

      return {
        count,
        resetTime: now + ttl * 1000,
      };
    } catch (error) {
      logger.error('Redis rate limit get error', error as Error, { key });
      return undefined;
    }
  }

  /**
   * Set rate limit entry (not commonly used with sliding window)
   * @param key - Rate limit key
   * @param entry - Rate limit entry
   */
  static async set(key: string, entry: RateLimitEntry): Promise<void> {
    const connected = await this.ensureConnection();
    if (!connected) return;

    const redisKey = `ratelimit:${key}`;
    const ttl = Math.ceil((entry.resetTime - Date.now()) / 1000);

    if (ttl <= 0) return;

    try {
      await redisClient.del(redisKey);

      // Add dummy entries to represent count
      const multi = redisClient.multi();
      const now = Date.now();

      for (let i = 0; i < entry.count; i += 1) {
        multi.zAdd(redisKey, { score: now - i, value: `${now - i}-${i}` });
      }

      multi.expire(redisKey, ttl);
      await multi.exec();
    } catch (error) {
      logger.error('Redis rate limit set error', error as Error, { key });
    }
  }

  /**
   * Delete rate limit entry
   * @param key - Rate limit key
   */
  static async delete(key: string): Promise<void> {
    const connected = await this.ensureConnection();
    if (!connected) return;

    const redisKey = `ratelimit:${key}`;

    try {
      await redisClient.del(redisKey);
    } catch (error) {
      logger.error('Redis rate limit delete error', error as Error, { key });
    }
  }

  /**
   * Cleanup expired entries (Redis handles this automatically with TTL)
   */
  static async cleanup(): Promise<void> {
    // Redis automatically cleans up expired keys
    // This is a no-op for compatibility with MemoryStore interface
  }
}
