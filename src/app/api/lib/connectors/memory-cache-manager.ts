/**
 * In-Memory Cache Manager
 * Local memory-based caching for development and single-instance deployments
 */

import { ICacheService } from './types';
import { logger } from '../utils/logger';

/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

/**
 * In-Memory Cache Implementation
 * For production, consider Redis or Memcached
 */
export class ConnectorCacheManager implements ICacheService {
  private cache: Map<string, CacheEntry<any>>;

  private cleanupInterval: NodeJS.Timeout | null = null;

  private readonly DEFAULT_TTL = 300; // 5 minutes

  private readonly CLEANUP_INTERVAL = 60000; // 1 minute

  constructor() {
    this.cache = new Map();
    this.startCleanupTimer();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      logger.debug('Cache miss', { key });
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      logger.debug('Cache entry expired', { key });
      this.cache.delete(key);
      return null;
    }

    // Increment hit counter
    entry.hits += 1;

    logger.debug('Cache hit', { key, hits: entry.hits });
    return entry.value as T;
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      expiresAt: now + ttl * 1000,
      createdAt: now,
      hits: 0,
    };

    this.cache.set(key, entry);

    logger.debug('Cache set', {
      key,
      ttl,
      expiresAt: new Date(entry.expiresAt).toISOString(),
    });
  }

  /**
   * Delete specific key from cache
   */
  async delete(key: string): Promise<void> {
    const deleted = this.cache.delete(key);

    if (deleted) {
      logger.debug('Cache entry deleted', { key });
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   * Pattern uses wildcards: "connector:*:data"
   */
  async invalidate(pattern: string): Promise<void> {
    const regex = ConnectorCacheManager.patternToRegex(pattern);
    let count = 0;

    const keys = Array.from(this.cache.keys());
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (regex.test(key)) {
        this.cache.delete(key);
        count += 1;
      }
    }

    logger.info('Cache entries invalidated', { pattern, count });
  }

  /**
   * Check if key exists in cache (and is not expired)
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get or set pattern: fetch if not in cache
   */
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

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const { size } = this.cache;
    this.cache.clear();
    logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    totalHits: number;
    entries: Array<{ key: string; hits: number; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries: Array<{ key: string; hits: number; age: number; ttl: number }> = [];
    let totalHits = 0;

    const cacheEntries = Array.from(this.cache.entries());
    for (let i = 0; i < cacheEntries.length; i += 1) {
      const [key, entry] = cacheEntries[i];
      const age = Math.floor((now - entry.createdAt) / 1000);
      const ttl = Math.max(0, Math.floor((entry.expiresAt - now) / 1000));

      entries.push({
        key,
        hits: entry.hits,
        age,
        ttl,
      });

      totalHits += entry.hits;
    }

    return {
      size: this.cache.size,
      totalHits,
      entries: entries.sort((a, b) => b.hits - a.hits), // Sort by hits
    };
  }

  /**
   * Start periodic cleanup of expired entries
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
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    const cacheEntries = Array.from(this.cache.entries());
    for (let i = 0; i < cacheEntries.length; i += 1) {
      const [key, entry] = cacheEntries[i];
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed += 1;
      }
    }

    if (removed > 0) {
      logger.debug('Cache cleanup completed', { removed, remaining: this.cache.size });
    }
  }

  /**
   * Convert wildcard pattern to regex
   */
  private static patternToRegex(pattern: string): RegExp {
    // Escape special regex characters except *
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

    // Convert * to .*
    const regexPattern = escaped.replace(/\*/g, '.*');

    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Generate cache key for connector execution
   */
  static generateKey(connectorId: string, queryParams?: any, userId?: string): string {
    const parts = ['connector', connectorId];

    if (queryParams) {
      // Create a stable hash of query params
      const paramsStr = JSON.stringify(queryParams, Object.keys(queryParams).sort());
      parts.push(this.simpleHash(paramsStr));
    }

    if (userId) {
      parts.push('user', userId);
    }

    return parts.join(':');
  }

  /**
   * Simple hash function for cache keys
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      const char = str.charCodeAt(i);
      hash = hash * 33 - hash + char; // Replace bitwise left shift with multiplication
      hash = Math.floor(hash); // Convert to integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Shutdown cleanup
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.clear();
  }
}
