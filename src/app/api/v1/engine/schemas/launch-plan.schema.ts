/**
 * Launch Plan Service Schemas
 * 100% accurate schemas based on flyteidl protobuf definitions
 *
 * Based on: src/dsl/gen/pb-js/flyteidl.d.ts
 * - flyteidl.admin.ILaunchPlanCreateRequest
 * - flyteidl.admin.ILaunchPlanSpec
 * - flyteidl.admin.ILaunchPlanMetadata
 * - flyteidl.admin.ILaunchPlanClosure
 */

import { z } from 'zod';

import {
  AuthSchema,
  SortSchema,
  LabelsSchema,
  AuthRoleSchema,
  TimestampSchema,
  IdentifierSchema,
  LiteralMapSchema,
  VariableMapSchema,
  AnnotationsSchema,
  ParameterMapSchema,
  SecurityContextSchema,
  QualityOfServiceSchema,
  RawOutputDataConfigSchema,
  NamedEntityIdentifierSchema,
  WorkflowExecutionPhaseSchema,
} from './common';

// ============================================================================
// Schedule Types (flyteidl.admin)
// ============================================================================

/**
 * flyteidl.admin.IFixedRate
 */
export const FixedRateSchema = z.object({
  value: z.number().int().optional().nullable(),
  unit: z
    .union([
      z.literal(0), // MINUTE
      z.literal(1), // HOUR
      z.literal(2), // DAY
    ])
    .optional()
    .nullable(),
});

/**
 * flyteidl.admin.ICronSchedule
 */
export const CronScheduleSchema = z.object({
  schedule: z.string().optional().nullable(),
  offset: z.string().optional().nullable(),
});

/**
 * flyteidl.admin.ISchedule
 */
export const ScheduleSchema = z.object({
  cronExpression: z.string().optional().nullable(),
  rate: FixedRateSchema.optional().nullable(),
  cronSchedule: CronScheduleSchema.optional().nullable(),
  kickoffTimeInputArg: z.string().optional().nullable(),
});

// ============================================================================
// Notification Types (flyteidl.admin)
// ============================================================================

/**
 * flyteidl.admin.IEmailNotification
 */
export const EmailNotificationSchema = z.object({
  recipientsEmail: z.array(z.string()).optional().nullable(),
});

/**
 * flyteidl.admin.IPagerDutyNotification
 */
export const PagerDutyNotificationSchema = z.object({
  recipientsEmail: z.array(z.string()).optional().nullable(),
});

/**
 * flyteidl.admin.ISlackNotification
 */
export const SlackNotificationSchema = z.object({
  recipientsEmail: z.array(z.string()).optional().nullable(),
});

/**
 * flyteidl.admin.INotification
 */
export const NotificationSchema = z.object({
  phases: z.array(WorkflowExecutionPhaseSchema).optional().nullable(),
  email: EmailNotificationSchema.optional().nullable(),
  pagerDuty: PagerDutyNotificationSchema.optional().nullable(),
  slack: SlackNotificationSchema.optional().nullable(),
});

// ============================================================================
// Launch Plan Metadata (flyteidl.admin.ILaunchPlanMetadata)
// ============================================================================

/**
 * flyteidl.admin.ILaunchPlanMetadata
 */
export const LaunchPlanMetadataSchema = z.object({
  schedule: ScheduleSchema.optional().nullable(),
  notifications: z.array(NotificationSchema).optional().nullable(),
});

// ============================================================================
// Launch Plan State (flyteidl.admin.LaunchPlanState)
// ============================================================================

/**
 * LaunchPlanState enum
 */
export const LaunchPlanStateSchema = z.union([
  z.literal(0), // INACTIVE
  z.literal(1), // ACTIVE
]);

// ============================================================================
// Launch Plan Spec (flyteidl.admin.ILaunchPlanSpec)
// ============================================================================

/**
 * flyteidl.admin.ILaunchPlanSpec
 * Complete launch plan specification
 */
