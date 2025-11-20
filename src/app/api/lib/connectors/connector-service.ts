/**
 * Main Connector Service
 * Orchestrates connector execution with caching, rate limiting, and health monitoring
 */

import { prisma } from '@app/database';

import { logger } from '../utils/logger';
import { rateLimiter } from './rate-limiter';
import { healthMonitor } from './health-monitor';
import { credentialVault } from './credential-vault';
import { GraphQLExecutor } from './executors/graphql-executor';
import { RestApiExecutor } from './executors/rest-api-executor';
import { DatabaseExecutor } from './executors/database-executor';
import { cacheManager, ConnectorCacheManager } from './cache-manager';
import { FlyteWorkflowExecutor } from './executors/flyte-workflow-executor';
import {
  HealthStatus,
  ConnectorType,
  ConnectorModel,
  ConnectorError,
  ConnectorStatus,
  ExecutionResult,
  ExecutionContext,
  ValidationResult,
  IConnectorService,
  HealthCheckResult,
  ConnectorQueryParams,
  TestConnectionResult,
  ConnectorConfiguration,
  ConnectorValidationError,
} from './types';

export class ConnectorService implements IConnectorService {
  private executors: Map<ConnectorType, any>;

  private prisma = prisma;

  private logger = logger;

  constructor() {
    // Initialize executors
    this.executors = new Map<ConnectorType, any>([
      ['rest_api' as ConnectorType, new RestApiExecutor()],
      ['flyte_workflow' as ConnectorType, new FlyteWorkflowExecutor()],
      ['database' as ConnectorType, new DatabaseExecutor()],
      ['graphql' as ConnectorType, new GraphQLExecutor()],
    ]);
  }

