/**
 * OAuth State Manager
 * Manages OAuth state parameters for CSRF protection
 */

import { createHash, randomBytes } from 'crypto';

import { logger } from 'src/utils/logger';

import { redisClient } from '@app/cache/client';

interface OAuthState {
  state: string;
  createdAt: number;
  returnTo?: string;
  codeChallenge?: string;
}

// Fallback in-memory store if Redis is unavailable
const memoryStore = new Map<string, OAuthState>();

// Clean up old states every minute
if (typeof window === 'undefined') {
  setInterval(() => {
    const now = Date.now();
    Array.from(memoryStore.entries()).forEach(([key, value]) => {
      if (now - value.createdAt > 10 * 60 * 1000) {
        // 10 minutes
        memoryStore.delete(key);
      }
    });
  }, 60 * 1000);
}

export const StateManager = {
  /**
   * Generate and store a new OAuth state
   * @param userId - Optional user ID
   * @param returnTo - Optional return URL
   * @param codeChallenge - Optional PKCE code challenge
   * @returns State string
   */
  create: async (userId?: string, returnTo?: string, codeChallenge?: string): Promise<string> => {
    try {
      // Generate cryptographically secure state
      const stateData = `${Date.now()}-${randomBytes(32).toString('hex')}-${userId || 'anon'}`;
      const state = createHash('sha256').update(stateData).digest('base64url');

      const stateObj: OAuthState = {
        state,
        createdAt: Date.now(),
        returnTo,
        codeChallenge,
      };

      const key = `oauth:state:${state}`;

      try {
        // Try Redis first
        await redisClient.setEx(key, 600, JSON.stringify(stateObj)); // 10 minutes TTL
        logger.info('OAuth state created in Redis', { state: state.substring(0, 10) });
      } catch {
        // Fallback to memory
        logger.warn('Redis unavailable, using memory store for OAuth state');
        memoryStore.set(state, stateObj);
      }

      return state;
    } catch (error) {
      logger.error('Failed to create OAuth state', error as Error);
      throw new Error('Failed to generate OAuth state');
    }
  },

  /**
   * Validate OAuth state
   * @param state - State string to validate
   * @returns true if valid, false otherwise
   */
  validate: async (state: string): Promise<boolean> => {
    try {
      const key = `oauth:state:${state}`;

      try {
        // Try Redis first
        const data = await redisClient.get(key);

        if (!data) {
          // Not in Redis, check memory store
          const memoryData = memoryStore.get(state);

          if (!memoryData) {
            logger.warn('OAuth state not found', { state: state.substring(0, 10) });
            return false;
          }

          // Check expiry (10 minutes)
          if (Date.now() - memoryData.createdAt > 10 * 60 * 1000) {
            memoryStore.delete(state);
            logger.warn('OAuth state expired (memory)', { state: state.substring(0, 10) });
            return false;
          }

          // Valid - delete for one-time use
          memoryStore.delete(state);
          logger.info('OAuth state validated (memory)', { state: state.substring(0, 10) });
          return true;
        }

        // Valid in Redis - delete for one-time use
        await redisClient.del(key);
        logger.info('OAuth state validated (Redis)', { state: state.substring(0, 10) });
        return true;
      } catch {
        // Redis error, check memory store
        const memoryData = memoryStore.get(state);

        if (!memoryData) {
          return false;
        }

        if (Date.now() - memoryData.createdAt > 10 * 60 * 1000) {
          memoryStore.delete(state);
          return false;
        }

        memoryStore.delete(state);
        return true;
      }
    } catch (error) {
      logger.error('Failed to validate OAuth state', error as Error);
      // Fail secure
      return false;
    }
  },

  /**
   * Get state data (without consuming it)
   * @param state - State string
   * @returns State data or null
   */
  get: async (state: string): Promise<OAuthState | null> => {
    try {
      const key = `oauth:state:${state}`;

      try {
        const data = await redisClient.get(key);
        if (data) {
          return JSON.parse(data);
        }
      } catch {
        // Fallback to memory
        const memoryData = memoryStore.get(state);
        if (memoryData) {
          return memoryData;
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to get OAuth state', error as Error);
      return null;
    }
  },

  /**
   * Delete state (for cleanup)
   * @param state - State string to delete
   */
  delete: async (state: string): Promise<void> => {
    try {
      const key = `oauth:state:${state}`;

      try {
        await redisClient.del(key);
      } catch {
        // Try memory store
        memoryStore.delete(state);
      }
    } catch (error) {
      logger.error('Failed to delete OAuth state', error as Error);
    }
  },
};
