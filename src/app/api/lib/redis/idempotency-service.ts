/**
 * Idempotency Service
 * Prevents duplicate form submissions and API requests using Redis
 */

import { createHash } from 'crypto';

import { redisClient, connectRedis } from '@app/cache/client';

import { logger } from '../utils/logger';

export interface IdempotencyResult<T> {
  isProcessed: boolean;
  result?: T;
  createdAt?: Date;
}

export class IdempotencyService {
  private isConnected = false;

  private readonly DEFAULT_TTL = 300; // 5 minutes

  constructor() {
    this.ensureConnection();
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await connectRedis();
        this.isConnected = true;
        logger.info('Idempotency Service initialized');
      } catch (error) {
        logger.error('Failed to connect Redis for idempotency', error as Error);
      }
    }
  }

  /**
   * Generate idempotency key from request data
   */
  private static generateKey(namespace: string, userId: string, data: Record<string, any>): string {
    // Create stable hash of data
    const dataStr = JSON.stringify(data, Object.keys(data).sort());
    const hash = createHash('sha256').update(dataStr).digest('hex').substring(0, 16);

    return `idempotency:${namespace}:${userId}:${hash}`;
  }

  /**
   * Check if request is duplicate and store result
   * Returns result if already processed, null if new request
   */
  async checkAndStore<T>(
    namespace: string,
    userId: string,
    data: Record<string, any>,
    processFn: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    await this.ensureConnection();

    const key = IdempotencyService.generateKey(namespace, userId, data);

    try {
      // Check if already processed
      const existing = await redisClient.get(key);

      if (existing) {
        const result = JSON.parse(existing);

        logger.info('Duplicate request detected', {
          namespace,
          userId,
          key,
          createdAt: result.createdAt,
        });

        return result.data as T;
      }

      // Process new request
      logger.debug('Processing new idempotent request', {
        namespace,
        userId,
        key,
      });

      const result = await processFn();

      // Store result
      const stored = {
        data: result,
        createdAt: new Date().toISOString(),
      };

      await redisClient.setEx(key, ttl, JSON.stringify(stored));

      logger.debug('Idempotent result stored', {
        namespace,
        userId,
        key,
        ttl,
      });

      return result;
    } catch (error) {
      logger.error('Idempotency check error', error, { namespace, userId, key });
      // If Redis fails, allow request through (fail open)
      return processFn();
    }
  }

  /**
   * Check if request was already processed
   */
  async check<T>(
    namespace: string,
    userId: string,
    data: Record<string, any>
  ): Promise<IdempotencyResult<T>> {
    await this.ensureConnection();

    const key = IdempotencyService.generateKey(namespace, userId, data);

    try {
      const existing = await redisClient.get(key);

      if (!existing) {
        return { isProcessed: false };
      }

      const result = JSON.parse(existing);

      return {
        isProcessed: true,
        result: result.data as T,
        createdAt: new Date(result.createdAt),
      };
    } catch (error) {
      logger.error('Idempotency check error', error, { namespace, userId, key });
      return { isProcessed: false };
    }
  }

  /**
   * Manually delete idempotency record
   */
  async delete(namespace: string, userId: string, data: Record<string, any>): Promise<void> {
    await this.ensureConnection();

    const key = IdempotencyService.generateKey(namespace, userId, data);

    try {
      await redisClient.del(key);
      logger.debug('Idempotency record deleted', { namespace, userId, key });
    } catch (error) {
      logger.error('Idempotency delete error', error, { namespace, userId, key });
    }
  }

  /**
   * Clear all idempotency records for a namespace
   */
  async clearNamespace(namespace: string): Promise<number> {
    await this.ensureConnection();

    const pattern = `idempotency:${namespace}:*`;

    const scanAndDelete = async (cursor: string, deletedCount: number): Promise<number> => {
      const result = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });

      const resultKeys = result.keys;
      let newDeletedCount = deletedCount;

      if (resultKeys.length > 0) {
        await redisClient.del(resultKeys);
        newDeletedCount += resultKeys.length;
      }

      if (result.cursor === '0') {
        return newDeletedCount;
      }

      return scanAndDelete(result.cursor, newDeletedCount);
    };

    try {
      const deletedCount = await scanAndDelete('0', 0);

      logger.info('Idempotency namespace cleared', { namespace, count: deletedCount });

      return deletedCount;
    } catch (error) {
      logger.error('Idempotency clear error', error, { namespace });
      return 0;
    }
  }
}

// Export singleton
export const idempotencyService = new IdempotencyService();

// Convenience functions for common use cases
export const FormSubmission = {
  /**
   * Handle form submission with deduplication
   */
  async submit<T>(
    formId: string,
    userId: string,
    data: Record<string, any>,
    submitFn: () => Promise<T>
  ): Promise<T> {
    return idempotencyService.checkAndStore(
      `form:${formId}`,
      userId,
      data,
      submitFn,
      300 // 5 minutes
    );
  },

  /**
   * Check if form was already submitted
   */
  async isSubmitted<T>(
    formId: string,
    userId: string,
    data: Record<string, any>
  ): Promise<IdempotencyResult<T>> {
    return idempotencyService.check(`form:${formId}`, userId, data);
  },
};

export const PaymentTransaction = {
  /**
   * Handle payment with deduplication
   */
  async process<T>(
    userId: string,
    paymentData: Record<string, any>,
    processFn: () => Promise<T>
  ): Promise<T> {
    return idempotencyService.checkAndStore(
      'payment',
      userId,
      paymentData,
      processFn,
      600 // 10 minutes for payments
    );
  },
};

export const WorkflowExecution = {
  /**
   * Prevent duplicate workflow executions
   */
  async execute<T>(
    workflowId: string,
    userId: string,
    inputs: Record<string, any>,
    executeFn: () => Promise<T>
  ): Promise<T> {
    return idempotencyService.checkAndStore(
      `workflow:${workflowId}`,
      userId,
      inputs,
      executeFn,
      60 // 1 minute - workflows should be quick to retry
    );
  },
};
