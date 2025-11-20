/**
 * Engine - Modern gRPC Client for Flyte
 * Public API for the engine module
 */

// Core exports
import { EngineClientConfig } from './grpc/types';
import { TaskService } from './services/task-service';
// Service imports
import { AdminService } from './services/admin-service';
import { SignalService } from './services/signal-service';
import { WorkflowService } from './services/workflow-service';
import { IdentityService } from './services/identity-service';
import { DataProxyService } from './services/data-proxy-service';
import { AuthMetadataService } from './services/auth-metadata-service';
import { ExternalPluginService } from './services/external-plugin-service';

// Core exports
export * from './grpc/types';
export { EngineGrpcClient } from './grpc/client';
export { ConnectionManager } from './grpc/connection';

export { TaskService } from './services/task-service';
// Service exports
export { AdminService } from './services/admin-service';
export { SignalService } from './services/signal-service';
export { WorkflowService } from './services/workflow-service';
export { IdentityService } from './services/identity-service';
export { DataProxyService } from './services/data-proxy-service';
export type { AuthType, TracingContext } from './utils/metadata';
export type { RetryContext, RetryCallback } from './utils/retry';
export { AuthMetadataService } from './services/auth-metadata-service';
export { ExternalPluginService } from './services/external-plugin-service';

export { RetryManager, retryWithBackoff, createDefaultRetryManager } from './utils/retry';
export type { TaskStatistics, TaskQueryOptions, CreateTaskOptions } from './services/task-service';
// Utility exports
export { createMetadata, generateSpanId, MetadataBuilder, generateTraceId } from './utils/metadata';
export type {
  WorkflowQueryOptions,
  ExecutionQueryOptions,
  CreateExecutionOptions,
  ExecutionStatusSummary,
} from './services/workflow-service';
export {
  cloneMessage,
  messagesEqual,
  TaskSerializer,
  ProtoSerializer,
  validateMessage,
  LiteralSerializer,
  WorkflowSerializer,
  ExecutionSerializer,
} from './utils/serialization';

export interface EngineServicesConfig {
  admin?: EngineClientConfig;
  tasks?: EngineClientConfig;
  workflows?: EngineClientConfig;
  authMetadata?: EngineClientConfig;
  dataProxy?: EngineClientConfig;
  externalPlugin?: EngineClientConfig;
  identity?: EngineClientConfig;
  signal?: EngineClientConfig;
}

export interface EngineServices {
  admin: AdminService | null;
  tasks: TaskService | null;
  workflows: WorkflowService | null;
  authMetadata: AuthMetadataService | null;
  dataProxy: DataProxyService | null;
  externalPlugin: ExternalPluginService | null;
  identity: IdentityService | null;
  signal: SignalService | null;
}

export interface EngineManager {
  services: EngineServices;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<Record<string, boolean>>;
}

/**
 * Create and configure engine services
 */
export function createEngineServices(config: EngineServicesConfig): EngineManager {
  const services: EngineServices = {
    admin: config.admin ? new AdminService(config.admin) : null,
    tasks: config.tasks ? new TaskService(config.tasks) : null,
    workflows: config.workflows ? new WorkflowService(config.workflows) : null,
    authMetadata: config.authMetadata ? new AuthMetadataService(config.authMetadata) : null,
    dataProxy: config.dataProxy ? new DataProxyService(config.dataProxy) : null,
    externalPlugin: config.externalPlugin ? new ExternalPluginService(config.externalPlugin) : null,
    identity: config.identity ? new IdentityService(config.identity) : null,
    signal: config.signal ? new SignalService(config.signal) : null,
  };

  return {
    services,

    /**
     * Initialize all configured services
     */
    async initialize() {
      const initPromises = Object.values(services)
        .filter((service): service is NonNullable<typeof service> => service !== null)
        .map((service) => service.initialize());

      await Promise.all(initPromises);
    },

    /**
     * Shutdown all services
     */
    async shutdown() {
      const shutdownPromises = Object.values(services)
        .filter((service): service is NonNullable<typeof service> => service !== null)
        .map((service) => service.shutdown());

      await Promise.all(shutdownPromises);
    },

    /**
     * Check health of all services
     */
    async healthCheck() {
      const healthResults: Record<string, boolean> = {};

      Object.entries(services).forEach(([name, service]) => {
        if (service) {
          healthResults[name] = service.isReady();
        }
      });

      return healthResults;
    },
  };
}

