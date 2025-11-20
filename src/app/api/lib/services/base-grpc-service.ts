// Base gRPC service implementation
import { logger } from '../utils/logger';
import { ServiceProvider } from './service-interfaces';
import { GrpcClientFactory } from '../grpc/grpc-client-factory';
import { GrpcClient, GrpcClientConfig } from '../grpc/grpc-client';

/**
 * Base gRPC service that implements ServiceProvider
 */
export abstract class BaseGrpcService implements ServiceProvider {
  public readonly name: string;

  protected client: GrpcClient;

  protected initialized = false;

  constructor(name: string, config: GrpcClientConfig) {
    this.name = name;
    this.client = GrpcClientFactory.getOrCreate(config);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing gRPC service', { name: this.name });
      await this.client.initialize();
      this.initialized = true;
      logger.info('gRPC service initialized successfully', { name: this.name });
    } catch (error) {
      logger.error('Failed to initialize gRPC service', error as Error, { name: this.name });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.initialized) {
        return false;
      }
      return await this.client.healthCheck();
    } catch (error) {
      logger.warn('gRPC service health check failed', {
        name: this.name,
        error: (error as Error).message,
      });
      return false;
    }
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down gRPC service', { name: this.name });
      await this.client.shutdown();
      this.initialized = false;
      logger.info('gRPC service shutdown complete', { name: this.name });
    } catch (error) {
      logger.error('Error during gRPC service shutdown', error as Error, { name: this.name });
      throw error;
    }
  }

  protected ensureInitialized(): void {
    if (!this.initialized || !this.client.isConnected()) {
      throw new Error(`gRPC service ${this.name} is not initialized or connected`);
    }
  }
}
