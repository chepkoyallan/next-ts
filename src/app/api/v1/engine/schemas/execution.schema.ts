/**
 * Execution Service Schemas
 * 100% accurate schemas based on flyteidl protobuf definitions
 *
 * Based on: src/dsl/gen/pb-js/flyteidl.d.ts
 * - flyteidl.admin.IExecutionCreateRequest
 * - flyteidl.admin.IExecutionSpec
 * - flyteidl.admin.IExecutionMetadata
 * - flyteidl.admin.IExecutionClosure
 */

import { z } from 'zod';

import { NotificationSchema } from './launch-plan.schema';
import {
  SortSchema,
  LabelsSchema,
  AuthRoleSchema,
  DurationSchema,
  TimestampSchema,
  IdentifierSchema,
  LiteralMapSchema,
  AnnotationsSchema,
  SecurityContextSchema,
  QualityOfServiceSchema,
  RawOutputDataConfigSchema,
  WorkflowExecutionPhaseSchema,
  NodeExecutionIdentifierSchema,
  WorkflowExecutionIdentifierSchema,
} from './common';

// ============================================================================
// Execution Metadata (flyteidl.admin)
// ============================================================================

/**
 * ExecutionMode enum
 */
export const ExecutionModeSchema = z.union([
  z.literal(0), // MANUAL
  z.literal(1), // SCHEDULED
  z.literal(2), // SYSTEM
]);

/**
 * flyteidl.admin.ISystemMetadata
 */
export const SystemMetadataSchema = z.object({
  executionCluster: z.string().optional().nullable(),
});

/**
 * flyteidl.admin.IExecutionMetadata
 */
export const ExecutionMetadataSchema = z.object({
  /** Execution mode (manual, scheduled, system) */
  mode: ExecutionModeSchema.optional().nullable(),

  /** Principal who triggered the execution */
  principal: z.string().optional().nullable(),

  /** Nesting level (0 for top-level) */
  nesting: z.number().int().optional().nullable(),

  /** Scheduled execution time */
  scheduledAt: TimestampSchema,

  /** Parent node execution (for nested executions) */
  parentNodeExecution: NodeExecutionIdentifierSchema.optional().nullable(),

  /** Reference execution */
  referenceExecution: WorkflowExecutionIdentifierSchema.optional().nullable(),

  /** System metadata */
  systemMetadata: SystemMetadataSchema.optional().nullable(),
});

// ============================================================================
// Cluster Assignment (flyteidl.admin)
// ============================================================================

/**
 * flyteidl.admin.IClusterAssignment
 */
export const ClusterAssignmentSchema = z.object({
  clusterPoolName: z.string().optional().nullable(),
});

// ============================================================================
// Notification List (flyteidl.admin)
// ============================================================================

/**
 * flyteidl.admin.INotificationList
 */
export const NotificationListSchema = z.object({
  notifications: z.array(NotificationSchema).optional().nullable(),
});

// ============================================================================
// BoolValue (google.protobuf)
// ============================================================================

/**
 * google.protobuf.IBoolValue
 */
export const BoolValueSchema = z.object({
  value: z.boolean().optional().nullable(),
});

// ============================================================================
// Execution Spec (flyteidl.admin.IExecutionSpec)
// ============================================================================

/**
 * flyteidl.admin.IExecutionSpec
 * Complete execution specification
 */
export const ExecutionSpecSchema = z.object({
  /** Launch plan to execute */
  launchPlan: IdentifierSchema.optional().nullable(),

  /** Input literals */
  inputs: LiteralMapSchema.optional().nullable(),

  /** Execution metadata */
  metadata: ExecutionMetadataSchema.optional().nullable(),

  /** Notifications */
  notifications: NotificationListSchema.optional().nullable(),

  /** Disable all notifications */
  disableAll: z.boolean().optional().nullable(),

  /** Labels */
  labels: LabelsSchema.optional().nullable(),

  /** Annotations */
  annotations: AnnotationsSchema.optional().nullable(),

  /** Security context */
  securityContext: SecurityContextSchema.optional().nullable(),

  /** Auth role */
  authRole: AuthRoleSchema.optional().nullable(),

  /** Quality of service */
  qualityOfService: QualityOfServiceSchema.optional().nullable(),

  /** Max parallelism */
  maxParallelism: z.number().int().optional().nullable(),

  /** Raw output data config */
  rawOutputDataConfig: RawOutputDataConfigSchema.optional().nullable(),

  /** Cluster assignment */
  clusterAssignment: ClusterAssignmentSchema.optional().nullable(),

  /** Interruptible flag */
  interruptible: BoolValueSchema.optional().nullable(),

  /** Overwrite cache flag */
  overwriteCache: z.boolean().optional().nullable(),
});

// ============================================================================
// Execution Closure (flyteidl.admin.IExecutionClosure)
// ============================================================================

/**
 * flyteidl.core.IExecutionError
 */
export const ExecutionErrorSchema = z.object({
  code: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  errorUri: z.string().optional().nullable(),
  kind: z
    .union([
      z.literal(0), // UNKNOWN
      z.literal(1), // USER
      z.literal(2), // SYSTEM
    ])
    .optional()
    .nullable(),
});

/**
 * flyteidl.admin.IAbortMetadata
 */
export const AbortMetadataSchema = z.object({
  cause: z.string().optional().nullable(),
  principal: z.string().optional().nullable(),
});

/**
 * ExecutionState enum
 */
