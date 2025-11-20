/**
 * Engine gRPC Client Base Class
 * Modern gRPC client using pre-compiled protobuf definitions
 */

import * as grpc from '@grpc/grpc-js';

import { ConnectionManager } from './connection';
import {
  CallOptions,
  HealthStatus,
  DEFAULT_CONFIG,
  EngineGrpcError,
  ConnectionStatus,
  EngineClientConfig,
} from './types';

export abstract class EngineGrpcClient {
  protected config: EngineClientConfig;

  protected channel: grpc.Channel;

  protected credentials: grpc.ChannelCredentials;

  protected connectionManager: ConnectionManager;

  protected status: ConnectionStatus;

  protected healthStatus: HealthStatus;

  protected initialized: boolean = false;

  protected client: any = null; // The actual gRPC service client

  constructor(config: EngineClientConfig) {
    this.config = EngineGrpcClient.mergeWithDefaults(config);
    this.credentials = this.createCredentials();
    this.channel = this.createChannel();
    this.status = {
      state: grpc.connectivityState.IDLE,
      connected: false,
      reconnectAttempts: 0,
      endpoint: `${config.host}:${config.port}`,
    };
    this.healthStatus = {
      healthy: false,
      lastCheck: new Date(),
    };
    this.connectionManager = this.createConnectionManager();
  }

  /**
   * Create the actual gRPC service client - must be implemented by subclasses
   */
  protected abstract createServiceClient(): Promise<any>;

  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Try to connect (but don't fail if it doesn't work immediately)
    await this.connect();

    // Create the actual gRPC service client regardless of connection state
    // This allows the service to exist and reconnect later
    this.client = await this.createServiceClient();

    this.startMonitoring();
    this.initialized = true;

