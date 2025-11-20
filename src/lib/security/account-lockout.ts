/**
 * Account Lockout Management
 * Prevents brute force attacks by locking accounts after failed login attempts
 */

import { logger } from 'src/utils/logger';

import { redisClient } from '@app/cache/client';

const LOCKOUT_CONFIG = {
  // Number of failed attempts before lockout
  maxAttempts: 5,
  // Lockout duration in seconds
  lockoutDuration: 15 * 60, // 15 minutes
  // Time window for counting attempts (in seconds)
  attemptWindow: 15 * 60, // 15 minutes
  // Increment lockout duration on repeated lockouts
  incrementalLockout: true,
};

export const AccountLockout = {
  /**
   * Record a failed login attempt
   * @param identifier - Email or user ID
   * @returns Whether account is now locked
   */
  recordFailedAttempt: async (identifier: string): Promise<boolean> => {
    try {
      const key = `lockout:attempts:${identifier}`;
      const lockKey = `lockout:locked:${identifier}`;

      // Check if already locked
      const isLocked = await redisClient.exists(lockKey);
      if (isLocked) {
        logger.warn('Login attempt on locked account', { identifier });
        return true;
      }

      // Increment attempt counter
      const attempts = await redisClient.incr(key);

      // Set expiry on first attempt
      if (attempts === 1) {
        await redisClient.expire(key, LOCKOUT_CONFIG.attemptWindow);
      }

      logger.info('Failed login attempt recorded', { identifier, attempts });

      // Check if threshold reached
      if (attempts >= LOCKOUT_CONFIG.maxAttempts) {
        // Get number of previous lockouts for incremental duration
        const lockCountKey = `lockout:count:${identifier}`;
        let lockCount = parseInt((await redisClient.get(lockCountKey)) || '0', 10);
        lockCount += 1;

        // Store lockout count
        await redisClient.setEx(lockCountKey, 30 * 24 * 60 * 60, lockCount.toString()); // 30 days

        // Calculate lockout duration
        let { lockoutDuration } = LOCKOUT_CONFIG;
        if (LOCKOUT_CONFIG.incrementalLockout) {
          // Exponential backoff: 15m, 30m, 1h, 2h, 4h
          lockoutDuration *= 2 ** (lockCount - 1);
          // Cap at 24 hours
          lockoutDuration = Math.min(lockoutDuration, 24 * 60 * 60);
        }

        // Lock the account
        await redisClient.setEx(lockKey, lockoutDuration, new Date().toISOString());

        // Clear attempts counter
        await redisClient.del(key);

        logger.warn('Account locked due to failed attempts', {
          identifier,
          attempts,
          lockoutDuration,
          lockCount,
        });

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to record login attempt', error as Error, { identifier });
      // Fail open (don't block on Redis errors)
      return false;
    }
  },

  /**
   * Check if account is locked
   * @param identifier - Email or user ID
   * @returns Lockout info or null if not locked
   */
  isLocked: async (
    identifier: string
  ): Promise<{ locked: boolean; lockedUntil?: Date; remainingTime?: number } | null> => {
    try {
      const lockKey = `lockout:locked:${identifier}`;

      const lockedAt = await redisClient.get(lockKey);
      if (!lockedAt) {
        return { locked: false };
      }

      // Get remaining TTL
      const ttl = await redisClient.ttl(lockKey);

      if (ttl <= 0) {
        // Lock expired but not yet cleaned up
        await redisClient.del(lockKey);
        return { locked: false };
      }

      const lockedUntil = new Date(Date.now() + ttl * 1000);

      return {
        locked: true,
        lockedUntil,
        remainingTime: ttl,
      };
    } catch (error) {
      logger.error('Failed to check account lockout', error as Error, { identifier });
      // Fail open
      return { locked: false };
    }
  },

  /**
   * Clear failed attempts (on successful login)
   * @param identifier - Email or user ID
   */
  clearAttempts: async (identifier: string): Promise<void> => {
    try {
      const key = `lockout:attempts:${identifier}`;
      await redisClient.del(key);

      logger.info('Failed attempts cleared', { identifier });
    } catch (error) {
      logger.error('Failed to clear login attempts', error as Error, { identifier });
    }
  },

  /**
   * Get number of failed attempts
   * @param identifier - Email or user ID
   * @returns Number of attempts
   */
  getAttemptCount: async (identifier: string): Promise<number> => {
    try {
      const key = `lockout:attempts:${identifier}`;
      const attempts = await redisClient.get(key);
      return parseInt(attempts || '0', 10);
    } catch (error) {
      logger.error('Failed to get attempt count', error as Error, { identifier });
      return 0;
    }
  },

  /**
   * Unlock account (admin override)
   * @param identifier - Email or user ID
   */
  unlock: async (identifier: string): Promise<void> => {
    try {
      const lockKey = `lockout:locked:${identifier}`;
      const attemptKey = `lockout:attempts:${identifier}`;

      await redisClient.del(lockKey);
      await redisClient.del(attemptKey);

      logger.info('Account unlocked (admin override)', { identifier });
    } catch (error) {
      logger.error('Failed to unlock account', error as Error, { identifier });
      throw error;
    }
  },

  /**
   * Get remaining attempts before lockout
   * @param identifier - Email or user ID
   * @returns Number of remaining attempts
   */
  getRemainingAttempts: async (identifier: string): Promise<number> => {
    try {
      const attempts = await AccountLockout.getAttemptCount(identifier);
      return Math.max(0, LOCKOUT_CONFIG.maxAttempts - attempts);
    } catch (error) {
      logger.error('Failed to get remaining attempts', error as Error, { identifier });
      return LOCKOUT_CONFIG.maxAttempts;
    }
  },
};
