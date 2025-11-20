/**
 * In-Memory Rate Limiter
 * Local memory-based rate limiting using sliding window algorithm
 */

import { logger } from '../utils/logger';
import { IRateLimiter, RateLimitConfig, ConnectorRateLimitError } from './types';

/**
 * Request record for rate limiting
 */
interface RequestRecord {
  timestamps: number[];
  windowStart: number;
}

/**
 * Rate Limiter Implementation
 * Uses sliding window algorithm for accurate rate limiting
 */
export class ConnectorRateLimiter implements IRateLimiter {
  private requests: Map<string, RequestRecord>;

  private cleanupInterval: NodeJS.Timeout | null = null;

  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  constructor() {
    this.requests = new Map();
    this.startCleanupTimer();
  }

  /**
   * Check if request is within rate limit
   * Returns true if allowed, false if rate limit exceeded
   */
  async checkLimit(connectorId: string, config: RateLimitConfig): Promise<boolean> {
    if (!config.enabled) {
      return true;
    }

    const now = Date.now();
    const key = ConnectorRateLimiter.getKey(connectorId);
    const record = this.getOrCreateRecord(key);

    // Clean up old timestamps outside the window
    const windowStart = now - config.windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    // Check if limit exceeded
    const currentCount = record.timestamps.length;

    if (currentCount >= config.maxRequests) {
      logger.warn('Rate limit exceeded', {
        connectorId,
        currentCount,
        maxRequests: config.maxRequests,
        windowMs: config.windowMs,
      });
      return false;
    }

    logger.debug('Rate limit check passed', {
      connectorId,
      currentCount,
      maxRequests: config.maxRequests,
      remaining: config.maxRequests - currentCount,
    });

    return true;
  }

  /**
   * Record a request
   */
  async recordRequest(connectorId: string): Promise<void> {
    const now = Date.now();
    const key = ConnectorRateLimiter.getKey(connectorId);
    const record = this.getOrCreateRecord(key);

    record.timestamps.push(now);

    logger.debug('Request recorded', {
      connectorId,
      totalRequests: record.timestamps.length,
    });
  }

  /**
   * Get remaining quota for a connector
   */
  async getRemainingQuota(connectorId: string, config: RateLimitConfig): Promise<number> {
    if (!config.enabled) {
      return Infinity;
    }

    const now = Date.now();
    const key = ConnectorRateLimiter.getKey(connectorId);
    const record = this.requests.get(key);

    if (!record) {
      return config.maxRequests;
    }

    // Clean up old timestamps
    const windowStart = now - config.windowMs;
    const validTimestamps = record.timestamps.filter((ts) => ts > windowStart);

    const remaining = Math.max(0, config.maxRequests - validTimestamps.length);

    return remaining;
  }

  /**
   * Reset limit for a connector
   */
  async resetLimit(connectorId: string): Promise<void> {
    const key = ConnectorRateLimiter.getKey(connectorId);
    this.requests.delete(key);

    logger.info('Rate limit reset', { connectorId });
  }

  /**
   * Get time until next available request slot
   */
  async getRetryAfter(connectorId: string, config: RateLimitConfig): Promise<number> {
    if (!config.enabled) {
      return 0;
    }

    const now = Date.now();
    const key = ConnectorRateLimiter.getKey(connectorId);
    const record = this.requests.get(key);

    if (!record || record.timestamps.length === 0) {
      return 0;
    }

    // Find the oldest timestamp in the current window
    const windowStart = now - config.windowMs;
    const validTimestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (validTimestamps.length < config.maxRequests) {
      return 0;
    }

    // Calculate when the oldest request will expire
    const oldestTimestamp = Math.min(...validTimestamps);
    const retryAfter = oldestTimestamp + config.windowMs - now;

    return Math.max(0, Math.ceil(retryAfter / 1000)); // Return in seconds
  }

  /**
   * Get rate limit statistics
   */
  getStats(
    connectorId: string,
    config: RateLimitConfig
  ): {
    current: number;
    limit: number;
    remaining: number;
    resetAt?: Date;
  } {
    if (!config.enabled) {
      return {
        current: 0,
        limit: Infinity,
        remaining: Infinity,
      };
    }

    const now = Date.now();
    const key = ConnectorRateLimiter.getKey(connectorId);
    const record = this.requests.get(key);

    if (!record) {
      return {
        current: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
      };
    }

    const windowStart = now - config.windowMs;
    const validTimestamps = record.timestamps.filter((ts) => ts > windowStart);
    const current = validTimestamps.length;
    const remaining = Math.max(0, config.maxRequests - current);

    // Calculate reset time (when the oldest request expires)
    let resetAt: Date | undefined;
    if (validTimestamps.length > 0) {
      const oldestTimestamp = Math.min(...validTimestamps);
      resetAt = new Date(oldestTimestamp + config.windowMs);
    }

    return {
      current,
      limit: config.maxRequests,
      remaining,
      resetAt,
    };
  }

  /**
   * Check and throw if rate limit exceeded
   */
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

  /**
   * Get or create request record
   */
  private getOrCreateRecord(key: string): RequestRecord {
    let record = this.requests.get(key);

    if (!record) {
      record = {
        timestamps: [],
        windowStart: Date.now(),
      };
      this.requests.set(key, record);
    }

    return record;
  }

  /**
   * Generate key for connector
   */
  private static getKey(connectorId: string): string {
    return `connector:${connectorId}`;
  }

  /**
   * Start periodic cleanup of old records
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL);

    // Prevent the timer from keeping the process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Remove old records that are no longer needed
   */
  private cleanup(): void {
    const now = Date.now();
    const maxWindow = 3600000; // 1 hour
    let removed = 0;

    const requestEntries = Array.from(this.requests.entries());
    for (let i = 0; i < requestEntries.length; i += 1) {
      const [key, record] = requestEntries[i];
      // Remove records with no recent timestamps
      const recentTimestamps = record.timestamps.filter((ts) => ts > now - maxWindow);

      if (recentTimestamps.length === 0) {
        this.requests.delete(key);
        removed += 1;
      } else if (recentTimestamps.length < record.timestamps.length) {
        record.timestamps = recentTimestamps;
      }
    }

    if (removed > 0) {
      logger.debug('Rate limiter cleanup completed', {
        removed,
        remaining: this.requests.size,
      });
    }
  }

  /**
   * Clear all rate limit data
   */
  clear(): void {
    const { size } = this.requests;
    this.requests.clear();
    logger.info('Rate limiter cleared', { recordsRemoved: size });
  }

  /**
   * Get all rate limit statistics
   */
  getAllStats(): Map<string, { current: number; windowStart: Date }> {
    const stats = new Map<string, { current: number; windowStart: Date }>();

    const requestEntries = Array.from(this.requests.entries());
    for (let i = 0; i < requestEntries.length; i += 1) {
      const [key, record] = requestEntries[i];
      stats.set(key, {
        current: record.timestamps.length,
        windowStart: new Date(record.windowStart),
      });
    }

    return stats;
  }

  /**
   * Shutdown cleanup
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.clear();
  }
}
