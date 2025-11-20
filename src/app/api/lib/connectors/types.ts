/**
 * Connector System Types and Interfaces
 * Comprehensive type definitions for the connector architecture
 */

import { JSONSchema7 } from 'json-schema';

// ============================================================================
// CORE CONNECTOR TYPES
// ============================================================================

export type ConnectorType =
  | 'rest_api'
  | 'database'
  | 'cloud_storage'
  | 'flyte_workflow'
  | 'graphql'
  | 'webhook'
  | 'custom';

export type ConnectorStatus = 'active' | 'inactive' | 'error' | 'testing';

export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown' | 'degraded';

export type AuthenticationType = 'none' | 'bearer' | 'api_key' | 'basic' | 'oauth2' | 'custom';

export type DatabaseType = 'postgresql' | 'mysql' | 'mongodb' | 'redis' | 'sqlite';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// ============================================================================
// FIELD MAPPING
// ============================================================================

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: (value: any) => any;
  transformExpression?: string; // e.g., "uppercase", "lowercase", "trim"
}

export interface DataMapping {
  mappings: FieldMapping[];
  rootPath?: string; // JSONPath to extract data from response (e.g., "$.data.items")
  valueField: string; // Which field to use as the value
  displayField: string; // Which field to display to users
  searchFields?: string[]; // Fields to search in
  filterFields?: string[]; // Fields that can be filtered
}

// ============================================================================
// AUTHENTICATION CONFIGURATIONS
// ============================================================================

export interface BearerAuthConfig {
  type: 'bearer';
  token: string;
}

export interface ApiKeyAuthConfig {
  type: 'api_key';
  key: string;
  headerName?: string; // Default: 'X-API-Key'
  location?: 'header' | 'query'; // Where to send the API key
  paramName?: string; // For query parameter
}

export interface BasicAuthConfig {
  type: 'basic';
  username: string;
  password: string;
}

export interface OAuth2Config {
  type: 'oauth2';
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface CustomAuthConfig {
  type: 'custom';
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
}

export type AuthenticationConfig =
  | BearerAuthConfig
  | ApiKeyAuthConfig
  | BasicAuthConfig
  | OAuth2Config
  | CustomAuthConfig
  | { type: 'none' };

// ============================================================================
// CONNECTOR CONFIGURATIONS
// ============================================================================

export interface RestApiConnectorConfig {
  type: 'rest_api';
  baseUrl: string;
  method: HttpMethod;
  endpoint: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: any;
  timeout?: number; // milliseconds
  retryAttempts?: number;
  retryDelay?: number; // milliseconds
}

export interface DatabaseConnectorConfig {
  type: 'database';
  databaseType: DatabaseType;
  connectionString?: string; // For external databases
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  query: string; // SQL or NoSQL query
  parameterized?: boolean; // Use parameterized queries
}

export interface FlyteWorkflowConnectorConfig {
  type: 'flyte_workflow';
  project: string;
  domain: string;
  workflowName: string;
  version: string;
  launchPlanName?: string;
  timeout?: number; // milliseconds
  waitForCompletion?: boolean; // true = synchronous, false = async
  pollInterval?: number; // milliseconds
  inputMapping?: FieldMapping[]; // Map connector params to workflow inputs
  outputPath?: string; // JSONPath to extract data from workflow outputs
}

export interface GraphQLConnectorConfig {
  type: 'graphql';
  endpoint: string;
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
  timeout?: number;
}

export interface CloudStorageConnectorConfig {
  type: 'cloud_storage';
  provider: 'aws_s3' | 'gcs' | 'azure_blob';
  bucket: string;
  prefix?: string;
  region?: string;
}

export interface WebhookConnectorConfig {
  type: 'webhook';
  url: string;
  secret?: string; // For signature verification
  events?: string[];
}

export interface CustomConnectorConfig {
  type: 'custom';
  code: string; // JavaScript/TypeScript code to execute
  timeout?: number;
}

export type ConnectorConfiguration =
  | RestApiConnectorConfig
  | DatabaseConnectorConfig
  | FlyteWorkflowConnectorConfig
  | GraphQLConnectorConfig
  | CloudStorageConnectorConfig
  | WebhookConnectorConfig
  | CustomConnectorConfig;

// ============================================================================
// CACHING & RATE LIMITING
// ============================================================================

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  key?: string; // Custom cache key pattern
  invalidateOn?: string[]; // Events that invalidate cache
  strategy?: 'lru' | 'fifo' | 'ttl';
}

export interface RateLimitConfig {
  enabled: boolean;
  maxRequests: number; // Max requests per window
  windowMs: number; // Time window in milliseconds
  strategy?: 'sliding' | 'fixed';
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // Check interval in seconds
  timeout: number; // Timeout for health check
  retries?: number;
  alertOnFailure?: boolean;
}

export interface HealthCheckResult {
  status: HealthStatus;
  lastCheck: Date;
  responseTime?: number; // milliseconds
  error?: string;
  details?: any;
}

// ============================================================================
// CONNECTOR MODEL
// ============================================================================

export interface ConnectorModel {
  id: string;
  name: string;
  description?: string;
  organizationId: string;

  // Configuration
  type: ConnectorType;
  configuration: ConnectorConfiguration;
  authentication?: AuthenticationConfig; // Encrypted in DB
  dataMapping?: DataMapping;

  // Schema
  schema?: JSONSchema7; // Expected output schema

  // Behavior
  caching?: CacheConfig;
  rateLimit?: RateLimitConfig;
  healthCheck?: HealthCheckConfig;

