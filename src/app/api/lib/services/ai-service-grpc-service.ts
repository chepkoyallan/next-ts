// AI Service gRPC client implementation
import { BaseGrpcService } from './base-grpc-service';
import { GrpcClientConfig } from '../grpc/grpc-client';

/**
 * AI Service gRPC client
 */
export class AIServiceGrpcService extends BaseGrpcService {
  constructor(config?: Partial<GrpcClientConfig>) {
    const defaultConfig: GrpcClientConfig = {
      name: 'ai-service',
      host: process.env.AI_SERVICE_GRPC_HOST || 'localhost',
      port: parseInt(process.env.AI_SERVICE_GRPC_PORT || '50053', 10),
      protoPath: process.env.AI_SERVICE_PROTO_PATH || './protos/ai.proto',
      packageName: 'ai',
      serviceName: 'AIService',
      secure: process.env.AI_SERVICE_GRPC_SECURE === 'true',
      credentials: {
        type: (process.env.AI_SERVICE_GRPC_AUTH_TYPE as any) || 'insecure',
        token: process.env.AI_SERVICE_GRPC_TOKEN,
        apiKey: process.env.AI_SERVICE_GRPC_API_KEY,
      },
      retryConfig: {
        maxRetries: 5,
        initialDelayMs: 2000,
        maxDelayMs: 60000,
        backoffMultiplier: 2,
        retryableStatusCodes: [14, 4, 8],
        timeout: 120000,
      },
      ...config,
    };

    super('ai-service', defaultConfig);
  }

  // AI operations
  async generateText(request: any): Promise<any> {
    this.ensureInitialized();
    return this.client.call('GenerateText', request, { timeout: 60000 });
  }

  async analyzeText(request: any): Promise<any> {
    this.ensureInitialized();
    return this.client.call('AnalyzeText', request);
  }

  async processImage(request: any): Promise<any> {
    this.ensureInitialized();
    return this.client.call('ProcessImage', request, { timeout: 120000 });
  }

  async trainModel(request: any): Promise<any> {
    this.ensureInitialized();
    return this.client.call('TrainModel', request, { timeout: 300000 });
  }

  // Streaming operations
  streamGeneration(request: any): any {
    this.ensureInitialized();
    return this.client.createStream('StreamGeneration', request);
  }

  streamTraining(request: any): any {
    this.ensureInitialized();
    return this.client.createStream('StreamTraining', request);
  }
}
