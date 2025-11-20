// Production-ready generic gRPC client
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

import { logger } from '../utils/logger';
import { ServiceProvider } from '../services/service-interfaces';

/**
 * gRPC client configuration
 */
export interface GrpcClientConfig {
  name: string;
  host: string;
  port: number;
  protoPath: string;
  includeDirs?: string[];
  packageName: string;
  serviceName: string;
  secure?: boolean;
  credentials?: GrpcCredentials;
  options?: GrpcChannelOptions;
  retryConfig?: GrpcRetryConfig;
  healthCheck?: GrpcHealthCheckConfig;
}

/**
 * gRPC credentials configuration
 */
export interface GrpcCredentials {
  type: 'insecure' | 'ssl' | 'jwt' | 'oauth2' | 'api-key';
  token?: string;
  apiKey?: string;
  cert?: string;
  key?: string;
  ca?: string;
  serverName?: string;
}

/**
 * gRPC channel options
 */
export interface GrpcChannelOptions {
  'grpc.keepalive_time_ms'?: number;
  'grpc.keepalive_timeout_ms'?: number;
  'grpc.keepalive_permit_without_calls'?: boolean;
  'grpc.http2.max_pings_without_data'?: number;
  'grpc.http2.min_time_between_pings_ms'?: number;
  'grpc.http2.min_ping_interval_without_data_ms'?: number;
  'grpc.max_receive_message_length'?: number;
  'grpc.max_send_message_length'?: number;
  'grpc.initial_reconnect_backoff_ms'?: number;
  'grpc.max_reconnect_backoff_ms'?: number;
  'grpc.enable_channelz'?: boolean;
}

/**
 * gRPC retry configuration
 */
export interface GrpcRetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: grpc.status[];
  timeout?: number;
}

/**
 * gRPC health check configuration
 */
export interface GrpcHealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  serviceName?: string;
}

/**
 * gRPC connection status
 */
export interface GrpcConnectionStatus {
  connected: boolean;
  connecting: boolean;
  lastConnected?: Date;
  lastError?: string;
  retryCount: number;
  endpoint: string;
  channelState: grpc.connectivityState;
}

/**
 * gRPC call options
 */
export interface GrpcCallOptions {
  timeout?: number;
  deadline?: Date;
  metadata?: grpc.Metadata;
  retry?: boolean;
}

/**
 * Production-ready generic gRPC client
 */
export class GrpcClient implements ServiceProvider {
  public readonly name: string;

  private config: GrpcClientConfig;

  private client: any = null;

  private packageDefinition: protoLoader.PackageDefinition | null = null;

  private protoDescriptor: grpc.GrpcObject | null = null;

  private channel: grpc.Channel | null = null;

  private connectionStatus: GrpcConnectionStatus;

  private reconnectTimer: NodeJS.Timeout | null = null;

  private healthCheckTimer: NodeJS.Timeout | null = null;

  private initialized = false;

  constructor(config: GrpcClientConfig) {
    this.name = config.name;
    this.config = {
      ...config,
      secure: config.secure ?? true,
      options: {
        'grpc.keepalive_time_ms': 30000,
        'grpc.keepalive_timeout_ms': 5000,
        'grpc.keepalive_permit_without_calls': true,
        'grpc.max_receive_message_length': 4 * 1024 * 1024, // 4MB
        'grpc.max_send_message_length': 4 * 1024 * 1024, // 4MB
        'grpc.initial_reconnect_backoff_ms': 1000,
        'grpc.max_reconnect_backoff_ms': 30000,
        'grpc.enable_channelz': true,
        ...config.options,
      },
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableStatusCodes: [
          grpc.status.UNAVAILABLE,
          grpc.status.DEADLINE_EXCEEDED,
          grpc.status.RESOURCE_EXHAUSTED,
        ],
        timeout: 30000,
        ...config.retryConfig,
      },
      healthCheck: {
        enabled: true,
        intervalMs: 30000,
        timeoutMs: 5000,
        ...config.healthCheck,
      },
    };