  // Status
  status: ConnectorStatus;
  lastHealthCheck?: Date;
  healthStatus?: HealthStatus;

  // Metadata
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[]; // Tags for automatic field matching (e.g., ["customers", "crm", "salesforce"])
  category?: string; // Category for organization (e.g., "crm", "database", "api")

  // Statistics
  totalExecutions?: number;
  successfulExecutions?: number;
  failedExecutions?: number;
  averageResponseTime?: number;
}

// ============================================================================
// EXECUTION
// ============================================================================

export interface ConnectorQueryParams {
  // Search & Filtering
  search?: string;
  filters?: Record<string, any>;

  // Sorting
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };

  // Pagination
  pagination?: {
    page: number;
    pageSize: number;
    offset?: number;
  };

  // Custom parameters (connector-specific)
  customParams?: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  data: any[];
  totalCount?: number;
  hasMore?: boolean;
  nextCursor?: string;

  // Metadata
  executionTime: number; // milliseconds
  cached?: boolean;
  error?: string;

  // Debug info
  debug?: {
    query?: string;
    params?: any;
    rawResponse?: any;
  };
}

export interface ExecutionContext {
  userId: string;
  organizationId: string;
  requestId: string;
  timestamp: Date;
}

// ============================================================================
// CONNECTOR EXECUTOR INTERFACE
// ============================================================================

export interface ConnectorExecutor {
  /**
   * Execute the connector with given query parameters
   */
  execute(
    config: ConnectorConfiguration,
    auth: AuthenticationConfig | undefined,
    mapping: DataMapping | undefined,
    query: ConnectorQueryParams,
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  /**
   * Test the connector connection
   */
  test(
    config: ConnectorConfiguration,
    auth: AuthenticationConfig | undefined
  ): Promise<HealthCheckResult>;

  /**
   * Validate the connector configuration
   */
  validate(config: ConnectorConfiguration): Promise<ValidationResult>;
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: string[];
}

// ============================================================================
// TEST RESULT
// ============================================================================

export interface TestConnectionResult extends HealthCheckResult {
  sampleData?: any[];
  connectionString?: string; // Sanitized connection string
  metadata?: {
    version?: string;
    capabilities?: string[];
  };
}

// ============================================================================
// CONNECTOR SERVICE INTERFACE
// ============================================================================

export interface IConnectorService {
  // CRUD Operations
  createConnector(
    connector: Omit<ConnectorModel, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ConnectorModel>;
  getConnector(id: string, organizationId: string): Promise<ConnectorModel | null>;
  listConnectors(organizationId: string, filters?: any): Promise<ConnectorModel[]>;
  updateConnector(
    id: string,
    organizationId: string,
    updates: Partial<ConnectorModel>
  ): Promise<ConnectorModel>;
  deleteConnector(id: string, organizationId: string): Promise<boolean>;

  // Execution
  executeConnector(
    id: string,
    query: ConnectorQueryParams,
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  // Testing & Health
  testConnection(id: string, organizationId: string): Promise<TestConnectionResult>;
  checkHealth(id: string): Promise<HealthCheckResult>;

  // Utilities
  validateConfiguration(
    type: ConnectorType,
    config: ConnectorConfiguration
  ): Promise<ValidationResult>;
  getExecutionStats(id: string): Promise<any>;
}

// ============================================================================
// CACHE SERVICE INTERFACE
// ============================================================================

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  has(key: string): Promise<boolean>;
}

// ============================================================================
// CREDENTIAL VAULT INTERFACE
// ============================================================================

export interface ICredentialVault {
  store(connectorId: string, credentials: AuthenticationConfig): Promise<void>;
  retrieve(connectorId: string): Promise<AuthenticationConfig | null>;
  update(connectorId: string, credentials: AuthenticationConfig): Promise<void>;
  delete(connectorId: string): Promise<void>;
  encrypt(data: string): string;
  decrypt(encrypted: string): string;
}

// ============================================================================
// RATE LIMITER INTERFACE
// ============================================================================

export interface IRateLimiter {
  checkLimit(connectorId: string, config: RateLimitConfig): Promise<boolean>;
  recordRequest(connectorId: string): Promise<void>;
  getRemainingQuota(connectorId: string, config: RateLimitConfig): Promise<number>;
  resetLimit(connectorId: string): Promise<void>;
}

// ============================================================================
// HEALTH MONITOR INTERFACE
// ============================================================================

export interface IHealthMonitor {
  checkHealth(
    connectorId: string,
    config: ConnectorConfiguration,
    auth?: AuthenticationConfig
  ): Promise<HealthCheckResult>;
  scheduleHealthCheck(connectorId: string, interval: number): void;
  cancelHealthCheck(connectorId: string): void;
  getHealthHistory(connectorId: string, limit?: number): Promise<HealthCheckResult[]>;
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export interface ConnectorAuditLog {
  id: string;
  connectorId: string;
  action: 'created' | 'updated' | 'deleted' | 'executed' | 'tested' | 'health_check';
  userId: string;
  organizationId: string;
  timestamp: Date;

  // Execution details
  queryParams?: ConnectorQueryParams;
  result?: {
    success: boolean;
    executionTime: number;
    recordCount?: number;
    error?: string;
  };

  // Change tracking
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];

  metadata?: any;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export {
  ConnectorError,
  ConnectorTimeoutError,
  ConnectorExecutionError,
  ConnectorRateLimitError,
  ConnectorValidationError,
  ConnectorAuthenticationError,
} from './connector-errors';