export const ExecutionStateSchema = z.union([
  z.literal(0), // EXECUTION_ACTIVE
  z.literal(1), // EXECUTION_ARCHIVED
]);

/**
 * flyteidl.admin.IExecutionStateChangeDetails
 */
export const ExecutionStateChangeDetailsSchema = z.object({
  state: ExecutionStateSchema.optional().nullable(),
  occurredAt: TimestampSchema,
  principal: z.string().optional().nullable(),
});

/**
 * flyteidl.admin.ILiteralMapBlob
 */
export const LiteralMapBlobSchema = z.object({
  values: LiteralMapSchema.optional().nullable(),
  uri: z.string().optional().nullable(),
});

/**
 * flyteidl.admin.IExecutionClosure
 */
export const ExecutionClosureSchema = z.object({
  /** Outputs (as blob with URI or inline) */
  outputs: LiteralMapBlobSchema.optional().nullable(),

  /** Execution error */
  error: ExecutionErrorSchema.optional().nullable(),

  /** Abort cause */
  abortCause: z.string().optional().nullable(),

  /** Abort metadata */
  abortMetadata: AbortMetadataSchema.optional().nullable(),

  /** Output data (inline) */
  outputData: LiteralMapSchema.optional().nullable(),

  /** Computed inputs */
  computedInputs: LiteralMapSchema.optional().nullable(),

  /** Execution phase */
  phase: WorkflowExecutionPhaseSchema.optional().nullable(),

  /** Start time */
  startedAt: TimestampSchema,

  /** Duration */
  duration: DurationSchema,

  /** Creation time */
  createdAt: TimestampSchema,

  /** Last update time */
  updatedAt: TimestampSchema,

  /** Notifications */
  notifications: z.array(NotificationSchema).optional().nullable(),

  /** Workflow identifier */
  workflowId: IdentifierSchema.optional().nullable(),

  /** State change details */
  stateChangeDetails: ExecutionStateChangeDetailsSchema.optional().nullable(),
});

// ============================================================================
// Execution Create Request (flyteidl.admin.IExecutionCreateRequest)
// ============================================================================

/**
 * flyteidl.admin.IExecutionCreateRequest
 * Request to create a new execution
 */
export const ExecutionCreateRequestSchema = z.object({
  /** Project name */
  project: z.string().optional().nullable(),

  /** Domain name */
  domain: z.string().optional().nullable(),

  /** Execution name (optional, auto-generated if not provided) */
  name: z.string().optional().nullable(),

  /** Execution specification */
  spec: ExecutionSpecSchema.optional().nullable(),

  /** Input literals (alternative to spec.inputs) */
  inputs: LiteralMapSchema.optional().nullable(),
});

// ============================================================================
// Execution Relaunch Request (flyteidl.admin.IExecutionRelaunchRequest)
// ============================================================================

/**
 * flyteidl.admin.IExecutionRelaunchRequest
 * Request to relaunch an existing execution
 */
export const ExecutionRelaunchRequestSchema = z.object({
  /** Execution to relaunch */
  id: WorkflowExecutionIdentifierSchema.optional().nullable(),

  /** New execution name */
  name: z.string().optional().nullable(),

  /** Override launch plan */
  overwriteLaunchPlan: IdentifierSchema.optional().nullable(),
});

// ============================================================================
// Execution Recover Request (flyteidl.admin.IExecutionRecoverRequest)
// ============================================================================

/**
 * flyteidl.admin.IExecutionRecoverRequest
 * Request to recover a failed execution
 */
export const ExecutionRecoverRequestSchema = z.object({
  /** Execution to recover */
  id: WorkflowExecutionIdentifierSchema.optional().nullable(),

  /** New execution name */
  name: z.string().optional().nullable(),

  /** Execution metadata override */
  metadata: ExecutionMetadataSchema.optional().nullable(),
});

// ============================================================================
// Execution Terminate Request (flyteidl.admin.IExecutionTerminateRequest)
// ============================================================================

/**
 * flyteidl.admin.IExecutionTerminateRequest
 * Request to terminate a running execution
 */
export const ExecutionTerminateRequestSchema = z.object({
  /** Execution to terminate */
  id: WorkflowExecutionIdentifierSchema.optional().nullable(),

  /** Termination cause */
  cause: z.string().optional().nullable(),
});

// ============================================================================
// Execution List/Query Requests
// ============================================================================

/**
 * flyteidl.admin.IResourceListRequest
 * Request to list executions
 */
export const ExecutionListRequestSchema = z.object({
  /** Project name */
  project: z.string().optional().nullable(),

  /** Domain name */
  domain: z.string().optional().nullable(),

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
 * flyteidl.admin.IWorkflowExecutionGetRequest
 * Request to get a specific execution
 */
export const ExecutionGetRequestSchema = z.object({
  /** Execution identifier */
  id: WorkflowExecutionIdentifierSchema.optional().nullable(),
});

// ============================================================================
// Query Parameter Schemas (for API routes)
// ============================================================================

/**
 * Query parameters for listing executions
 */
export const ExecutionListQuerySchema = z.object({
  project: z.string().min(1).default('aus'),
  domain: z.string().min(1).default('development'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  token: z.string().optional(),
  filters: z.string().optional(),
  summary: z.enum(['true', 'false']).optional(),
});

/**
 * Query parameters for getting execution
 */
export const ExecutionGetQuerySchema = z.object({
  project: z.string().min(1),
  domain: z.string().min(1),
  name: z.string().min(1),
});
