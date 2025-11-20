/**
 * Engine gRPC Client Types
 * Type definitions for the new gRPC engine using pre-compiled protobuf
 */

import * as grpc from '@grpc/grpc-js';

/**
 * Client configuration
 */
export interface EngineClientConfig {
  name: string;
  host: string;
  port: number;
  secure?: boolean;
  credentials?: CredentialsConfig;
  channelOptions?: grpc.ChannelOptions;
  retryPolicy?: RetryPolicy;
  timeout?: number;
  healthCheck?: HealthCheckConfig;
}

/**
 * Credentials configuration
 */
export interface CredentialsConfig {
  type: 'insecure' | 'ssl' | 'token' | 'api-key';
  token?: string;
  apiKey?: string;
  cert?: Buffer;
  key?: Buffer;
  ca?: Buffer;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialBackoff: number;
  maxBackoff: number;
  backoffMultiplier: number;
  retryableStatusCodes: grpc.status[];
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  serviceName?: string;
}

/**
 * Call options for individual gRPC calls
 */
export interface CallOptions {
  timeout?: number;
  deadline?: Date;
  metadata?: grpc.Metadata;
  signal?: AbortSignal;
  retry?: boolean;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  state: grpc.connectivityState;
  connected: boolean;
  lastError?: Error;
  lastConnected?: Date;
  reconnectAttempts: number;
  endpoint: string;
}

/**
 * Service health status
 */
export interface HealthStatus {
  healthy: boolean;
  lastCheck: Date;
  message?: string;
  latencyMs?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<EngineClientConfig> = {
  secure: false,
  timeout: 30000,
  channelOptions: {
    'grpc.keepalive_time_ms': 120000, // 2 minutes (was 30s - too aggressive)
    'grpc.keepalive_timeout_ms': 20000, // 20 seconds (was 5s)
    'grpc.keepalive_permit_without_calls': 0, // Don't send pings without active calls
    'grpc.http2.max_pings_without_data': 0, // Disable pings without data
    'grpc.http2.min_ping_interval_without_data_ms': 300000, // 5 minutes minimum
    'grpc.max_receive_message_length': 4 * 1024 * 1024, // 4MB
    'grpc.max_send_message_length': 4 * 1024 * 1024, // 4MB
    'grpc.initial_reconnect_backoff_ms': 1000,
    'grpc.max_reconnect_backoff_ms': 30000,
  },
  retryPolicy: {
    maxAttempts: 999, // Unlimited attempts for kubectl port-forward scenarios
    initialBackoff: 1000,
    maxBackoff: 30000,
    backoffMultiplier: 1.5, // Gentler backoff
    retryableStatusCodes: [
      grpc.status.UNAVAILABLE,
      grpc.status.DEADLINE_EXCEEDED,
      grpc.status.RESOURCE_EXHAUSTED,
      grpc.status.ABORTED,
    ],
  },
  healthCheck: {
    enabled: true,
    intervalMs: 120000, // 2 minutes (was 30s - reduce frequency to avoid excess pings)
    timeoutMs: 10000, // 10 seconds
  },
};

/**
 * gRPC Error with additional context
 */
export class EngineGrpcError extends Error {
  constructor(
    message: string,
    public code: grpc.status,
    public details?: string,
    public metadata?: grpc.Metadata
  ) {
    super(message);
    this.name = 'EngineGrpcError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      statusName: grpc.status[this.code],
    };
  }
}
