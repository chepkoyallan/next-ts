/**
 * Distributed Lock Service
 * Prevents concurrent execution of critical operations using Redis
 */

import { randomBytes } from 'crypto';

import { redisClient, connectRedis } from '@app/cache/client';

import { logger } from '../utils/logger';

export interface LockOptions {
  ttl?: number; // Lock expiry in seconds (default 30)
  retryDelay?: number; // Delay between retry attempts in ms (default 100)
  retryCount?: number; // Number of retry attempts (default 10)
}

export class DistributedLockService {
  private isConnected = false;

  private readonly DEFAULT_TTL = 30; // 30 seconds

  private readonly DEFAULT_RETRY_DELAY = 100; // 100ms

  private readonly DEFAULT_RETRY_COUNT = 10;

  constructor() {
    this.ensureConnection();
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await connectRedis();
        this.isConnected = true;
        logger.info('Distributed Lock Service initialized');
      } catch (error) {
        logger.error('Failed to connect Redis for distributed locks', error as Error);
      }
    }
  }

  /**
   * Acquire a distributed lock
   * Returns lock token if successful, null if lock already held
   */
  async acquire(resource: string, options: LockOptions = {}): Promise<string | null> {
    await this.ensureConnection();

    const {
      ttl = this.DEFAULT_TTL,
      retryDelay = this.DEFAULT_RETRY_DELAY,
      retryCount = this.DEFAULT_RETRY_COUNT,
    } = options;

    const lockKey = `lock:${resource}`;
    const lockToken = randomBytes(16).toString('hex');

    async function tryAcquire(attempt: number): Promise<string | null> {
      try {
        // Try to set lock with NX (only if not exists) and EX (expiry)
        const result = await redisClient.set(lockKey, lockToken, {
          NX: true,
          EX: ttl,
        });

        if (result === 'OK') {
          logger.info('Lock acquired', {
            resource,
            lockToken,
            ttl,
            attempt: attempt + 1,
          });

          return lockToken;
        }

        // Lock already held, check if we should retry
        if (attempt >= retryCount - 1) {
          logger.warn('Failed to acquire lock after retries', {
            resource,
            retryCount,
          });
          return null;
        }

        // Wait before retry
        await new Promise((resolve) => {
          setTimeout(resolve, retryDelay);
        });
        return await tryAcquire(attempt + 1);
      } catch (error) {
        logger.error('Lock acquire error', error, { resource });
        return null;
      }
    }

    return tryAcquire(0);
  }

  /**
   * Release a distributed lock
   * Only releases if lock token matches (ensures we don't release someone else's lock)
   */
  async release(resource: string, lockToken: string): Promise<boolean> {
    await this.ensureConnection();

    const lockKey = `lock:${resource}`;

    try {
      // Lua script for atomic check-and-delete
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await redisClient.eval(script, {
        keys: [lockKey],
        arguments: [lockToken],
      });

      const released = result === 1;

      if (released) {
        logger.info('Lock released', { resource, lockToken });
      } else {
        logger.warn('Lock release failed - token mismatch or expired', {
          resource,
          lockToken,
        });
      }

      return released;
    } catch (error) {
      logger.error('Lock release error', error, { resource, lockToken });
      return false;
    }
  }

  /**
   * Extend lock expiry (if still held)
   */
  async extend(resource: string, lockToken: string, additionalTtl: number): Promise<boolean> {
    await this.ensureConnection();

    const lockKey = `lock:${resource}`;

    try {
      // Lua script for atomic check-and-extend
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await redisClient.eval(script, {
        keys: [lockKey],
        arguments: [lockToken, additionalTtl.toString()],
      });

      const extended = result === 1;

      if (extended) {
        logger.info('Lock extended', { resource, lockToken, additionalTtl });
      }

      return extended;
    } catch (error) {
      logger.error('Lock extend error', error, { resource, lockToken });
      return false;
    }
  }

  /**
   * Check if resource is locked
   */
  async isLocked(resource: string): Promise<boolean> {
    await this.ensureConnection();

    const lockKey = `lock:${resource}`;

    try {
      const exists = await redisClient.exists(lockKey);
      return exists === 1;
    } catch (error) {
      logger.error('Lock check error', error, { resource });
      return false;
    }
  }

  /**
   * Execute function with automatic lock acquisition and release
   */
  async withLock<T>(resource: string, fn: () => Promise<T>, options: LockOptions = {}): Promise<T> {
    const lockToken = await this.acquire(resource, options);

    if (!lockToken) {
      throw new Error(`Failed to acquire lock for resource: ${resource}`);
    }

    try {
      const result = await fn();

      return result;
    } finally {
      await this.release(resource, lockToken);
    }
  }
}

// Export singleton
export const distributedLock = new DistributedLockService();

/**
 * Convenience functions for common lock patterns
 */
export const WorkflowLock = {
  /**
   * Prevent concurrent workflow executions
   */
  async execute<T>(workflowId: string, executeFn: () => Promise<T>): Promise<T> {
    return distributedLock.withLock(
      `workflow:${workflowId}`,
      executeFn,
      { ttl: 300, retryCount: 3 } // 5 minutes, 3 retries
    );
  },
};

export const BillingLock = {
  /**
   * Prevent concurrent billing operations
   */
  async process<T>(organizationId: string, processFn: () => Promise<T>): Promise<T> {
    return distributedLock.withLock(
      `billing:${organizationId}`,
      processFn,
      { ttl: 60, retryCount: 5 } // 1 minute, 5 retries
    );
  },
};

export const ReportLock = {
  /**
   * Prevent concurrent report generation
   */
  async generate<T>(
    reportType: string,
    organizationId: string,
    generateFn: () => Promise<T>
  ): Promise<T> {
    return distributedLock.withLock(
      `report:${reportType}:${organizationId}`,
      generateFn,
      { ttl: 600, retryCount: 1 } // 10 minutes, no retries (reports are slow)
    );
  },
};

export const DataMigrationLock = {
  /**
   * Prevent concurrent data migrations
   */
  async run<T>(migrationId: string, migrateFn: () => Promise<T>): Promise<T> {
    return distributedLock.withLock(
      `migration:${migrationId}`,
      migrateFn,
      { ttl: 1800, retryCount: 0 } // 30 minutes, no retries
    );
  },
};
