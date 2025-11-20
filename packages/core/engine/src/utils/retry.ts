/**
 * Retry Logic Utilities
 * Configurable retry mechanism for gRPC calls
 */

import * as grpc from '@grpc/grpc-js';

import { RetryPolicy } from '../grpc/types';

export interface RetryContext {
  attempt: number;
  maxAttempts: number;
  lastError?: Error;
  elapsedMs: number;
}

export type RetryCallback = (context: RetryContext) => void;

export class RetryManager {
  private policy: RetryPolicy;

  constructor(policy: RetryPolicy) {
    this.policy = policy;
  }

  /**
   * Execute function with retry logic
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    onRetry?: RetryCallback,
    onSuccess?: (result: T, context: RetryContext) => void
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempt = 1;

    while (attempt <= this.policy.maxAttempts) {
      const context: RetryContext = {
        attempt,
        maxAttempts: this.policy.maxAttempts,
        lastError,
        elapsedMs: Date.now() - startTime,
      };

      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await fn();
        onSuccess?.(result, context);
        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryable(error)) {
          throw error;
        }

        // Check if we have more attempts
        if (attempt >= this.policy.maxAttempts) {
          throw error;
        }

        // Calculate backoff delay
        const delay = this.calculateBackoff(attempt);

        // Notify retry callback
        context.lastError = lastError;
        onRetry?.(context);

        // Wait before retrying - intentional await in loop for retry logic
        // eslint-disable-next-line no-await-in-loop
        await RetryManager.sleepStatic(delay);
      }

      attempt += 1;
    }

    throw lastError || new Error('Retry failed with unknown error');
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: any): boolean {
    // Check if it's a gRPC error
    if (error && typeof error.code === 'number') {
      return this.policy.retryableStatusCodes.includes(error.code);
    }

    // Check for network errors
    if (error instanceof Error) {
      const networkErrors = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];
      return networkErrors.some((code) => error.message.includes(code));
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const delay = this.policy.initialBackoff * this.policy.backoffMultiplier ** (attempt - 1);

    // Add jitter (±25% random variation)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    const delayWithJitter = delay + jitter;

    return Math.min(delayWithJitter, this.policy.maxBackoff);
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleepStatic(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get retry policy
   */
  getPolicy(): RetryPolicy {
    return { ...this.policy };
  }

  /**
   * Update retry policy
   */
  updatePolicy(policy: Partial<RetryPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }
}

/**
 * Create a default retry manager
 */
export function createDefaultRetryManager(): RetryManager {
  return new RetryManager({
    maxAttempts: 3,
    initialBackoff: 1000,
    maxBackoff: 30000,
    backoffMultiplier: 2,
    retryableStatusCodes: [
      grpc.status.UNAVAILABLE,
      grpc.status.DEADLINE_EXCEEDED,
      grpc.status.RESOURCE_EXHAUSTED,
      grpc.status.ABORTED,
      grpc.status.INTERNAL,
    ],
  });
}

/**
 * Retry with exponential backoff (utility function)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    multiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    multiplier = 2,
    onRetry,
  } = options;

  let lastError: Error;
  let attempt = 1;

  while (attempt <= maxAttempts) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt >= maxAttempts) {
        throw error;
      }

      const delay = Math.min(initialDelay * multiplier ** (attempt - 1), maxDelay);

      onRetry?.(attempt, lastError);

      // Wait before retry - intentional await in loop for retry logic
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }

  throw lastError!;
}

/**
 * Check if gRPC status code is retryable
 */
export function isRetryableStatus(code: grpc.status): boolean {
  const retryableCodes = [
    grpc.status.UNAVAILABLE,
    grpc.status.DEADLINE_EXCEEDED,
    grpc.status.RESOURCE_EXHAUSTED,
    grpc.status.ABORTED,
  ];

  return retryableCodes.includes(code);
}

/**
 * Get human-readable status name
 */
export function getStatusName(code: grpc.status): string {
  return grpc.status[code] || 'UNKNOWN';
}
