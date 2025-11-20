/**
 * Connection Manager
 * Handles connection monitoring, health checks, and reconnection logic
 */

import * as grpc from '@grpc/grpc-js';

import { RetryPolicy } from './types';

export interface ConnectionManagerConfig {
  channel: grpc.Channel;
  retryPolicy: RetryPolicy;
  healthCheckIntervalMs?: number;
  onStateChange?: (state: grpc.connectivityState) => void;
  onReconnect?: (attempt: number) => void;
}

export class ConnectionManager {
  private channel: grpc.Channel;

  private retryPolicy: RetryPolicy;

  private reconnectTimer?: NodeJS.Timeout;

  private healthCheckTimer?: NodeJS.Timeout;

  private stateWatcher?: { cancel: () => void };

  private onStateChange?: (state: grpc.connectivityState) => void;

  private onReconnect?: (attempt: number) => void;

  constructor(config: ConnectionManagerConfig) {
    this.channel = config.channel;
    this.retryPolicy = config.retryPolicy;
    this.onStateChange = config.onStateChange;
    this.onReconnect = config.onReconnect;
  }

  /**
   * Start monitoring connection state changes
   */
  startStateMonitoring(): void {
    const checkState = () => {
      const currentState = this.channel.getConnectivityState(false);
      this.onStateChange?.(currentState);

      // Watch for next state change
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);

      this.channel.watchConnectivityState(currentState, deadline, (error) => {
        if (!error) {
          // State changed, check again
          checkState();
        } else {
          // Timeout or error, retry
          setTimeout(() => checkState(), 1000);
        }
      });
    };

    checkState();
  }

  /**
   * Stop monitoring connection state
   */
  stopStateMonitoring(): void {
    this.stateWatcher?.cancel();
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect(attempt: number): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    // Cap the backoff for kubectl port-forward scenarios - max 30 seconds
    const delay = Math.min(this.calculateBackoff(attempt), 30000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.onReconnect?.(attempt);
    }, delay);
  }

  /**
   * Cancel scheduled reconnection
   */
  cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthCheck(healthCheckFn: () => Promise<boolean>, intervalMs: number): void {
    if (this.healthCheckTimer) {
      return; // Already running
    }

    const runHealthCheck = async () => {
      try {
        await healthCheckFn();
      } catch {
        // Health check failed, will be handled by callback
      }
    };

    // Run immediately
    runHealthCheck();

    // Schedule periodic checks
    this.healthCheckTimer = setInterval(() => {
      runHealthCheck();
    }, intervalMs);
  }

  /**
   * Stop health checks
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const delay =
      this.retryPolicy.initialBackoff * this.retryPolicy.backoffMultiplier ** (attempt - 1);

    return Math.min(delay, this.retryPolicy.maxBackoff);
  }

  /**
   * Check if current connection state is healthy
   */
  isHealthy(): boolean {
    // Try to connect if idle (for kubectl port-forward scenarios)
    const state = this.channel.getConnectivityState(true);

    // Accept both READY and CONNECTING as healthy for kubectl port-forward
    return state === grpc.connectivityState.READY || state === grpc.connectivityState.CONNECTING;
  }

  /**
   * Wait for channel to be ready
   */
  async waitForReady(timeoutMs: number = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      const deadline = new Date();
      deadline.setMilliseconds(deadline.getMilliseconds() + timeoutMs);

      const currentState = this.channel.getConnectivityState(true); // Try to connect

      if (currentState === grpc.connectivityState.READY) {
        resolve(true);
        return;
      }

      this.channel.watchConnectivityState(currentState, deadline, (error) => {
        if (error) {
          resolve(false);
        } else {
          const newState = this.channel.getConnectivityState(false);
          resolve(newState === grpc.connectivityState.READY);
        }
      });
    });
  }

  /**
   * Cleanup all timers and watchers
   */
  cleanup(): void {
    this.cancelReconnect();
    this.stopHealthCheck();
    this.stopStateMonitoring();
  }
}