    this.connectionStatus = {
      connected: false,
      connecting: false,
      retryCount: 0,
      endpoint: `${config.host}:${config.port}`,
      channelState: grpc.connectivityState.IDLE,
    };
  }

  /**
   * Initialize the gRPC client
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing gRPC client', {
        name: this.name,
        endpoint: this.connectionStatus.endpoint,
      });

      // Load proto file
      await this.loadProtoFile();

      // Create client
      await this.createClient();

      // Connect
      await this.connect();

      this.initialized = true;
      logger.info('gRPC client initialized successfully', { name: this.name });
    } catch (error) {
      logger.error('Failed to initialize gRPC client', error as Error, { name: this.name });
      throw error;
    }
  }

  /**
   * Connect to gRPC server
   */
  async connect(): Promise<void> {
    if (this.connectionStatus.connecting) {
      logger.warn('Connection already in progress', { name: this.name });
      return;
    }

    this.connectionStatus.connecting = true;

    try {
      logger.info('Connecting to gRPC server', {
        name: this.name,
        endpoint: this.connectionStatus.endpoint,
      });

      // Test connection with a simple call or health check
      await this.testConnection();

      this.connectionStatus.connected = true;
      this.connectionStatus.connecting = false;
      this.connectionStatus.lastConnected = new Date();
      this.connectionStatus.retryCount = 0;
      this.connectionStatus.lastError = undefined;

      logger.info('Successfully connected to gRPC server', {
        name: this.name,
        endpoint: this.connectionStatus.endpoint,
      });

      // Start health check if enabled
      if (this.config.healthCheck?.enabled) {
        this.startHealthCheck();
      }

      // Monitor channel state
      this.monitorChannelState();
    } catch (error) {
      this.connectionStatus.connected = false;
      this.connectionStatus.connecting = false;
      this.connectionStatus.lastError = (error as Error).message;

      logger.error('Failed to connect to gRPC server', error as Error, {
        name: this.name,
        endpoint: this.connectionStatus.endpoint,
        retryCount: this.connectionStatus.retryCount,
      });

      // Schedule retry
      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Disconnect from gRPC server
   */
  async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting gRPC client', { name: this.name });

      // Stop timers
      this.stopTimers();

      // Close channel
      if (this.channel) {
        this.channel.close();
        this.channel = null;
      }

      this.client = null;
      this.connectionStatus.connected = false;
      this.connectionStatus.connecting = false;

      logger.info('gRPC client disconnected', { name: this.name });
    } catch (error) {
      logger.error('Error during gRPC disconnect', error as Error, { name: this.name });
      throw error;
    }
  }

  /**
   * Shutdown the client
   */
  async shutdown(): Promise<void> {
    await this.disconnect();
    this.initialized = false;
    logger.info('gRPC client shutdown complete', { name: this.name });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        return false;
      }

      // Test with a simple call or use gRPC health checking protocol
      await this.testConnection();
      return true;
    } catch (error) {
      logger.warn('gRPC health check failed', {
        name: this.name,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connectionStatus.connected && this.client !== null;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): GrpcConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Make a unary gRPC call
   */
  async call<TRequest, TResponse>(
    methodName: string,
    request: TRequest,
    options?: GrpcCallOptions
  ): Promise<TResponse> {
    if (!this.isConnected()) {
      throw new Error(`gRPC client ${this.name} is not connected`);
    }

    const callOptions = this.createCallOptions(options);
    const method = this.client[methodName];

    if (!method) {
      throw new Error(`Method ${methodName} not found in gRPC service`);
    }

    return new Promise<TResponse>((resolve, reject) => {
      const call = method.call(
        this.client,
        request,
        callOptions.metadata,
        callOptions,
        (error: any, response: TResponse) => {
          if (error) {
            logger.error('gRPC call failed', error, {
              name: this.name,
              method: methodName,
              status: error.code,
            });

            // Check if we should retry
            if (this.shouldRetry(error, options?.retry)) {
              this.retryCall<TRequest, TResponse>(methodName, request, options)
                .then((result: TResponse) => resolve(result))
                .catch((retryError: Error) => reject(retryError));
              return;
            }

            reject(this.createGrpcError(error));
          } else {
            logger.debug('gRPC call successful', {
              name: this.name,
              method: methodName,
            });
            resolve(response);
          }
        }
      );

      // Handle call events
      call.on('status', (status: grpc.StatusObject) => {
        logger.debug('gRPC call status', {
          name: this.name,
          method: methodName,
          code: status.code,
          details: status.details,
        });
      });

      call.on('metadata', (metadata: grpc.Metadata) => {
        logger.debug('gRPC call metadata received', {
          name: this.name,
          method: methodName,
        });
      });
    });
  }

  /**
   * Make a streaming gRPC call
   */
  createStream<TRequest, TResponse>(
    methodName: string,
    request?: TRequest,
    options?: GrpcCallOptions
  ):
    | grpc.ClientReadableStream<TResponse>
    | grpc.ClientWritableStream<TRequest>
    | grpc.ClientDuplexStream<TRequest, TResponse> {
    if (!this.isConnected()) {
      throw new Error(`gRPC client ${this.name} is not connected`);
    }

    const callOptions = this.createCallOptions(options);
    const method = this.client[methodName];

    if (!method) {
      throw new Error(`Method ${methodName} not found in gRPC service`);
    }

    const stream = request
      ? method.call(this.client, request, callOptions.metadata, callOptions)
      : method.call(this.client, callOptions.metadata, callOptions);

    // Add error handling
    stream.on('error', (error: any) => {
      logger.error('gRPC stream error', error, {
        name: this.name,
        method: methodName,
        status: error.code,
      });
    });

    stream.on('status', (status: grpc.StatusObject) => {
      logger.debug('gRPC stream status', {
        name: this.name,
        method: methodName,
        code: status.code,
        details: status.details,
      });
    });

    return stream;
  }

  /**
   * Load proto file
   */
  private async loadProtoFile(): Promise<void> {
    try {
      logger.info('Loading proto file', {
        name: this.name,
        protoPath: this.config.protoPath,
      });

      const packageDefinition = await protoLoader.load(this.config.protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [
          ...(this.config.includeDirs || []),
          './src/protos',
          './node_modules/google-proto-files',
          './node_modules/@grpc/grpc-js/src/generated',
          './node_modules/protobufjs',
          './node_modules/ts-proto/build/protos',
        ],
      });

      this.packageDefinition = packageDefinition;
      this.protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

      logger.info('Proto file loaded successfully', {
        name: this.name,
        protoPath: this.config.protoPath,
        packages: Object.keys(this.protoDescriptor),
      });
    } catch (error) {
      logger.error('Failed to load proto file', error as Error, {
        name: this.name,
        protoPath: this.config.protoPath,
      });
      throw error;
    }
  }

  /**
   * Create gRPC client
   */
  private async createClient(): Promise<void> {
    if (!this.protoDescriptor) {
      throw new Error('Proto descriptor not loaded');
    }

    try {
      logger.info('Creating gRPC client', {
        name: this.name,
        packageName: this.config.packageName,
        serviceName: this.config.serviceName,
        endpoint: this.connectionStatus.endpoint,
      });

      // Navigate to the service
      const packageObj = this.protoDescriptor[this.config.packageName] as any;
      if (!packageObj) {
        logger.error(
          'Package not found in proto descriptor',
          new Error(`Package ${this.config.packageName} not found`),
          {
            packageName: this.config.packageName,
            availablePackages: Object.keys(this.protoDescriptor),
          }
        );
        throw new Error(`Package ${this.config.packageName} not found in proto`);
      }

      logger.info('Package found, looking for service', {
        packageName: this.config.packageName,
        availableServices: Object.keys(packageObj),
      });

      const ServiceConstructor = packageObj[this.config.serviceName];
      if (!ServiceConstructor) {
        throw new Error(`Service ${this.config.serviceName} not found in package`);
      }

      // Create credentials
      const credentials = this.createCredentials();

      // Create client
      this.client = new ServiceConstructor(
        this.connectionStatus.endpoint,
        credentials,
        this.config.options
      );

      // Store channel reference
      this.channel = this.client.getChannel();

      logger.info('gRPC client created successfully', {
        name: this.name,
        endpoint: this.connectionStatus.endpoint,
      });
    } catch (error) {
      logger.error('Failed to create gRPC client', error as Error, {
        name: this.name,
        packageName: this.config.packageName,
        serviceName: this.config.serviceName,
      });
      throw error;
    }
  }

  /**
   * Create gRPC credentials
   */
  private createCredentials(): grpc.ChannelCredentials {
    const creds = this.config.credentials;

    if (!creds || creds.type === 'insecure') {
      return grpc.credentials.createInsecure();
    }

    switch (creds.type) {
      case 'ssl':
        return this.createSslCredentials(creds);
      case 'jwt':
        return this.createJwtCredentials(creds);
      case 'oauth2':
        return this.createOAuth2Credentials(creds);
      case 'api-key':
        return this.createApiKeyCredentials(creds);
      default:
        throw new Error(`Unsupported credential type: ${creds.type}`);
    }
  }

  /**
   * Create SSL credentials
   */
  private createSslCredentials(creds: GrpcCredentials): grpc.ChannelCredentials {
    if (creds.cert && creds.key) {
      return grpc.credentials.createSsl(
        creds.ca ? Buffer.from(creds.ca) : undefined,
        Buffer.from(creds.key),
        Buffer.from(creds.cert)
      );
    }

    // Use this to satisfy linter
    logger.debug('Creating SSL credentials', { name: this.name });
    return grpc.credentials.createSsl();
  }

  /**
   * Create JWT credentials
   */
  private createJwtCredentials(creds: GrpcCredentials): grpc.ChannelCredentials {
    if (!creds.token) {
      throw new Error('JWT token required for JWT credentials');
    }

    const metadata = new grpc.Metadata();
    metadata.add('authorization', `Bearer ${creds.token}`);

    return grpc.credentials.combineChannelCredentials(
      this.config.secure ? grpc.credentials.createSsl() : grpc.credentials.createInsecure(),
      grpc.credentials.createFromMetadataGenerator((_, callback) => {
        callback(null, metadata);
      })
    );
  }

  /**
   * Create OAuth2 credentials
   */
  private createOAuth2Credentials(creds: GrpcCredentials): grpc.ChannelCredentials {
    if (!creds.token) {
      throw new Error('OAuth2 token required for OAuth2 credentials');
    }

    const metadata = new grpc.Metadata();
    metadata.add('authorization', `Bearer ${creds.token}`);

    return grpc.credentials.combineChannelCredentials(
      this.config.secure ? grpc.credentials.createSsl() : grpc.credentials.createInsecure(),
      grpc.credentials.createFromMetadataGenerator((_, callback) => {
        callback(null, metadata);
      })
    );
  }

  /**
   * Create API key credentials
   */
  private createApiKeyCredentials(creds: GrpcCredentials): grpc.ChannelCredentials {
    if (!creds.apiKey) {
      throw new Error('API key required for API key credentials');
    }

    const metadata = new grpc.Metadata();
    metadata.add('x-api-key', creds.apiKey);

    return grpc.credentials.combineChannelCredentials(
      this.config.secure ? grpc.credentials.createSsl() : grpc.credentials.createInsecure(),
      grpc.credentials.createFromMetadataGenerator((_, callback) => {
        callback(null, metadata);
      })
    );
  }

  /**
   * Test connection
   */
  private async testConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.channel) {
        reject(new Error('Channel not available'));
        return;
      }

      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);

      this.channel.watchConnectivityState(
        this.channel.getConnectivityState(true),
        deadline,
        (error) => {
          if (error) {
            reject(error);
          } else {
            const state = this.channel!.getConnectivityState(false);
            this.connectionStatus.channelState = state;

            if (state === grpc.connectivityState.READY) {
              resolve();
            } else {
              reject(new Error(`Channel not ready, state: ${state}`));
            }
          }
        }
      );
    });
  }

  /**
   * Create call options
   */
  private createCallOptions(options?: GrpcCallOptions): any {
    const callOptions: any = {};

    if (options?.timeout) {
      callOptions.deadline = new Date(Date.now() + options.timeout);
    } else if (options?.deadline) {
      callOptions.deadline = options.deadline;
    } else if (this.config.retryConfig?.timeout) {
      callOptions.deadline = new Date(Date.now() + this.config.retryConfig.timeout);
    }

    return callOptions;
  }

  /**
   * Check if should retry
   */
  private shouldRetry(error: any, retryEnabled?: boolean): boolean {
    if (retryEnabled === false) {
      return false;
    }

    const { retryConfig } = this.config;
    if (!retryConfig || this.connectionStatus.retryCount >= retryConfig.maxRetries) {
      return false;
    }

    return retryConfig.retryableStatusCodes.includes(error.code);
  }

  /**
   * Retry call
   */
  private async retryCall<TRequest, TResponse>(
    methodName: string,
    request: TRequest,
    options?: GrpcCallOptions
  ): Promise<TResponse> {
    const retryConfig = this.config.retryConfig!;
    const delay = Math.min(
      retryConfig.initialDelayMs *
        retryConfig.backoffMultiplier ** this.connectionStatus.retryCount,
      retryConfig.maxDelayMs
    );

    this.connectionStatus.retryCount += 1;

    logger.info('Retrying gRPC call', {
      name: this.name,
      method: methodName,
      retryCount: this.connectionStatus.retryCount,
      delay,
    });

    await new Promise((resolve) => setTimeout(resolve, delay));

    return this.call(methodName, request, options);
  }

  /**
   * Create gRPC error
   */
  private createGrpcError(error: any): Error {
    logger.error('Creating gRPC error', error, { name: this.name });
    return new Error(`gRPC Error [${error.code}]: ${error.details || error.message}`);
  }

  /**
   * Monitor channel state
   */
  private monitorChannelState(): void {
    if (!this.channel) return;

    const checkState = () => {
      if (!this.channel) return;

      const currentState = this.channel.getConnectivityState(false);
      if (currentState !== this.connectionStatus.channelState) {
        this.connectionStatus.channelState = currentState;

        logger.debug('Channel state changed', {
          name: this.name,
          state: currentState,
        });

        if (
          currentState === grpc.connectivityState.TRANSIENT_FAILURE ||
          currentState === grpc.connectivityState.SHUTDOWN
        ) {
          this.connectionStatus.connected = false;
          this.scheduleReconnect();
        }
      }

      // Continue monitoring
      this.channel.watchConnectivityState(currentState, new Date(Date.now() + 5000), checkState);
    };

    checkState();
  }

  /**
   * Schedule reconnect
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    const retryConfig = this.config.retryConfig!;
    const delay = Math.min(
      retryConfig.initialDelayMs *
        retryConfig.backoffMultiplier ** this.connectionStatus.retryCount,
      retryConfig.maxDelayMs
    );

    logger.info('Scheduling gRPC reconnect', {
      name: this.name,
      delay,
      retryCount: this.connectionStatus.retryCount,
    });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (error) {
        logger.error('Reconnect attempt failed', error as Error, { name: this.name });
      }
    }, delay);
  }

  /**
   * Start health check
   */
  private startHealthCheck(): void {
    if (!this.config.healthCheck?.enabled || this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      const isHealthy = await this.healthCheck();
      if (!isHealthy) {
        logger.warn('Health check failed, attempting reconnect', { name: this.name });
        this.connectionStatus.connected = false;
        this.scheduleReconnect();
      }
    }, this.config.healthCheck.intervalMs);
  }

  /**
   * Stop all timers
   */
  private stopTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}
