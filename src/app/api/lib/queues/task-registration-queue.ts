/**
 * Task Registration Queue
 * Manages job submission and processing for task registration to Flyte
 */

import Redis from 'ioredis';

import { logger } from '../utils/logger';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'task-registration';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

// Initialize Redis client
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: MAX_RETRIES,
      retryStrategy(times) {
        const delay = Math.min(times * RETRY_DELAY, 30000);
        logger.warn(`Redis connection attempt ${times}, retrying in ${delay}ms`);
        return delay;
      },
      reconnectOnError(err) {
        logger.error('Redis reconnection error:', err);
        return true;
      },
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    redisClient.on('close', () => {
      logger.warn('Redis client connection closed');
    });
  }

  return redisClient;
}

/**
 * Task registration job data
 */
export interface TaskRegistrationJob {
  taskDefinitionId: string;
  taskCode: string;
  projectId: string;
  domain: string;
  name: string;
  version: string;
  baseImage: string;
  extraDependencies: string[];
  organizationId: string;
  createdBy: string;
  priority?: number;
}

/**
 * Add a task registration job to the queue
 */
export async function enqueueTaskRegistration(job: TaskRegistrationJob): Promise<boolean> {
  try {
    const client = getRedisClient();

    // Serialize job data
    const jobData = JSON.stringify({
      ...job,
      enqueuedAt: new Date().toISOString(),
    });

    // Push job to queue (LPUSH for FIFO with BRPOP on worker side)
    await client.lpush(QUEUE_NAME, jobData);

    logger.info(`Task registration job enqueued`, {
      taskDefinitionId: job.taskDefinitionId,
      name: job.name,
      version: job.version,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to enqueue task registration job', error, {
      taskDefinitionId: job.taskDefinitionId,
    });
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }
}

/**
 * Get queue length (number of pending jobs)
 */
export async function getQueueLength(): Promise<number> {
  try {
    const client = getRedisClient();
    const length = await client.llen(QUEUE_NAME);
    return length;
  } catch (error: any) {
    logger.error('Failed to get queue length', error);
    return 0;
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  try {
    const client = getRedisClient();

    // Get counts from Redis (you can use sorted sets to track these)
    const pending = await client.llen(QUEUE_NAME);
    const processing = (await client.get(`${QUEUE_NAME}:processing`)) || '0';
    const completed = (await client.get(`${QUEUE_NAME}:completed`)) || '0';
    const failed = (await client.get(`${QUEUE_NAME}:failed`)) || '0';

    return {
      pending,
      processing: parseInt(processing, 10),
      completed: parseInt(completed, 10),
      failed: parseInt(failed, 10),
    };
  } catch (error: any) {
    logger.error('Failed to get queue stats', error);
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  }
}

/**
 * Increment queue counter
 */
export async function incrementQueueCounter(
  counter: 'processing' | 'completed' | 'failed'
): Promise<void> {
  try {
    const client = getRedisClient();
    await client.incr(`${QUEUE_NAME}:${counter}`);
  } catch (error: any) {
    logger.error('Failed to increment queue counter', error, { counter });
  }
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

export default {
  enqueueTaskRegistration,
  getQueueLength,
  getQueueStats,
  incrementQueueCounter,
  closeRedisConnection,
};
