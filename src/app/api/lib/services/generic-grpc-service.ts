// Generic gRPC service for custom implementations
import { BaseGrpcService } from './base-grpc-service';
import { GrpcClientConfig } from '../grpc/grpc-client';

/**
 * Generic gRPC service for custom implementations
 */
export class GenericGrpcService extends BaseGrpcService {
  private readonly customConfig: GrpcClientConfig;

  constructor(name: string, config: GrpcClientConfig) {
    super(name, config);
    // Store config for potential custom operations
    this.customConfig = { ...config };
  }

  /**
   * Make a generic gRPC call
   */
  async call<TRequest, TResponse>(
    methodName: string,
    request: TRequest,
    options?: { timeout?: number; retry?: boolean }
  ): Promise<TResponse> {
    this.ensureInitialized();
    return this.client.call(methodName, request, options);
  }

  /**
   * Create a generic gRPC stream
   */
  createStream<TRequest>(
    methodName: string,
    request?: TRequest,
    options?: { timeout?: number }
  ): any {
    this.ensureInitialized();
    return this.client.createStream(methodName, request, options);
  }

  /**
   * Get client connection status
   */
  getConnectionStatus(): any {
    return this.client.getConnectionStatus();
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.client.isConnected();
  }

  /**
   * Get the custom configuration used for this service
   */
  getCustomConfig(): GrpcClientConfig {
    return { ...this.customConfig };
  }

  /**
   * Update service configuration (creates new client if needed)
   */
  updateConfig(newConfig: Partial<GrpcClientConfig>): void {
    Object.assign(this.customConfig, newConfig);
  }
}