export const LaunchPlanSpecSchema = z.object({
  /** Workflow identifier to execute */
  workflowId: IdentifierSchema.optional().nullable(),

  /** Launch plan metadata (schedule, notifications) */
  entityMetadata: LaunchPlanMetadataSchema.optional().nullable(),

  /** Default input parameters */
  defaultInputs: ParameterMapSchema.optional().nullable(),

  /** Fixed input literals */
  fixedInputs: LiteralMapSchema.optional().nullable(),

  /** IAM role */
  role: z.string().optional().nullable(),

  /** Labels */
  labels: LabelsSchema.optional().nullable(),

  /** Annotations */
  annotations: AnnotationsSchema.optional().nullable(),

  /** Auth configuration */
  auth: AuthSchema.optional().nullable(),

  /** Auth role configuration */
  authRole: AuthRoleSchema.optional().nullable(),

  /** Security context */
  securityContext: SecurityContextSchema.optional().nullable(),

  /** Quality of service */
  qualityOfService: QualityOfServiceSchema.optional().nullable(),

  /** Raw output data configuration */
  rawOutputDataConfig: RawOutputDataConfigSchema.optional().nullable(),

  /** Max parallelism */
  maxParallelism: z.number().int().optional().nullable(),

  /** Interruptible flag */
  interruptible: z.boolean().optional().nullable(),

  /** Overwrite cache flag */
  overwriteCache: z.boolean().optional().nullable(),

  /** Environment variables */
  envs: z.any().optional().nullable(),
});

// ============================================================================
// Launch Plan Closure (flyteidl.admin.ILaunchPlanClosure)
// ============================================================================

/**
 * flyteidl.admin.ILaunchPlanClosure
 */
export const LaunchPlanClosureSchema = z.object({
  /** Launch plan state */
  state: LaunchPlanStateSchema.optional().nullable(),

  /** Expected input parameters */
  expectedInputs: ParameterMapSchema.optional().nullable(),

  /** Expected output variables */
  expectedOutputs: VariableMapSchema.optional().nullable(),

  /** Creation timestamp */
  createdAt: TimestampSchema,

  /** Last update timestamp */
  updatedAt: TimestampSchema,
});

// ============================================================================
// Launch Plan Create Request (flyteidl.admin.ILaunchPlanCreateRequest)
// ============================================================================

/**
 * flyteidl.admin.ILaunchPlanCreateRequest
 * Request to create a new launch plan
 */
export const LaunchPlanCreateRequestSchema = z.object({
  /** Launch plan identifier */
  id: IdentifierSchema.optional().nullable(),

  /** Launch plan specification */
  spec: LaunchPlanSpecSchema.optional().nullable(),
});

// ============================================================================
// Launch Plan Update Request (flyteidl.admin.ILaunchPlanUpdateRequest)
// ============================================================================

/**
 * flyteidl.admin.ILaunchPlanUpdateRequest
 * Request to update launch plan state
 */
export const LaunchPlanUpdateRequestSchema = z.object({
  /** Launch plan identifier */
  id: IdentifierSchema.optional().nullable(),

  /** New state */
  state: LaunchPlanStateSchema.optional().nullable(),
});

// ============================================================================
// Launch Plan List/Query Requests
// ============================================================================

/**
 * flyteidl.admin.IResourceListRequest
 * Request to list launch plans (uses ResourceListRequest with launch plan identifier)
 */
export const LaunchPlanListRequestSchema = z.object({
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
 * Request to get a specific launch plan
 */
export const LaunchPlanGetRequestSchema = z.object({
  /** Launch plan identifier */
  id: IdentifierSchema.optional().nullable(),
});

/**
 * flyteidl.admin.IActiveLaunchPlanRequest
 * Request to get active launch plan for a named entity
 */
export const ActiveLaunchPlanRequestSchema = z.object({
  /** Named entity identifier */
  id: NamedEntityIdentifierSchema.optional().nullable(),
});

/**
 * flyteidl.admin.IActiveLaunchPlanListRequest
 * Request to list all active launch plans
 */
export const ActiveLaunchPlanListRequestSchema = z.object({
  /** Project name */
  project: z.string().optional().nullable(),

  /** Domain name */
  domain: z.string().optional().nullable(),

  /** Maximum number of results */
  limit: z.number().int().optional().nullable(),

  /** Pagination token */
  token: z.string().optional().nullable(),

  /** Sort configuration */
  sortBy: SortSchema.optional().nullable(),
});

// ============================================================================
// Query Parameter Schemas (for API routes)
// ============================================================================

/**
 * Query parameters for listing launch plans
 */
export const LaunchPlanListQuerySchema = z.object({
  project: z.string().min(1).default('aus'),
  domain: z.string().min(1).default('development'),
  name: z.string().optional(),
  version: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  token: z.string().optional(),
  filters: z.string().optional(),
  active: z.enum(['true', 'false']).optional(),
});

/**
 * Query parameters for updating launch plan state
 */
export const LaunchPlanUpdateQuerySchema = z.object({
  project: z.string().min(1),
  domain: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  state: z.enum(['ACTIVE', 'INACTIVE']),
});
