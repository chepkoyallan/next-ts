/**
 * Redis Rate Limiter
 * Production-ready distributed rate limiting using Redis sorted sets
 */

import { redisClient, connectRedis } from '@app/cache/client';

import { logger } from '../utils/logger';
import { IRateLimiter, RateLimitConfig, ConnectorRateLimitError } from './types';

export class RedisRateLimiter implements IRateLimiter {
  private isConnected: boolean = false;

  constructor() {
    this.ensureConnection();
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await connectRedis();
        this.isConnected = true;
        logger.info('Redis connector rate limiter initialized');
      } catch (error) {
        logger.error('Failed to connect Redis for connector rate limiting', error as Error);
      }
    }
  }

  async checkLimit(connectorId: string, config: RateLimitConfig): Promise<boolean> {
    if (!config.enabled) return true;

    await this.ensureConnection();

    const key = `ratelimit:connector:${connectorId}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Remove old entries outside window
      await redisClient.zRemRangeByScore(key, 0, windowStart);

      // Count current requests
      const count = await redisClient.zCard(key);

      return count < config.maxRequests;
    } catch (error) {
      logger.error('Redis rate limit check error', error, { connectorId });
      // Fail open - allow request if Redis is down
      return true;
    }
  }

  async recordRequest(connectorId: string): Promise<void> {
    await this.ensureConnection();

    const key = `ratelimit:connector:${connectorId}`;
    const now = Date.now();

    try {
      await redisClient.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      await redisClient.expire(key, 3600); // 1 hour expiry
    } catch (error) {
      logger.error('Redis rate limit record error', error, { connectorId });
    }
  }

  async getRemainingQuota(connectorId: string, config: RateLimitConfig): Promise<number> {
    if (!config.enabled) return Infinity;

    await this.ensureConnection();

    const key = `ratelimit:connector:${connectorId}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      await redisClient.zRemRangeByScore(key, 0, windowStart);
      const count = await redisClient.zCard(key);

      return Math.max(0, config.maxRequests - count);
    } catch (error) {
      logger.error('Redis get remaining quota error', error, { connectorId });
      return config.maxRequests; // Fail open
    }
  }

  async resetLimit(connectorId: string): Promise<void> {
    await this.ensureConnection();

    const key = `ratelimit:connector:${connectorId}`;

    try {
      await redisClient.del(key);
      logger.info('Connector rate limit reset', { connectorId });
    } catch (error) {
      logger.error('Redis reset limit error', error, { connectorId });
    }
  }

  async getRetryAfter(connectorId: string, config: RateLimitConfig): Promise<number> {
    if (!config.enabled) return 0;

    await this.ensureConnection();

    const key = `ratelimit:connector:${connectorId}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    try {
      // Get oldest timestamp in current window using zRangeWithScores
      const oldest = await redisClient.zRangeWithScores(key, 0, 0);

      if (oldest.length === 0) return 0;

      const oldestScore = oldest[0].score;
      if (oldestScore > windowStart) {
        const retryAfter = oldestScore + config.windowMs - now;
        return Math.max(0, Math.ceil(retryAfter / 1000));
      }

      return 0;
    } catch (error) {
      logger.error('Redis get retry after error', error, { connectorId });
      return 0;
    }
  }

  async checkLimitOrThrow(connectorId: string, config: RateLimitConfig): Promise<void> {
    const allowed = await this.checkLimit(connectorId, config);

    if (!allowed) {
      const retryAfter = await this.getRetryAfter(connectorId, config);

      throw new ConnectorRateLimitError(
        `Rate limit exceeded for connector ${connectorId}. Try again in ${retryAfter} seconds.`,
        connectorId,
        retryAfter
      );
    }
  }
}
