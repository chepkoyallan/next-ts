// Common gRPC client configurations
import { GrpcClientConfig } from './grpc-client';

/**
 * Common gRPC client configurations
 */
export class GrpcClientConfigs {
  /**
   * Create orchestrator client config
   */
  static orchestrator(
    options: {
      host?: string;
      port?: number;
      secure?: boolean;
      credentials?: any;
    } = {}
  ): GrpcClientConfig {
    return {
      name: 'orchestrator',
      host: options.host || process.env.ORCHESTRATOR_GRPC_HOST || 'localhost',
      port: options.port || parseInt(process.env.ORCHESTRATOR_GRPC_PORT || '50051', 10),
      protoPath: process.env.ORCHESTRATOR_PROTO_PATH || './protos/orchestrator.proto',
      packageName: 'orchestrator',
      serviceName: 'OrchestratorService',
      secure: options.secure ?? process.env.ORCHESTRATOR_GRPC_SECURE === 'true',
      credentials: options.credentials || {
        type: process.env.ORCHESTRATOR_GRPC_AUTH_TYPE || 'insecure',
        token: process.env.ORCHESTRATOR_GRPC_TOKEN,
        apiKey: process.env.ORCHESTRATOR_GRPC_API_KEY,
      },
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableStatusCodes: [14, 4, 8], // UNAVAILABLE, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED
      },
      healthCheck: {
        enabled: true,
        intervalMs: 30000,
        timeoutMs: 5000,
      },
    };
  }

  /**
   * Create workflow engine client config
   */
  static workflowEngine(
    options: {
      host?: string;
      port?: number;
      secure?: boolean;
      credentials?: any;
    } = {}
  ): GrpcClientConfig {
    return {
      name: 'workflow-engine',
      host: options.host || process.env.WORKFLOW_ENGINE_GRPC_HOST || 'localhost',
      port: options.port || parseInt(process.env.WORKFLOW_ENGINE_GRPC_PORT || '50052', 10),
      protoPath: process.env.WORKFLOW_ENGINE_PROTO_PATH || './protos/workflow.proto',
      packageName: 'workflow',
      serviceName: 'WorkflowService',
      secure: options.secure ?? process.env.WORKFLOW_ENGINE_GRPC_SECURE === 'true',
      credentials: options.credentials || {
        type: process.env.WORKFLOW_ENGINE_GRPC_AUTH_TYPE || 'insecure',
        token: process.env.WORKFLOW_ENGINE_GRPC_TOKEN,
        apiKey: process.env.WORKFLOW_ENGINE_GRPC_API_KEY,
      },
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableStatusCodes: [14, 4, 8],
      },
      healthCheck: {
        enabled: true,
        intervalMs: 30000,
        timeoutMs: 5000,
      },
    };
  }

  /**
   * Create AI service client config
   */
  static aiService(
    options: {
      host?: string;
      port?: number;
      secure?: boolean;
      credentials?: any;
    } = {}
  ): GrpcClientConfig {
    return {
      name: 'ai-service',
      host: options.host || process.env.AI_SERVICE_GRPC_HOST || 'localhost',
      port: options.port || parseInt(process.env.AI_SERVICE_GRPC_PORT || '50053', 10),
      protoPath: process.env.AI_SERVICE_PROTO_PATH || './protos/ai.proto',
      packageName: 'ai',
      serviceName: 'AIService',
      secure: options.secure ?? process.env.AI_SERVICE_GRPC_SECURE === 'true',
      credentials: options.credentials || {
        type: process.env.AI_SERVICE_GRPC_AUTH_TYPE || 'insecure',
        token: process.env.AI_SERVICE_GRPC_TOKEN,
        apiKey: process.env.AI_SERVICE_GRPC_API_KEY,
      },
      retryConfig: {
        maxRetries: 5, // AI services might need more retries
        initialDelayMs: 2000,
        maxDelayMs: 60000,
        backoffMultiplier: 2,
        retryableStatusCodes: [14, 4, 8],
        timeout: 120000, // AI operations might take longer
      },
      healthCheck: {
        enabled: true,
        intervalMs: 60000, // Less frequent health checks for AI services
        timeoutMs: 10000,
      },
    };
  }

  /**
   * Create Flyte Admin Service client config (for task management)
   */
  static flyteAdmin(
    options: {
      host?: string;
      port?: number;
      secure?: boolean;
      credentials?: any;
    } = {}
  ): GrpcClientConfig {
    return {
      name: 'flyte-admin',
      host: options.host || process.env.FLYTE_ADMIN_HOST || 'localhost',
      port: options.port || parseInt(process.env.FLYTE_ADMIN_PORT || '8089', 10),
      protoPath:
        process.env.FLYTE_ADMIN_PROTO_PATH || './src/dsl/protos/flyteidl/service/admin.proto',
      includeDirs: ['./src/dsl/protos'],
      packageName: 'flyteidl.service',
      serviceName: 'AdminService',
      secure: options.secure ?? process.env.FLYTE_ADMIN_SECURE === 'true',
      credentials: options.credentials || {
        type: process.env.FLYTE_ADMIN_AUTH_TYPE || 'insecure',
        token: process.env.FLYTE_ADMIN_TOKEN,
        apiKey: process.env.FLYTE_ADMIN_API_KEY,
      },
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 15000,
        backoffMultiplier: 2,
        retryableStatusCodes: [14, 4, 8], // UNAVAILABLE, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED
      },
      healthCheck: {
        enabled: true,
        intervalMs: 30000,
        timeoutMs: 5000,
      },
    };
  }

  /**
   * Create Flyte External Plugin Service client config
   */
  static flytePlugin(
    options: {
      host?: string;
      port?: number;
      secure?: boolean;
      credentials?: any;
    } = {}
  ): GrpcClientConfig {
    return {
      name: 'flyte-plugin',
      host: options.host || process.env.FLYTE_PLUGIN_HOST || 'localhost',
      port: options.port || parseInt(process.env.FLYTE_PLUGIN_PORT || '8090', 10),
      protoPath:
        process.env.FLYTE_PLUGIN_PROTO_PATH ||
        './src/dsl/protos/flyteidl/service/external_plugin_service.proto',
      includeDirs: ['./src/dsl/protos'],
      packageName: 'flyteidl.service',
      serviceName: 'ExternalPluginService',
      secure: options.secure ?? process.env.FLYTE_PLUGIN_SECURE === 'true',
      credentials: options.credentials || {
        type: process.env.FLYTE_PLUGIN_AUTH_TYPE || 'insecure',
        token: process.env.FLYTE_PLUGIN_TOKEN,
        apiKey: process.env.FLYTE_PLUGIN_API_KEY,
      },
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        retryableStatusCodes: [14, 4, 8],
      },
      healthCheck: {
        enabled: true,
        intervalMs: 60000,
        timeoutMs: 10000,
      },
    };
  }

  /**
   * Create task management service configuration (combines Admin + Plugin)
   */
  static taskManagement(
    options: {
      adminHost?: string;
      adminPort?: number;
      pluginHost?: string;
      pluginPort?: number;
      enablePluginSupport?: boolean;
      defaultTimeout?: number;
    } = {}
  ) {
    return {
      adminService: this.flyteAdmin({
        host: options.adminHost,
        port: options.adminPort,
      }),
      pluginService: this.flytePlugin({
        host: options.pluginHost,
        port: options.pluginPort,
      }),
      defaultTimeout: options.defaultTimeout || 30000,
      enablePluginSupport:
        options.enablePluginSupport ?? process.env.ENABLE_PLUGIN_SUPPORT === 'true',
    };
  }

  /**
   * Create custom client config
   */
  static custom(
    config: Partial<GrpcClientConfig> & {
      name: string;
      host: string;
      port: number;
      protoPath: string;
      packageName: string;
      serviceName: string;
    }
  ): GrpcClientConfig {
    return {
      secure: true,
      credentials: { type: 'insecure' },
      retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 30000,
        backoffMultiplier: 2,
        retryableStatusCodes: [14, 4, 8],
      },
      healthCheck: {
        enabled: true,
        intervalMs: 30000,
        timeoutMs: 5000,
      },
      ...config,
    };
  }
}
