/**
 * Token Blacklist Management
 * Used to revoke JWT tokens before their natural expiry
 */

import { redisClient } from './client';
import { logger } from '../../app/api/lib/utils/logger';

export const TokenBlacklist = {
  /**
   * Add token to blacklist
   * @param jti - JWT ID (unique identifier from token claims)
   * @param expiresIn - Time until token naturally expires (in seconds)
   */
  add: async (jti: string, expiresIn: number): Promise<void> => {
    try {
      const key = `blacklist:${jti}`;
      // Store timestamp when token was blacklisted for grace period checking
      const value = JSON.stringify({
        revokedAt: Date.now(),
        reason: 'rotated',
      });
      await redisClient.setEx(key, expiresIn, value);

      logger.info('Token added to blacklist', { jti, expiresIn });
    } catch (error) {
      logger.error('Failed to add token to blacklist', error as Error, { jti });
      throw error;
    }
  },

  /**
   * Check if token is blacklisted
   * @param jti - JWT ID to check
   * @returns true if blacklisted, false otherwise
   */
  isBlacklisted: async (jti: string): Promise<boolean> => {
    try {
      const key = `blacklist:${jti}`;
      const result = await redisClient.get(key);
      return result !== null;
    } catch (error) {
      logger.error('Failed to check token blacklist', error as Error, { jti });
      // Fail secure: if we can't check, assume it's blacklisted
      return true;
    }
  },

  /**
   * Check if token is blacklisted with grace period
   * @param jti - JWT ID to check
   * @param gracePeriodMs - Grace period in milliseconds (default 30 seconds)
   * @returns { blacklisted, withinGracePeriod, revokedAt }
   */
  isBlacklistedWithGracePeriod: async (
    jti: string,
    gracePeriodMs: number = 30000
  ): Promise<{ blacklisted: boolean; withinGracePeriod: boolean; revokedAt?: number }> => {
    try {
      const key = `blacklist:${jti}`;
      const result = await redisClient.get(key);

      if (!result) {
        return { blacklisted: false, withinGracePeriod: false };
      }

      try {
        const data = JSON.parse(result);
        const { revokedAt } = data;
        const timeSinceRevocation = Date.now() - revokedAt;
        const withinGracePeriod = timeSinceRevocation < gracePeriodMs;

        return {
          blacklisted: true,
          withinGracePeriod,
          revokedAt,
        };
      } catch {
        // Legacy format or invalid JSON - treat as blacklisted without grace period
        return { blacklisted: true, withinGracePeriod: false };
      }
    } catch (error) {
      logger.error('Failed to check token blacklist with grace period', error as Error, { jti });
      // Fail secure: if we can't check, assume it's blacklisted
      return { blacklisted: true, withinGracePeriod: false };
    }
  },

  /**
   * Remove from blacklist (mainly for testing)
   * @param jti - JWT ID to remove
   */
  remove: async (jti: string): Promise<void> => {
    try {
      const key = `blacklist:${jti}`;
      await redisClient.del(key);

      logger.info('Token removed from blacklist', { jti });
    } catch (error) {
      logger.error('Failed to remove token from blacklist', error as Error, { jti });
      throw error;
    }
  },

  /**
   * Add multiple tokens to blacklist (for bulk revocation)
   * @param tokens - Array of { jti, expiresIn } objects
   */
  addMultiple: async (tokens: Array<{ jti: string; expiresIn: number }>): Promise<void> => {
    try {
      const pipeline = redisClient.multi();
      const revokedAt = Date.now();

      tokens.forEach((token) => {
        const key = `blacklist:${token.jti}`;
        const value = JSON.stringify({
          revokedAt,
          reason: 'bulk_revocation',
        });
        pipeline.setEx(key, token.expiresIn, value);
      });

      await pipeline.exec();

      logger.info('Multiple tokens added to blacklist', { count: tokens.length });
    } catch (error) {
      logger.error('Failed to add multiple tokens to blacklist', error as Error);
      throw error;
    }
  },
};
