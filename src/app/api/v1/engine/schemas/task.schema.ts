/**
 * Task Service Schemas
 * 100% accurate schemas based on flyteidl protobuf definitions
 *
 * Based on: src/dsl/gen/pb-js/flyteidl.d.ts
 * - flyteidl.admin.ITaskCreateRequest
 * - flyteidl.admin.ITaskSpec
 * - flyteidl.core.ITaskTemplate
 * - flyteidl.core.ITaskMetadata
 */

import { z } from 'zod';

import {
  SqlSchema,
  SortSchema,
  StructSchema,
  K8sPodSchema,
  DurationSchema,
  ContainerSchema,
  IdentifierSchema,
  RetryStrategySchema,
  TypedInterfaceSchema,
  RuntimeMetadataSchema,
  SecurityContextSchema,
  NamedEntityIdentifierSchema,
} from './common';

// ============================================================================
// Task Metadata (flyteidl.core.ITaskMetadata)
// ============================================================================

/**
 * flyteidl.core.ITaskMetadata
 * Complete task metadata structure
 */
export const TaskMetadataSchema = z.object({
  /** Whether this task is discoverable */
  discoverable: z.boolean().optional().nullable(),

  /** Runtime metadata */
  runtime: RuntimeMetadataSchema.optional().nullable(),

  /** Timeout duration */
  timeout: DurationSchema,

  /** Retry strategy */
  retries: RetryStrategySchema.optional().nullable(),

  /** Discovery version for memoization */
  discoveryVersion: z.string().optional().nullable(),

  /** Deprecated error message */
  deprecatedErrorMessage: z.string().optional().nullable(),

  /** Whether task is interruptible */
  interruptible: z.boolean().optional().nullable(),

  /** Whether task output is serializable for caching */
  cacheSerializable: z.boolean().optional().nullable(),

  /** Whether task generates a deck */
  generatesDeck: z.boolean().optional().nullable(),

  /** Task tags */
  tags: z.record(z.string(), z.string()).optional().nullable(),

  /** Cache ignore input variables */
  cacheIgnoreInputVars: z.array(z.string()).optional().nullable(),
});

// ============================================================================
// Task Template (flyteidl.core.ITaskTemplate)
// ============================================================================

/**
 * flyteidl.core.ITaskTemplate
 * Complete task template structure
 */
export const TaskTemplateSchema = z.object({
  /** Task identifier */
  id: IdentifierSchema.optional().nullable(),

  /** Task type (e.g., 'python-task', 'container', 'sidecar') */
  type: z.string().optional().nullable(),

  /** Task metadata */
  metadata: TaskMetadataSchema.optional().nullable(),

  /** Task interface (inputs/outputs) */
  interface: TypedInterfaceSchema.optional().nullable(),

  /** Custom plugin-specific data */
  custom: StructSchema,

  /** Container configuration */
  container: ContainerSchema.optional().nullable(),

  /** Kubernetes pod configuration */
  k8sPod: K8sPodSchema.optional().nullable(),

  /** SQL query configuration */
  sql: SqlSchema.optional().nullable(),

  /** Task type version */
  taskTypeVersion: z.number().int().optional().nullable(),

  /** Security context */
  securityContext: SecurityContextSchema.optional().nullable(),

  /** Extended resources config */
  config: z.record(z.string(), z.string()).optional().nullable(),
});

// ============================================================================
// Task Spec (flyteidl.admin.ITaskSpec)
// ============================================================================

/**
 * flyteidl.admin.ITaskSpec
 * Task specification
 */
export const TaskSpecSchema = z.object({
  /** Task template */
  template: TaskTemplateSchema.optional().nullable(),

  /** Task description */
  description: z.string().optional().nullable(),
});

// ============================================================================
// Task Create Request (flyteidl.admin.ITaskCreateRequest)
// ============================================================================

/**
 * flyteidl.admin.ITaskCreateRequest
 * Request to create a new task
 */
export const TaskCreateRequestSchema = z.object({
  /** Task identifier */
  id: IdentifierSchema.optional().nullable(),

  /** Task specification */
  spec: TaskSpecSchema.optional().nullable(),
});

// ============================================================================
// Task List/Query Requests
// ============================================================================

/**
 * flyteidl.admin.IResourceListRequest
 * Request to list tasks (uses ResourceListRequest with task identifier)
 */
export const TaskListRequestSchema = z.object({
  /** Named entity identifier (project, domain, name) */
  id: NamedEntityIdentifierSchema.optional().nullable(),

  /** Maximum number of results to return */
  limit: z.number().int().optional().nullable(),

  /** Pagination token */
  token: z.string().optional().nullable(),

  /** Filter string */
  filters: z.string().optional().nullable(),

  /** Sort configuration */
  sortBy: SortSchema.optional().nullable(),
});

/**
 * flyteidl.admin.IObjectGetRequest
 * Request to get a specific task
 */
export const TaskGetRequestSchema = z.object({
  /** Task identifier */
  id: IdentifierSchema.optional().nullable(),
});

// ============================================================================
// Query Parameter Schemas (for API routes)
// ============================================================================

/**
 * Query parameters for listing tasks
 */
export const TaskListQuerySchema = z.object({
  project: z.string().min(1).default('aus'),
  domain: z.string().min(1).default('development'),
  name: z.string().optional(),
  version: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  token: z.string().optional(),
  filters: z.string().optional(),
});