/**
 * Create engine services with environment-based configuration
 */
export function createEngineServicesFromEnv(): EngineManager {
  const baseConfig: Partial<EngineClientConfig> = {
    secure: process.env.GRPC_SECURE === 'true',
    timeout: parseInt(process.env.GRPC_TIMEOUT || '30000', 10),
  };

  const config: EngineServicesConfig = {};

  // Admin service configuration
  if (process.env.FLYTE_ADMIN_HOST) {
    config.admin = {
      name: 'flyte-admin',
      host: process.env.FLYTE_ADMIN_HOST,
      port: parseInt(process.env.FLYTE_ADMIN_PORT || '8089', 10),
      ...baseConfig,
    };
  }

  // Task service configuration (uses same endpoint as admin)
  if (process.env.FLYTE_ADMIN_HOST) {
    config.tasks = {
      name: 'task-service',
      host: process.env.FLYTE_ADMIN_HOST,
      port: parseInt(process.env.FLYTE_ADMIN_PORT || '8089', 10),
      ...baseConfig,
    };
  }

  // Workflow service configuration (uses same endpoint as admin)
  if (process.env.FLYTE_ADMIN_HOST) {
    config.workflows = {
      name: 'workflow-service',
      host: process.env.FLYTE_ADMIN_HOST,
      port: parseInt(process.env.FLYTE_ADMIN_PORT || '8089', 10),
      ...baseConfig,
    };
  }

  // Auth Metadata service configuration
  if (process.env.FLYTE_AUTH_HOST) {
    config.authMetadata = {
      name: 'auth-metadata-service',
      host: process.env.FLYTE_AUTH_HOST,
      port: parseInt(process.env.FLYTE_AUTH_PORT || '8089', 10),
      ...baseConfig,
    };
  }

  // Data Proxy service configuration
  if (process.env.FLYTE_DATA_PROXY_HOST) {
    config.dataProxy = {
      name: 'data-proxy-service',
      host: process.env.FLYTE_DATA_PROXY_HOST,
      port: parseInt(process.env.FLYTE_DATA_PROXY_PORT || '8089', 10),
      ...baseConfig,
    };
  }

  // External Plugin service configuration
  if (process.env.FLYTE_EXTERNAL_PLUGIN_HOST) {
    config.externalPlugin = {
      name: 'external-plugin-service',
      host: process.env.FLYTE_EXTERNAL_PLUGIN_HOST,
      port: parseInt(process.env.FLYTE_EXTERNAL_PLUGIN_PORT || '8089', 10),
      ...baseConfig,
    };
  }

  // Identity service configuration
  if (process.env.FLYTE_IDENTITY_HOST) {
    config.identity = {
      name: 'identity-service',
      host: process.env.FLYTE_IDENTITY_HOST,
      port: parseInt(process.env.FLYTE_IDENTITY_PORT || '8089', 10),
      ...baseConfig,
    };
  }

  // Signal service configuration
  if (process.env.FLYTE_SIGNAL_HOST) {
    config.signal = {
      name: 'signal-service',
      host: process.env.FLYTE_SIGNAL_HOST,
      port: parseInt(process.env.FLYTE_SIGNAL_PORT || '8089', 10),
      ...baseConfig,
    };
  }

  return createEngineServices(config);
}

/**
 * Default export
 */
export default {
  createEngineServices,
  createEngineServicesFromEnv,
};
