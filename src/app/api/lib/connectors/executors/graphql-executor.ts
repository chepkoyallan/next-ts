/**
 * GraphQL Connector Executor
 * Executes GraphQL queries as data sources
 */

import { logger } from '../../utils/logger';
import { applyDataMapping, extractDataFromResponse } from '../utils/data-mapper';
import {
  DataMapping,
  ExecutionResult,
  ExecutionContext,
  ValidationResult,
  ConnectorExecutor,
  HealthCheckResult,
  AuthenticationConfig,
  ConnectorQueryParams,
  GraphQLConnectorConfig,
  ConnectorExecutionError,
} from '../types';

export class GraphQLExecutor implements ConnectorExecutor {
  // eslint-disable-next-line class-methods-use-this
  async execute(
    config: GraphQLConnectorConfig,
    auth: AuthenticationConfig | undefined,
    mapping: DataMapping | undefined,
    query: ConnectorQueryParams,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info('Executing GraphQL connector', {
        requestId: context.requestId,
        endpoint: config.endpoint,
      });

      const headers = GraphQLExecutor.buildHeaders(auth);

      // Build variables from query params
      const variables = {
        ...config.variables,
        ...query.filters,
        ...query.customParams,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout || 30000);

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: config.query,
          variables,
          operationName: config.operationName,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new ConnectorExecutionError(
          `GraphQL request failed: ${response.statusText}`,
          'graphql'
        );
      }

      const result = await response.json();

      if (result.errors) {
        throw new ConnectorExecutionError(
          `GraphQL errors: ${result.errors.map((e: any) => e.message).join(', ')}`,
          'graphql'
        );
      }

      // Extract data
      let data = extractDataFromResponse(result, mapping?.rootPath || '$.data');

      if (!Array.isArray(data)) {
        data = [data];
      }

      // Apply mapping
      if (mapping) {
        data = applyDataMapping(data, mapping);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data,
        totalCount: data.length,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      return {
        success: false,
        data: [],
        executionTime,
        error: error.message || 'GraphQL execution failed',
      };
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async test(
    config: GraphQLConnectorConfig,
    auth: AuthenticationConfig | undefined
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const headers = GraphQLExecutor.buildHeaders(auth);

      // Use introspection query
      const introspectionQuery = '{ __schema { queryType { name } } }';

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: introspectionQuery }),
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        status: 'healthy',
        lastCheck: new Date(),
        responseTime,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async validate(config: GraphQLConnectorConfig): Promise<ValidationResult> {
    const errors: any[] = [];

    if (!config.endpoint) {
      errors.push({
        field: 'endpoint',
        message: 'Endpoint is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!config.query) {
      errors.push({
        field: 'query',
        message: 'Query is required',
        code: 'REQUIRED_FIELD',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private static buildHeaders(auth?: AuthenticationConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!auth || auth.type === 'none') {
      return headers;
    }

    switch (auth.type) {
      case 'bearer':
        headers.Authorization = `Bearer ${auth.token}`;
        break;
      case 'api_key':
        if (auth.location === 'header') {
          headers[auth.headerName || 'X-API-Key'] = auth.key;
        }
        break;
      case 'basic': {
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers.Authorization = `Basic ${credentials}`;
        break;
      }
      case 'custom':
        if (auth.headers) {
          Object.assign(headers, auth.headers);
        }
        break;
      default:
        break;
    }

    return headers;
  }
}
