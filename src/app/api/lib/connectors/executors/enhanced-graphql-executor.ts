/**
 * Enhanced GraphQL Executor
 * Supports schema introspection, query building, and advanced features
 */

import {
  parse,
  validate,
  GraphQLSchema,
  buildClientSchema,
  IntrospectionQuery,
  getIntrospectionQuery,
} from 'graphql';

import { logger } from '../../utils/logger';
import { applyDataMapping } from '../utils/data-mapper';
import { DataMapping, ExecutionContext, ValidationResult, TestConnectionResult } from '../types';

export interface GraphQLConfiguration {
  endpoint: string;
  headers?: Record<string, string>;
  introspectionEnabled?: boolean;
  queryTimeout?: number;
  retryAttempts?: number;
}

export interface GraphQLExecutionResult {
  success: boolean;
  data: any;
  executionTime: number;
  error?: string;
  metadata?: {
    endpoint: string;
    queryComplexity: number;
  };
}

export interface GraphQLAuth {
  type: 'bearer' | 'apiKey' | 'basic' | 'none';
  token?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  username?: string;
  password?: string;
}

export interface GraphQLQuery {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

export interface GraphQLIntrospectionResult {
  schema: GraphQLSchema;
  types: string[];
  queries: Array<{
    name: string;
    type: string;
    args: Array<{ name: string; type: string }>;
  }>;
  mutations: Array<{
    name: string;
    type: string;
    args: Array<{ name: string; type: string }>;
  }>;
  subscriptions: Array<{
    name: string;
    type: string;
    args: Array<{ name: string; type: string }>;
  }>;
}

export class EnhancedGraphQLExecutor {
  private schemaCache: Map<string, { schema: GraphQLSchema; timestamp: number }> = new Map();

  private readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * Execute GraphQL query
   */
  async execute(
    config: GraphQLConfiguration,
    auth?: GraphQLAuth,
    dataMapping?: DataMapping,
    query?: GraphQLQuery,
    context?: ExecutionContext
  ): Promise<GraphQLExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info('Executing GraphQL query', { endpoint: config.endpoint });

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...config.headers,
      };

      // Add authentication
      if (auth) {
        EnhancedGraphQLExecutor.addAuthHeaders(headers, auth);
      }

      // Prepare request body
      const body: any = {
        query: query?.query,
        variables: query?.variables,
      };

      if (query?.operationName) {
        body.operationName = query.operationName;
      }

