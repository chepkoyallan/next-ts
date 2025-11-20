/**
 * Redis Client Configuration
 * Used for token blacklist, session management, and rate limiting
 */

import { createClient } from 'redis';

import { logger } from '@app/utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis reconnection failed after 10 attempts');
        return new Error('Redis reconnection failed');
      }
      // Exponential backoff: 50ms, 100ms, 200ms, etc.
      return Math.min(retries * 50, 3000);
    },
  },
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
  logger.info('Redis connected successfully');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis reconnecting...');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

// Connect on module load
let isConnecting = false;
let isConnected = false;

export async function connectRedis() {
  if (isConnected || isConnecting) return;

  isConnecting = true;
  try {
    await redisClient.connect();
    isConnected = true;
    logger.info('Redis connection established');
  } catch (error) {
    logger.error('Failed to connect to Redis', error as Error);
    isConnecting = false;
    throw error;
  }
  isConnecting = false;
}

export async function disconnectRedis() {
  if (!isConnected) return;

  try {
    await redisClient.quit();
    isConnected = false;
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Failed to disconnect Redis', error as Error);
  }
}

// Auto-connect (but don't block module load)
if (typeof window === 'undefined') {
  // Server-side only
  connectRedis().catch((err) => {
    logger.error('Auto-connect to Redis failed', err);
  });
}

export default redisClient;
