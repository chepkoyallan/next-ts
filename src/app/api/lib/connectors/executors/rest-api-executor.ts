/**
 * REST API Connector Executor
 * Executes REST API connectors with retry logic and authentication
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
  ConnectorTimeoutError,
  RestApiConnectorConfig,
  ConnectorExecutionError,
  ConnectorAuthenticationError,
} from '../types';

export class RestApiExecutor implements ConnectorExecutor {
  /**
   * Execute REST API connector
   */
  // eslint-disable-next-line class-methods-use-this
  async execute(
    config: RestApiConnectorConfig,
    auth: AuthenticationConfig | undefined,
    mapping: DataMapping | undefined,
    query: ConnectorQueryParams,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info('Executing REST API connector', {
        requestId: context.requestId,
        method: config.method,
        endpoint: config.endpoint,
      });

      // Build full URL
      const url = RestApiExecutor.buildUrl(config, query);

      // Build headers
      const headers = RestApiExecutor.buildHeaders(config.headers, auth);

      // Build request body
      const body = RestApiExecutor.buildBody(config, query);

      // Execute request with retry logic
      const response = await RestApiExecutor.executeWithRetry({
        url,
        method: config.method,
        headers,
        body,
        timeout: config.timeout || 30000,
        retryAttempts: config.retryAttempts || 3,
        retryDelay: config.retryDelay || 1000,
      });

      // Parse response
      const rawData = await response.json();

      // Extract data from response using mapping
      let data = extractDataFromResponse(rawData, mapping?.rootPath);

      // Ensure data is an array
      if (!Array.isArray(data)) {
        data = [data];
      }

      // Apply field mapping
      if (mapping) {
        data = applyDataMapping(data, mapping);
      }

      // Apply client-side filtering (if not handled by API)
      if (query.search && mapping?.searchFields) {
        data = RestApiExecutor.filterBySearch(data, query.search, mapping.searchFields);
      }

      // Apply client-side sorting (if not handled by API)
      if (query.sort) {
        data = RestApiExecutor.sortData(data, query.sort.field, query.sort.direction);
      }

      // Apply client-side pagination (if not handled by API)
      let paginatedData = data;
      let hasMore = false;

      if (query.pagination) {
        const start = query.pagination.page * query.pagination.pageSize;
        const end = start + query.pagination.pageSize;
        hasMore = end < data.length;
        paginatedData = data.slice(start, end);
      }

      const executionTime = Date.now() - startTime;

      logger.info('REST API execution successful', {
        requestId: context.requestId,
        recordCount: paginatedData.length,
        executionTime,
      });

      return {
        success: true,
        data: paginatedData,
        totalCount: data.length,
        hasMore,
        executionTime,
        debug: {
          query: url,
          params: query,
          rawResponse: process.env.NODE_ENV === 'development' ? rawData : undefined,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error('REST API execution failed', error, {
        requestId: context.requestId,
        executionTime,
      });

      return {
        success: false,
        data: [],
        executionTime,
        error: error.message || 'REST API execution failed',
      };
    }
  }

  /**
   * Test REST API connector
   */
  // eslint-disable-next-line class-methods-use-this
  async test(
    config: RestApiConnectorConfig,
    auth: AuthenticationConfig | undefined
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const url = `${config.baseUrl}${config.endpoint}`;
      const headers = RestApiExecutor.buildHeaders(config.headers, auth);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout || 10000);

      const response = await fetch(url, {
        method: config.method === 'GET' ? 'HEAD' : config.method,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: {
            statusCode: response.status,
            statusText: response.statusText,
          },
        };
      }

      return {
        status: 'healthy',
        lastCheck: new Date(),
        responseTime,
        details: {
          statusCode: response.status,
          statusText: response.statusText,
        },
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        error: error.message || 'Connection test failed',
        details: {
          errorType: error.name,
        },
      };
    }
  }

  /**
   * Validate REST API configuration
   */
  // eslint-disable-next-line class-methods-use-this
  async validate(config: RestApiConnectorConfig): Promise<ValidationResult> {
    const errors: any[] = [];

    if (!config.baseUrl) {
      errors.push({
        field: 'baseUrl',
        message: 'Base URL is required',
        code: 'REQUIRED_FIELD',
      });
    } else {
      try {
        // Validate URL format - constructor throws on invalid URL
        const url = new URL(config.baseUrl);
        // URL is valid if we reach here
        if (!url.protocol) {
          throw new Error('Invalid URL');
        }
      } catch {
        errors.push({
          field: 'baseUrl',
          message: 'Invalid URL format',
          code: 'INVALID_URL',
        });
      }
    }

    if (!config.method) {
      errors.push({
        field: 'method',
        message: 'HTTP method is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!config.endpoint) {
      errors.push({
        field: 'endpoint',
        message: 'Endpoint is required',
        code: 'REQUIRED_FIELD',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build full URL with query parameters
   */
  private static buildUrl(config: RestApiConnectorConfig, query: ConnectorQueryParams): string {
    let url = `${config.baseUrl}${config.endpoint}`;

    // Build query params
    const params = new URLSearchParams();

    // Add configured query params
    if (config.queryParams) {
      Object.entries(config.queryParams).forEach(([key, value]) => {
        params.append(key, String(value));
      });
    }

    // Add search param
    if (query.search) {
      params.append('search', query.search);
    }

    // Add filter params
    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    // Add sort params
    if (query.sort) {
      params.append('sort', query.sort.field);
      params.append('order', query.sort.direction);
    }

    // Add pagination params
    if (query.pagination) {
      params.append('page', String(query.pagination.page));
      params.append('limit', String(query.pagination.pageSize));
    }

    // Add custom params
    if (query.customParams) {
      Object.entries(query.customParams).forEach(([key, value]) => {
        params.append(key, String(value));
      });
    }

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    return url;
  }

  /**
   * Build request headers with authentication
   */
  private static buildHeaders(
    baseHeaders: Record<string, string> = {},
    auth?: AuthenticationConfig
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...baseHeaders,
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
          const headerName = auth.headerName || 'X-API-Key';
          headers[headerName] = auth.key;
        }
        break;

      case 'basic': {
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers.Authorization = `Basic ${credentials}`;
        break;
      }

      case 'oauth2':
        if (auth.accessToken) {
          headers.Authorization = `Bearer ${auth.accessToken}`;
        }
        break;

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

  /**
   * Build request body
   */
  private static buildBody(
    config: RestApiConnectorConfig,
    query: ConnectorQueryParams
  ): string | undefined {
    if (config.method === 'GET' || config.method === 'DELETE') {
      return undefined;
    }

    if (config.body) {
      // Merge configured body with query params
      const body = {
        ...config.body,
        ...query.filters,
        ...query.customParams,
      };

      return JSON.stringify(body);
    }

    return undefined;
  }

  /**
   * Execute request with retry logic
   */
  private static async executeWithRetry(options: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  }): Promise<Response> {
    return RestApiExecutor.attemptRequest(options, 0);
  }

  /**
   * Attempt a single request with retry logic (recursive)
   */
  private static async attemptRequest(
    options: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
      timeout: number;
      retryAttempts: number;
      retryDelay: number;
    },
    attempt: number
  ): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout);

      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if response is successful
      if (!response.ok) {
        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new ConnectorAuthenticationError(
            `HTTP ${response.status}: ${response.statusText}`,
            'rest-api'
          );
        }

        // Retry on server errors (5xx)
        if (attempt < options.retryAttempts) {
          logger.warn('Request failed, retrying', {
            attempt: attempt + 1,
            statusCode: response.status,
          });
          await RestApiExecutor.sleep(options.retryDelay * 2 ** attempt);
          return await RestApiExecutor.attemptRequest(options, attempt + 1);
        }

        throw new ConnectorExecutionError(
          `HTTP ${response.status}: ${response.statusText}`,
          'rest-api'
        );
      }

      return response;
    } catch (error: any) {
      // Don't retry on abort errors
      if (error.name === 'AbortError') {
        throw new ConnectorTimeoutError('Request timeout', 'rest-api', options.timeout);
      }

      // Don't retry on authentication errors
      if (error instanceof ConnectorAuthenticationError) {
        throw error;
      }

      // Retry on network errors
      if (attempt < options.retryAttempts) {
        logger.warn('Request failed, retrying', {
          attempt: attempt + 1,
          error: error.message,
        });
        await RestApiExecutor.sleep(options.retryDelay * 2 ** attempt);
        return RestApiExecutor.attemptRequest(options, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Filter data by search term
   */
  private static filterBySearch(data: any[], searchTerm: string, searchFields: string[]): any[] {
    const search = searchTerm.toLowerCase();

    return data.filter((item) =>
      searchFields.some((field) => {
        const value = RestApiExecutor.getNestedValue(item, field);
        return value?.toString().toLowerCase().includes(search);
      })
    );
  }

  /**
   * Sort data by field
   */
  private static sortData(data: any[], field: string, direction: 'asc' | 'desc'): any[] {
    return [...data].sort((a, b) => {
      const aVal = RestApiExecutor.getNestedValue(a, field);
      const bVal = RestApiExecutor.getNestedValue(b, field);

      if (aVal === bVal) return 0;

      const comparison = aVal < bVal ? -1 : 1;
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Get nested value from object
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Sleep helper
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
