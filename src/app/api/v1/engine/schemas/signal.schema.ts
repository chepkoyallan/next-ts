/**
 * Signal Service Schemas
 * 100% accurate schemas based on flyteidl protobuf definitions
 *
 * Based on: src/dsl/gen/pb-js/flyteidl.d.ts
 * - flyteidl.admin.ISignalGetOrCreateRequest
 * - flyteidl.admin.ISignalSetRequest
 * - flyteidl.admin.ISignalListRequest
 * - flyteidl.core.ISignalIdentifier
 */

import { z } from 'zod';

import {
  SortSchema,
  LiteralSchema,
  LiteralTypeSchema,
  WorkflowExecutionIdentifierSchema,
} from './common';

// ============================================================================
// Signal Identifier (flyteidl.core.ISignalIdentifier)
// ============================================================================

/**
 * flyteidl.core.ISignalIdentifier
 */
export const SignalIdentifierSchema = z.object({
  /** Signal ID */
  signalId: z.string().optional().nullable(),

  /** Execution ID this signal belongs to */
  executionId: WorkflowExecutionIdentifierSchema.optional().nullable(),
});

// ============================================================================
// Signal (flyteidl.admin.ISignal)
// ============================================================================

/**
 * flyteidl.admin.ISignal
 * Complete signal structure
 */
export const SignalSchema = z.object({
  /** Signal identifier */
  id: SignalIdentifierSchema.optional().nullable(),

  /** Signal type */
  type: LiteralTypeSchema.optional().nullable(),

  /** Signal value */
  value: LiteralSchema.optional().nullable(),
});

// ============================================================================
// Signal Get Or Create Request (flyteidl.admin.ISignalGetOrCreateRequest)
// ============================================================================

/**
 * flyteidl.admin.ISignalGetOrCreateRequest
 * Request to get an existing signal or create it if it doesn't exist
 */
export const SignalGetOrCreateRequestSchema = z.object({
  /** Signal identifier */
  id: SignalIdentifierSchema.optional().nullable(),

  /** Signal type (required for creation) */
  type: LiteralTypeSchema.optional().nullable(),
});

// ============================================================================
// Signal Set Request (flyteidl.admin.ISignalSetRequest)
// ============================================================================

/**
 * flyteidl.admin.ISignalSetRequest
 * Request to set a signal value
 */
export const SignalSetRequestSchema = z.object({
  /** Signal identifier */
  id: SignalIdentifierSchema.optional().nullable(),

  /** Signal value */
  value: LiteralSchema.optional().nullable(),
});

// ============================================================================
// Signal List Request (flyteidl.admin.ISignalListRequest)
// ============================================================================

/**
 * flyteidl.admin.ISignalListRequest
 * Request to list signals for a workflow execution
 */
export const SignalListRequestSchema = z.object({
  /** Workflow execution identifier */
  workflowExecutionId: WorkflowExecutionIdentifierSchema.optional().nullable(),

  /** Maximum number of results to return */
  limit: z.number().int().optional().nullable(),

  /** Pagination token */
  token: z.string().optional().nullable(),

  /** Filter string */
  filters: z.string().optional().nullable(),

  /** Sort configuration */
  sortBy: SortSchema.optional().nullable(),
});

// ============================================================================
// Query Parameter Schemas (for API routes)
// ============================================================================

/**
 * Query parameters for listing signals
 */
export const SignalListQuerySchema = z.object({
  /** Workflow execution ID (JSON string) */
  workflowExecutionId: z.string().min(1),

  limit: z.coerce.number().int().min(1).max(100).default(50),
  token: z.string().optional(),
  filters: z.string().optional(),
});

/**
 * Query parameters for getting/creating signal
 */
export const SignalGetOrCreateQuerySchema = z.object({
  signalId: z.string().min(1),
  executionProject: z.string().min(1),
  executionDomain: z.string().min(1),
  executionName: z.string().min(1),
});

/**
 * Query parameters for setting signal
 */
export const SignalSetQuerySchema = z.object({
  signalId: z.string().min(1),
  executionProject: z.string().min(1),
  executionDomain: z.string().min(1),
  executionName: z.string().min(1),
});