      // Make request with retries
      const response = await this.makeRequestWithRetry(
        config.endpoint,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(config.queryTimeout || 30000),
        },
        config.retryAttempts || 3
      );

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Check for GraphQL errors
      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      let { data } = result;

      // Apply data mapping using standard utility
      if (dataMapping) {
        data = applyDataMapping(data, dataMapping);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data,
        executionTime,
        metadata: {
          endpoint: config.endpoint,
          queryComplexity: EnhancedGraphQLExecutor.calculateQueryComplexity(query?.query || ''),
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      logger.error('GraphQL execution failed', error);

      return {
        success: false,
        data: {},
        error: error.message,
        executionTime,
      };
    }
  }

  /**
   * Perform schema introspection
   */
  async introspectSchema(
    config: GraphQLConfiguration,
    auth?: GraphQLAuth
  ): Promise<GraphQLIntrospectionResult> {
    try {
      // Check cache first
      const cacheKey = config.endpoint;
      const cached = this.schemaCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.info('Using cached schema');
        return EnhancedGraphQLExecutor.parseIntrospectionResult(cached.schema);
      }

      logger.info('Introspecting GraphQL schema', { endpoint: config.endpoint });

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...config.headers,
      };

      if (auth) {
        EnhancedGraphQLExecutor.addAuthHeaders(headers, auth);
      }

      // Execute introspection query
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: getIntrospectionQuery(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Introspection failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(`Introspection errors: ${JSON.stringify(result.errors)}`);
      }

      // Build client schema
      const schema = buildClientSchema(result.data as IntrospectionQuery);

      // Cache the schema
      this.schemaCache.set(cacheKey, {
        schema,
        timestamp: Date.now(),
      });

      return EnhancedGraphQLExecutor.parseIntrospectionResult(schema);
    } catch (error: any) {
      logger.error('Schema introspection failed', error);
      throw error;
    }
  }

  /**
   * Validate GraphQL query
   */
  async validateQuery(
    config: GraphQLConfiguration,
    auth: GraphQLAuth | undefined,
    queryString: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    try {
      // Parse query
      const document = parse(queryString);

      // Get schema
      const introspectionResult = await this.introspectSchema(config, auth);
      const { schema } = introspectionResult;

      // Validate query against schema
      const errors = validate(schema, document);

      if (errors.length > 0) {
        return {
          valid: false,
          errors: errors.map((e) => e.message),
        };
      }

      return { valid: true, errors: [] };
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Build query from schema introspection
   */
  static buildQuery(queryName: string, args?: Record<string, any>, fields?: string[]): string {
    const argsString = args
      ? `(${Object.entries(args)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(', ')})`
      : '';

    const fieldsString =
      fields && fields.length > 0
        ? fields.join('\n    ')
        : `
      id
      __typename
    `;

    return `
      query {
        ${queryName}${argsString} {
          ${fieldsString}
        }
      }
    `.trim();
  }

  /**
   * Test connection
   */
  async test(config: GraphQLConfiguration, auth?: GraphQLAuth): Promise<TestConnectionResult> {
    const startTime = Date.now();

    try {
      // Try introspection if enabled
      if (config.introspectionEnabled !== false) {
        await this.introspectSchema(config, auth);
      } else {
        // Simple connectivity test
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...config.headers,
        };

        if (auth) {
          EnhancedGraphQLExecutor.addAuthHeaders(headers, auth);
        }

        // Try a minimal query
        const response = await fetch(config.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            query: '{ __typename }',
          }),
        });

        if (!response.ok) {
          throw new Error(`Connection test failed: ${response.statusText}`);
        }
      }

      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        lastCheck: new Date(),
        responseTime,
        details: {
          endpoint: config.endpoint,
          introspectionEnabled: config.introspectionEnabled !== false,
        },
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        error: error.message,
      };
    }
  }

  /**
   * Validate configuration
   */
  static async validate(config: GraphQLConfiguration): Promise<ValidationResult> {
    const errors: Array<{ field: string; message: string; code: string }> = [];

    if (!config.endpoint) {
      errors.push({
        field: 'endpoint',
        message: 'GraphQL endpoint is required',
        code: 'REQUIRED',
      });
    }

    // Validate URL format
    if (config.endpoint) {
      try {
        // eslint-disable-next-line no-new
        new URL(config.endpoint);
      } catch {
        errors.push({
          field: 'endpoint',
          message: 'Invalid endpoint URL',
          code: 'INVALID_URL',
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Helper: Add authentication headers
   */
  private static addAuthHeaders(headers: Record<string, string>, auth: GraphQLAuth): void {
    switch (auth.type) {
      case 'bearer':
        if (auth.token) {
          headers.Authorization = `Bearer ${auth.token}`;
        }
        break;

      case 'apiKey':
        if (auth.apiKey && auth.apiKeyHeader) {
          headers[auth.apiKeyHeader] = auth.apiKey;
        }
        break;

      case 'basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          headers.Authorization = `Basic ${credentials}`;
        }
        break;

      default:
        break;
    }
  }

  /**
   * Helper: Make request with retry logic using recursive promises
   */
  private async makeRequestWithRetry(
    url: string,
    options: RequestInit,
    maxAttempts: number,
    attempt: number = 1
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error: any) {
      logger.warn(`Request attempt ${attempt} failed`, { error: error.message });

      if (attempt >= maxAttempts) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.makeRequestWithRetry(url, options, maxAttempts, attempt + 1)
            .then(resolve)
            .catch(reject);
        }, delay);
      });
    }
  }

  /**
   * Helper: Calculate query complexity
   */
  private static calculateQueryComplexity(query: string): number {
    try {
      const document = parse(query);
      // Simple complexity: count selections
      return JSON.stringify(document).split('selections').length - 1;
    } catch {
      return 0;
    }
  }

  /**
   * Helper: Parse introspection result into structured format
   */
  private static parseIntrospectionResult(schema: GraphQLSchema): GraphQLIntrospectionResult {
    const typeMap = schema.getTypeMap();
    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    const subscriptionType = schema.getSubscriptionType();

    const types = Object.keys(typeMap).filter((name) => !name.startsWith('__'));

    const queries = queryType
      ? Object.entries(queryType.getFields()).map(([name, field]) => ({
          name,
          type: field.type.toString(),
          args: field.args.map((arg) => ({
            name: arg.name,
            type: arg.type.toString(),
          })),
        }))
      : [];

    const mutations = mutationType
      ? Object.entries(mutationType.getFields()).map(([name, field]) => ({
          name,
          type: field.type.toString(),
          args: field.args.map((arg) => ({
            name: arg.name,
            type: arg.type.toString(),
          })),
        }))
      : [];

    const subscriptions = subscriptionType
      ? Object.entries(subscriptionType.getFields()).map(([name, field]) => ({
          name,
          type: field.type.toString(),
          args: field.args.map((arg) => ({
            name: arg.name,
            type: arg.type.toString(),
          })),
        }))
      : [];

    return {
      schema,
      types,
      queries,
      mutations,
      subscriptions,
    };
  }
}

export const enhancedGraphQLExecutor = new EnhancedGraphQLExecutor();