  /**
   * Create a new connector
   */
  async createConnector(
    connector: Omit<ConnectorModel, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ConnectorModel> {
    try {
      logger.info('Creating connector', {
        name: connector.name,
        type: connector.type,
        organizationId: connector.organizationId,
      });

      // Validate configuration
      const validation = await this.validateConfiguration(connector.type, connector.configuration);
      if (!validation.valid) {
        throw new ConnectorValidationError('Invalid connector configuration', validation.errors);
      }

      // Encrypt authentication if provided
      let encryptedAuth: string | undefined;
      if (connector.authentication) {
        encryptedAuth = credentialVault.encryptAuth(connector.authentication);
      }

      // Create connector in database
      const created = await prisma.connectorConfig.create({
        data: {
          name: connector.name,
          description: connector.description,
          organizationId: connector.organizationId,
          type: connector.type,
          configuration: connector.configuration as any,
          authentication: encryptedAuth ? JSON.parse(encryptedAuth) : undefined,
          schema: connector.schema as any,
          dataMapping: connector.dataMapping as any,
          caching: connector.caching as any,
          rateLimit: connector.rateLimit as any,
          healthCheckConfig: connector.healthCheck as any,
          status: connector.status,
          createdBy: connector.createdBy,
          tags: connector.tags || [],
          category: connector.category,
        },
      });

      logger.info('Connector created successfully', { id: created.id });

      return ConnectorService.mapToConnectorModel(created);
    } catch (error: any) {
      logger.error('Failed to create connector', error);
      throw error;
    }
  }

  /**
   * Get connector by ID
   */
  async getConnector(id: string, organizationId: string): Promise<ConnectorModel | null> {
    try {
      const connector = await this.prisma.connectorConfig.findFirst({
        where: {
          id,
          organizationId,
        },
      });

      if (!connector) {
        return null;
      }

      return ConnectorService.mapToConnectorModel(connector);
    } catch (error: any) {
      this.logger.error('Failed to get connector', error, { id });
      throw error;
    }
  }

  /**
   * List connectors for an organization
   */
  async listConnectors(organizationId: string, filters?: any): Promise<ConnectorModel[]> {
    try {
      const where: any = { organizationId };

      if (filters?.type) {
        where.type = filters.type;
      }

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // ⚡ Performance: Add pagination with defaults
      const limit = Math.min(filters?.limit || 100, 1000); // Max 1000 results
      const offset = filters?.offset || 0;

      // ⚡ Performance: Only select essential fields for list view
      const connectors = await this.prisma.connectorConfig.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          organizationId: true,
          type: true,
          status: true,
          lastHealthCheck: true,
          healthStatus: true,
          totalExecutions: true,
          successfulExecutions: true,
          failedExecutions: true,
          averageResponseTime: true,
          tags: true,
          category: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          // Exclude heavy fields: configuration, authentication, schema, dataMapping
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        // ⚡ Prisma Accelerate: Cache this query for 60 seconds
        cacheStrategy: {
          ttl: 60,
          swr: 10, // Serve stale while revalidate for 10 seconds
        },
      } as any);

      // Map to ConnectorModel (fill in missing fields with undefined)
      return connectors.map((c) => ({
        ...c,
        type: c.type as ConnectorType,
        status: c.status as ConnectorStatus,
        description: c.description ?? undefined,
        lastHealthCheck: c.lastHealthCheck ?? undefined,
        healthStatus: (c.healthStatus as HealthStatus) ?? undefined,
        totalExecutions: c.totalExecutions ?? undefined,
        successfulExecutions: c.successfulExecutions ?? undefined,
        failedExecutions: c.failedExecutions ?? undefined,
        averageResponseTime: c.averageResponseTime ?? undefined,
        tags: c.tags || [],
        category: c.category ?? undefined,
        configuration: null as any, // Not loaded in list view
        authentication: null as any,
        schema: undefined,
        dataMapping: undefined,
        caching: undefined,
        rateLimit: undefined,
        healthCheck: undefined,
      }));
    } catch (error: any) {
      this.logger.error('Failed to list connectors', error, { organizationId });
      throw error;
    }
  }

  /**
   * Update connector
   */
  async updateConnector(
    id: string,
    organizationId: string,
    updates: Partial<ConnectorModel>
  ): Promise<ConnectorModel> {
    try {
      logger.info('Updating connector', { id, organizationId });

      // Validate if configuration is being updated
      if (updates.configuration) {
        const connector = await this.getConnector(id, organizationId);
        if (!connector) {
          throw new ConnectorError('Connector not found', 'NOT_FOUND', id);
        }

        const validation = await this.validateConfiguration(connector.type, updates.configuration);
        if (!validation.valid) {
          throw new ConnectorValidationError('Invalid connector configuration', validation.errors);
        }
      }

      // Encrypt authentication if being updated
      let encryptedAuth: any;
      if (updates.authentication) {
        encryptedAuth = JSON.parse(credentialVault.encryptAuth(updates.authentication));
      }

      const updated = await prisma.connectorConfig.update({
        where: { id },
        data: {
          ...(updates.name && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.configuration && { configuration: updates.configuration as any }),
          ...(encryptedAuth && { authentication: encryptedAuth }),
          ...(updates.schema && { schema: updates.schema as any }),
          ...(updates.dataMapping && { dataMapping: updates.dataMapping as any }),
          ...(updates.caching && { caching: updates.caching as any }),
          ...(updates.rateLimit && { rateLimit: updates.rateLimit as any }),
          ...(updates.healthCheck && { healthCheckConfig: updates.healthCheck as any }),
          ...(updates.status && { status: updates.status }),
          ...(updates.tags !== undefined && { tags: updates.tags }),
          ...(updates.category !== undefined && { category: updates.category }),
        },
      });

      logger.info('Connector updated successfully', { id });

      return ConnectorService.mapToConnectorModel(updated);
    } catch (error: any) {
      logger.error('Failed to update connector', error, { id });
      throw error;
    }
  }

  /**
   * Delete connector
   */
  async deleteConnector(id: string, organizationId: string): Promise<boolean> {
    try {
      await this.prisma.connectorConfig.delete({
        where: {
          id,
          organizationId,
        },
      });

      // Clear cache for this connector
      await cacheManager.invalidate(`connector:${id}:*`);

      // Cancel scheduled health checks
      healthMonitor.cancelHealthCheck(id);

      this.logger.info('Connector deleted successfully', { id });

      return true;
    } catch (error: any) {
      this.logger.error('Failed to delete connector', error, { id });
      return false;
    }
  }

  /**
   * Execute connector
   */
  async executeConnector(
    id: string,
    query: ConnectorQueryParams,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    try {
      logger.info('Executing connector', { id, requestId: context.requestId });

      // Get connector
      const connector = await this.getConnector(id, context.organizationId);
      if (!connector) {
        throw new ConnectorError('Connector not found', 'NOT_FOUND', id);
      }

      // Check rate limit
      if (connector.rateLimit) {
        await rateLimiter.checkLimitOrThrow(id, connector.rateLimit);
      }

      // Generate cache key
      const cacheKey = ConnectorCacheManager.generateKey(id, query, context.userId);

      // Check cache
      if (connector.caching?.enabled) {
        const cached = await cacheManager.get<ExecutionResult>(cacheKey);
        if (cached) {
          logger.info('Cache hit', { id, requestId: context.requestId });
          return { ...cached, cached: true };
        }
      }

      // Get executor
      const executor = this.executors.get(connector.type);
      if (!executor) {
        throw new ConnectorError(
          `Executor not found for type: ${connector.type}`,
          'EXECUTOR_NOT_FOUND',
          id
        );
      }

      // Decrypt authentication
      const auth = connector.authentication
        ? credentialVault.decryptAuth(JSON.stringify(connector.authentication))
        : undefined;

      // Execute connector
      const result = await executor.execute(
        connector.configuration,
        auth,
        connector.dataMapping,
        query,
        context
      );

      // Record request for rate limiting
      if (connector.rateLimit) {
        await rateLimiter.recordRequest(id);
      }

      // Cache result
      if (connector.caching?.enabled && result.success) {
        await cacheManager.set(cacheKey, result, connector.caching.ttl);
      }

      // Update statistics
      await ConnectorService.updateStatistics(id, result);

      // Log execution to audit log
      await ConnectorService.logExecution(id, query, result, context);

      return result;
    } catch (error: any) {
      logger.error('Connector execution failed', error, { id });
      throw error;
    }
  }

  /**
   * Test connector connection
   */
  async testConnection(id: string, organizationId: string): Promise<TestConnectionResult> {
    try {
      const connector = await this.getConnector(id, organizationId);
      if (!connector) {
        throw new ConnectorError('Connector not found', 'NOT_FOUND', id);
      }

      const executor = this.executors.get(connector.type);
      if (!executor) {
        throw new ConnectorError(
          `Executor not found for type: ${connector.type}`,
          'EXECUTOR_NOT_FOUND',
          id
        );
      }

      const auth = connector.authentication
        ? credentialVault.decryptAuth(JSON.stringify(connector.authentication))
        : undefined;

      const result = await executor.test(connector.configuration, auth);

      // Update health status in database
      await prisma.connectorConfig.update({
        where: { id },
        data: {
          lastHealthCheck: new Date(),
          healthStatus: result.status,
        },
      });

      return result;
    } catch (error: any) {
      logger.error('Connection test failed', error, { id });
      throw error;
    }
  }

  /**
   * Test execute a temporary connector configuration without saving
   * Used for testing/preview during connector creation wizard
   */
  async testExecutor(
    type: ConnectorType,
    configuration: ConnectorConfiguration,
    authentication: any,
    query: ConnectorQueryParams,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    try {
      logger.info('Test executing connector configuration', { type, requestId: context.requestId });

      // Get executor
      const executor = this.executors.get(type);
      if (!executor) {
        throw new ConnectorError(
          `Executor not found for type: ${type}`,
          'EXECUTOR_NOT_FOUND',
          'temp'
        );
      }

      // Validate configuration first
      const validation = await this.validateConfiguration(type, configuration);
      if (!validation.valid) {
        throw new ConnectorValidationError('Invalid connector configuration', validation.errors);
      }

      // Decrypt/prepare authentication if provided
      let auth;
      if (authentication) {
        auth =
          typeof authentication === 'string'
            ? credentialVault.decryptAuth(authentication)
            : authentication;
      }

      // Execute without caching, rate limiting, or statistics
      const result = await executor.execute(configuration, auth, undefined, query, context);

      return result;
    } catch (error: any) {
      logger.error('Test execution failed', error);
      throw error;
    }
  }

  /**
   * Check connector health
   */
  async checkHealth(id: string): Promise<HealthCheckResult> {
    try {
      const connector = await this.prisma.connectorConfig.findUnique({ where: { id } });
      if (!connector) {
        throw new ConnectorError('Connector not found', 'NOT_FOUND', id);
      }

      const model = ConnectorService.mapToConnectorModel(connector);
      const auth = model.authentication
        ? credentialVault.decryptAuth(JSON.stringify(model.authentication))
        : undefined;

      return await healthMonitor.checkHealth(id, model.configuration, auth);
    } catch (error: any) {
      this.logger.error('Health check failed', error, { id });
      throw error;
    }
  }

  /**
   * Validate connector configuration
   */
  async validateConfiguration(
    type: ConnectorType,
    config: ConnectorConfiguration
  ): Promise<ValidationResult> {
    const executor = this.executors.get(type);
    if (!executor) {
      return {
        valid: false,
        errors: [
          {
            field: 'type',
            message: `Unsupported connector type: ${type}`,
            code: 'INVALID_TYPE',
          },
        ],
      };
    }

    return executor.validate(config);
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats(id: string): Promise<any> {
    const connector = await this.prisma.connectorConfig.findUnique({ where: { id } });
    if (!connector) {
      return null;
    }

    return {
      totalExecutions: connector.totalExecutions,
      successfulExecutions: connector.successfulExecutions,
      failedExecutions: connector.failedExecutions,
      averageResponseTime: connector.averageResponseTime,
      successRate:
        connector.totalExecutions > 0
          ? (connector.successfulExecutions / connector.totalExecutions) * 100
          : 0,
    };
  }

  /**
   * Update connector statistics
   */
  private static async updateStatistics(id: string, result: ExecutionResult): Promise<void> {
    try {
      const connector = await prisma.connectorConfig.findUnique({ where: { id } });
      if (!connector) return;

      const newTotalExecutions = connector.totalExecutions + 1;
      const newSuccessful = result.success
        ? connector.successfulExecutions + 1
        : connector.successfulExecutions;
      const newFailed = !result.success
        ? connector.failedExecutions + 1
        : connector.failedExecutions;

      // Calculate rolling average response time
      const currentAvg = connector.averageResponseTime || 0;
      const newAvg =
        (currentAvg * connector.totalExecutions + result.executionTime) / newTotalExecutions;

      await prisma.connectorConfig.update({
        where: { id },
        data: {
          totalExecutions: newTotalExecutions,
          successfulExecutions: newSuccessful,
          failedExecutions: newFailed,
          averageResponseTime: newAvg,
        },
      });
    } catch (error: any) {
      logger.error('Failed to update statistics', error, { id });
    }
  }

  /**
   * Log execution to audit log
   */
  private static async logExecution(
    connectorId: string,
    query: ConnectorQueryParams,
    result: ExecutionResult,
    context: ExecutionContext
  ): Promise<void> {
    try {
      await prisma.connectorAuditLog.create({
        data: {
          connectorId,
          action: 'executed',
          userId: context.userId,
          organizationId: context.organizationId,
          queryParams: query as any,
          result: {
            success: result.success,
            executionTime: result.executionTime,
            recordCount: result.data?.length || 0,
            error: result.error,
          } as any,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      logger.error('Failed to log execution', error, { connectorId });
    }
  }

  /**
   * Map Prisma model to ConnectorModel
   */
  private static mapToConnectorModel(prismaModel: any): ConnectorModel {
    return {
      id: prismaModel.id,
      name: prismaModel.name,
      description: prismaModel.description,
      organizationId: prismaModel.organizationId,
      type: prismaModel.type as ConnectorType,
      configuration: prismaModel.configuration,
      authentication: prismaModel.authentication,
      schema: prismaModel.schema,
      dataMapping: prismaModel.dataMapping,
      caching: prismaModel.caching,
      rateLimit: prismaModel.rateLimit,
      healthCheck: prismaModel.healthCheckConfig,
      status: prismaModel.status,
      lastHealthCheck: prismaModel.lastHealthCheck,
      healthStatus: prismaModel.healthStatus,
      createdBy: prismaModel.createdBy,
      createdAt: prismaModel.createdAt,
      updatedAt: prismaModel.updatedAt,
      tags: prismaModel.tags || [],
      category: prismaModel.category ?? undefined,
      totalExecutions: prismaModel.totalExecutions,
      successfulExecutions: prismaModel.successfulExecutions,
      failedExecutions: prismaModel.failedExecutions,
      averageResponseTime: prismaModel.averageResponseTime,
    };
  }
}

// Export singleton instance
export const connectorService = new ConnectorService();