    // If not connected, trigger immediate reconnection attempt
    if (!this.status.connected) {
      this.handleDisconnection();
    }
  }

  /**
   * Connect to the gRPC server
   */
  protected async connect(): Promise<void> {
    try {
      // Force connection attempt
      const currentState = this.channel.getConnectivityState(true);

      // For kubectl port-forward, we accept CONNECTING as valid
      if (
        currentState === grpc.connectivityState.READY ||
        currentState === grpc.connectivityState.CONNECTING
      ) {
        this.status.connected = true;
        this.status.lastConnected = new Date();
        this.status.reconnectAttempts = 0;
        this.status.state = currentState;
        this.healthStatus.healthy = currentState === grpc.connectivityState.READY;
        return;
      }

      // Not immediately ready, wait for it
      const ready = await this.connectionManager.waitForReady(10000);
      const newState = this.channel.getConnectivityState(false);

      if (ready || newState === grpc.connectivityState.CONNECTING) {
        this.status.connected = true;
        this.status.lastConnected = new Date();
        this.status.reconnectAttempts = 0;
        this.status.state = newState;
        this.healthStatus.healthy = newState === grpc.connectivityState.READY;
      } else {
        // Don't throw - just mark as not connected and let reconnection logic handle it
        this.status.connected = false;
        this.status.state = newState;
        this.healthStatus.healthy = false;
      }
    } catch (error) {
      this.status.connected = false;
      this.status.lastError = error as Error;
      this.healthStatus.healthy = false;
      // Don't throw - let reconnection logic handle it
    }
  }

  /**
   * Start connection monitoring and health checks
   */
  protected startMonitoring(): void {
    // Monitor connection state changes
    this.connectionManager.startStateMonitoring();

    // Start health checks if enabled
    if (this.config.healthCheck?.enabled) {
      this.connectionManager.startHealthCheck(
        () => this.performHealthCheck(),
        this.config.healthCheck.intervalMs
      );
    }
  }

  /**
   * Perform health check
   */
  protected async performHealthCheck(): Promise<boolean> {
    const startTime = Date.now();

    try {
      const isHealthy = this.connectionManager.isHealthy();
      const latency = Date.now() - startTime;

      this.healthStatus = {
        healthy: isHealthy,
        lastCheck: new Date(),
        latencyMs: latency,
      };

      return isHealthy;
    } catch (error) {
      this.healthStatus = {
        healthy: false,
        lastCheck: new Date(),
        message: (error as Error).message,
      };
      return false;
    }
  }

  /**
   * Make a unary gRPC call
   */
  protected async call<TReq, TRes>(
    method: string,
    request: TReq,
    options?: CallOptions
  ): Promise<TRes> {
    if (!this.initialized) {
      throw new Error(`Client ${this.config.name} not initialized`);
    }

    if (!this.client) {
      throw new Error(`Service client not created for ${this.config.name}`);
    }

    if (!this.status.connected) {
      throw new Error(`Client ${this.config.name} not connected`);
    }

    const metadata = this.createMetadata(options);
    const deadline = this.createDeadline(options);

    return new Promise<TRes>((resolve, reject) => {
      // Get the method from the client
      const grpcMethod = this.client[method];
      if (typeof grpcMethod !== 'function') {
        reject(
          new EngineGrpcError(`Method ${method} not found on client`, grpc.status.UNIMPLEMENTED)
        );
        return;
      }

      // Call the gRPC method
      grpcMethod.call(
        this.client,
        request,
        metadata,
        { deadline },
        (error: grpc.ServiceError | null, response: TRes) => {
          if (error) {
            reject(new EngineGrpcError(error.message, error.code, error.details, error.metadata));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Create metadata for the call
   */
  protected createMetadata(options?: CallOptions): grpc.Metadata {
    const metadata = options?.metadata || new grpc.Metadata();

    // Add authentication if configured
    if (this.config.credentials?.type === 'token' && this.config.credentials.token) {
      metadata.add('authorization', `Bearer ${this.config.credentials.token}`);
    }

    if (this.config.credentials?.type === 'api-key' && this.config.credentials.apiKey) {
      metadata.add('x-api-key', this.config.credentials.apiKey);
    }

    // Add tracing headers
    metadata.add('x-client-name', this.config.name);
    metadata.add('x-request-id', this.generateRequestId());

    return metadata;
  }

  /**
   * Create deadline for the call
   */
  protected createDeadline(options?: CallOptions): Date {
    if (options?.deadline) {
      return options.deadline;
    }

    const timeout = options?.timeout || this.config.timeout || 30000;
    const deadline = new Date();
    deadline.setMilliseconds(deadline.getMilliseconds() + timeout);
    return deadline;
  }

  /**
   * Create channel credentials
   */
  private createCredentials(): grpc.ChannelCredentials {
    const creds = this.config.credentials;

    if (!creds || creds.type === 'insecure') {
      return grpc.credentials.createInsecure();
    }

    if (creds.type === 'ssl') {
      return grpc.credentials.createSsl(creds.ca, creds.key, creds.cert);
    }

    // For token and api-key, use insecure channel (auth via metadata)
    return grpc.credentials.createInsecure();
  }

  /**
   * Create gRPC channel
   */
  private createChannel(): grpc.Channel {
    return new grpc.Channel(
      `${this.config.host}:${this.config.port}`,
      this.credentials,
      this.config.channelOptions || {}
    );
  }

  /**
   * Create connection manager
   */
  private createConnectionManager(): ConnectionManager {
    return new ConnectionManager({
      channel: this.channel,
      retryPolicy: this.config.retryPolicy!,
      onStateChange: (state) => {
        this.status.state = state;

        // For kubectl port-forward, CONNECTING is also acceptable
        const wasConnected = this.status.connected;
        this.status.connected =
          state === grpc.connectivityState.READY || state === grpc.connectivityState.CONNECTING;

        // Update health based on actual READY state
        this.healthStatus.healthy = state === grpc.connectivityState.READY;

        // Handle disconnection or failure
        if (
          state === grpc.connectivityState.TRANSIENT_FAILURE ||
          state === grpc.connectivityState.SHUTDOWN ||
          state === grpc.connectivityState.IDLE
        ) {
          this.handleDisconnection();
        }

        // If we just connected, reset retry attempts
        if (!wasConnected && this.status.connected) {
          this.status.reconnectAttempts = 0;
          this.status.lastConnected = new Date();
        }
      },
      onReconnect: async (attempt) => {
        this.status.reconnectAttempts = attempt;

        try {
          // Force the channel to try connecting
          this.channel.getConnectivityState(true);

          // Wait a bit and check if we connected
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const state = this.channel.getConnectivityState(false);
          if (
            state === grpc.connectivityState.READY ||
            state === grpc.connectivityState.CONNECTING
          ) {
            this.status.connected = true;
            this.status.lastConnected = new Date();
            this.status.reconnectAttempts = 0;
            this.healthStatus.healthy = state === grpc.connectivityState.READY;

            // Recreate the service client if needed
            if (!this.client) {
              this.client = await this.createServiceClient();
            }
          } else {
            // Still not connected, will retry via state monitoring
            this.status.lastError = new Error(
              `Reconnection attempt ${attempt} failed - state: ${state}`
            );
          }
        } catch (error) {
          this.status.lastError = error as Error;
        }
      },
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(): void {
    this.status.connected = false;
    this.healthStatus.healthy = false;

    // For kubectl port-forward, always attempt to reconnect
    // Reset attempts if it's been successful before
    if (this.status.lastConnected) {
      const timeSinceLastConnection = Date.now() - this.status.lastConnected.getTime();
      // If we were connected recently (within 5 minutes), reset retry counter
      if (timeSinceLastConnection < 300000) {
        this.status.reconnectAttempts = 0;
      }
    }

    // Schedule reconnection with unlimited attempts for kubectl scenarios
    this.connectionManager.scheduleReconnect(this.status.reconnectAttempts + 1);
  }

  /**
   * Merge config with defaults
   */
  private static mergeWithDefaults(config: EngineClientConfig): EngineClientConfig {
    return {
      ...DEFAULT_CONFIG,
      ...config,
      channelOptions: {
        ...DEFAULT_CONFIG.channelOptions,
        ...config.channelOptions,
      },
      retryPolicy: {
        ...DEFAULT_CONFIG.retryPolicy,
        ...config.retryPolicy,
      },
      healthCheck: {
        ...DEFAULT_CONFIG.healthCheck,
        ...config.healthCheck,
      },
    } as EngineClientConfig;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${this.config.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  /**
   * Get health status
   */
  getHealthStatus(): HealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Check if client is ready
   * For kubectl port-forward scenarios, CONNECTING state is also considered ready
   */
  isReady(): boolean {
    return (
      this.initialized &&
      this.status.connected &&
      (this.status.state === grpc.connectivityState.READY ||
        this.status.state === grpc.connectivityState.CONNECTING)
    );
  }

  /**
   * Shutdown the client
   */
  async shutdown(): Promise<void> {
    this.connectionManager.cleanup();
    this.channel.close();
    this.initialized = false;
    this.status.connected = false;
  }
}
