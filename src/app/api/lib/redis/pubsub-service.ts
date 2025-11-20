/**
 * Redis Pub/Sub Service
 * Real-time event broadcasting for workflow execution updates
 */

import { createClient } from 'redis';

import { logger } from '../utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create separate clients for pub and sub (Redis requirement)
const publisherClient = createClient({ url: redisUrl });
const subscriberClient = createClient({ url: redisUrl });

let isConnected = false;

// Event handlers storage
const eventHandlers = new Map<string, Set<(message: any) => void>>();

/**
 * Initialize Pub/Sub clients
 */
export async function initializePubSub(): Promise<void> {
  if (isConnected) return;

  try {
    await Promise.all([publisherClient.connect(), subscriberClient.connect()]);

    isConnected = true;
    logger.info('Redis Pub/Sub initialized');
  } catch (error) {
    logger.error('Failed to initialize Redis Pub/Sub', error as Error);
    throw error;
  }
}

/**
 * Publish event to channel
 */
export async function publish<T>(channel: string, data: T): Promise<number> {
  if (!isConnected) {
    await initializePubSub();
  }

  try {
    const message = JSON.stringify(data);
    const subscriberCount = await publisherClient.publish(channel, message);

    logger.debug(`Published to ${channel}`, {
      channel,
      subscriberCount,
    });

    return subscriberCount;
  } catch (error) {
    logger.error('Failed to publish message', error, { channel });
    throw error;
  }
}

/**
 * Subscribe to channel
 */
export async function subscribe<T>(
  channel: string,
  handler: (message: T) => void | Promise<void>
): Promise<void> {
  if (!isConnected) {
    await initializePubSub();
  }

  try {
    // Store handler
    if (!eventHandlers.has(channel)) {
      eventHandlers.set(channel, new Set());

      // Subscribe to Redis channel
      await subscriberClient.subscribe(channel, async (message) => {
        try {
          const data = JSON.parse(message) as T;
          const handlers = eventHandlers.get(channel);

          if (handlers) {
            // Call all handlers for this channel
            await Promise.all(Array.from(handlers).map((h) => Promise.resolve(h(data))));
          }
        } catch (error) {
          logger.error('Error processing pub/sub message', error, { channel });
        }
      });

      logger.info(`Subscribed to channel: ${channel}`);
    }

    // Add handler to set
    eventHandlers.get(channel)!.add(handler as any);
  } catch (error) {
    logger.error('Failed to subscribe to channel', error, { channel });
    throw error;
  }
}

/**
 * Unsubscribe from channel
 */
export async function unsubscribe(
  channel: string,
  handler?: (message: any) => void
): Promise<void> {
  if (!isConnected) return;

  try {
    if (handler) {
      // Remove specific handler
      const handlers = eventHandlers.get(channel);
      if (handlers) {
        handlers.delete(handler);

        // If no more handlers, unsubscribe from Redis
        if (handlers.size === 0) {
          await subscriberClient.unsubscribe(channel);
          eventHandlers.delete(channel);
          logger.info(`Unsubscribed from channel: ${channel}`);
        }
      }
    } else {
      // Remove all handlers and unsubscribe
      await subscriberClient.unsubscribe(channel);
      eventHandlers.delete(channel);
      logger.info(`Unsubscribed from channel: ${channel}`);
    }
  } catch (error) {
    logger.error('Failed to unsubscribe from channel', error, { channel });
    throw error;
  }
}

/**
 * Pattern subscribe (e.g., "workflow:*:status")
 */
export async function psubscribe<T>(
  pattern: string,
  handler: (channel: string, message: T) => void | Promise<void>
): Promise<void> {
  if (!isConnected) {
    await initializePubSub();
  }

  try {
    await subscriberClient.pSubscribe(pattern, async (message, channel) => {
      try {
        const data = JSON.parse(message) as T;
        await Promise.resolve(handler(channel, data));
      } catch (error) {
        logger.error('Error processing pattern pub/sub message', error as Error, {
          pattern,
          channel,
        });
      }
    });

    logger.info(`Pattern subscribed: ${pattern}`);
  } catch (error) {
    logger.error('Failed to pattern subscribe', error);
    throw error;
  }
}

/**
 * Pattern unsubscribe
 */
export async function punsubscribe(pattern: string): Promise<void> {
  if (!isConnected) return;

  try {
    await subscriberClient.pUnsubscribe(pattern);
    logger.info(`Pattern unsubscribed: ${pattern}`);
  } catch (error) {
    logger.error('Failed to pattern unsubscribe', error);
    throw error;
  }
}

/**
 * Workflow Execution Events
 */
export const WorkflowEvents = {
  /**
   * Publish workflow execution started event
   */
  executionStarted: async (executionId: string, data: any) => {
    await publish(`workflow:${executionId}:status`, {
      type: 'EXECUTION_STARTED',
      executionId,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },

  /**
   * Publish workflow execution progress event
   */
  executionProgress: async (executionId: string, progress: number, data: any) => {
    await publish(`workflow:${executionId}:status`, {
      type: 'EXECUTION_PROGRESS',
      executionId,
      progress,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },

  /**
   * Publish workflow execution completed event
   */
  executionCompleted: async (executionId: string, data: any) => {
    await publish(`workflow:${executionId}:status`, {
      type: 'EXECUTION_COMPLETED',
      executionId,
      timestamp: new Date().toISOString(),
      ...data,
    });
  },

  /**
   * Publish workflow execution failed event
   */
  executionFailed: async (executionId: string, error: string) => {
    await publish(`workflow:${executionId}:status`, {
      type: 'EXECUTION_FAILED',
      executionId,
      error,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Subscribe to workflow execution updates
   */
  subscribeToExecution: async (executionId: string, handler: (event: any) => void) => {
    await subscribe(`workflow:${executionId}:status`, handler);
  },

  /**
   * Subscribe to all workflow executions for a project
   */
  subscribeToProject: async (projectId: string, handler: (event: any) => void) => {
    await psubscribe(`workflow:project:${projectId}:*`, (channel, event) => {
      handler(event);
    });
  },
};

/**
 * Cleanup on shutdown
 */
export async function shutdown(): Promise<void> {
  if (!isConnected) return;

  try {
    await Promise.all([publisherClient.quit(), subscriberClient.quit()]);

    isConnected = false;
    logger.info('Redis Pub/Sub shutdown complete');
  } catch (error) {
    logger.error('Error shutting down Pub/Sub', error as Error);
  }
}

// Auto-initialize
if (typeof window === 'undefined') {
  initializePubSub().catch((err) => {
    logger.error('Auto-initialize Pub/Sub failed', err);
  });
}

// Cleanup on exit
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
