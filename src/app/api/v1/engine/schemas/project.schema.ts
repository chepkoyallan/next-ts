/**
 * Project Service Schemas
 * 100% accurate schemas based on flyteidl protobuf definitions
 *
 * Based on: src/dsl/gen/pb-js/flyteidl.d.ts
 * - flyteidl.admin.IProjectRegisterRequest
 * - flyteidl.admin.IProject
 * - flyteidl.admin.IDomain
 */

import { z } from 'zod';

import { SortSchema, LabelsSchema } from './common';

// ============================================================================
// Domain (flyteidl.admin.IDomain)
// ============================================================================

/**
 * flyteidl.admin.IDomain
 */
export const DomainSchema = z.object({
  /** Domain identifier */
  id: z.string().optional().nullable(),

  /** Domain display name */
  name: z.string().optional().nullable(),
});

// ============================================================================
// Project State (flyteidl.admin.Project.ProjectState)
// ============================================================================

/**
 * ProjectState enum
 */
export const ProjectStateSchema = z.union([
  z.literal(0), // ACTIVE
  z.literal(1), // ARCHIVED
  z.literal(2), // SYSTEM_GENERATED
]);

// ============================================================================
// Project (flyteidl.admin.IProject)
// ============================================================================

/**
 * flyteidl.admin.IProject
 * Complete project structure
 */
export const ProjectSchema = z.object({
  /** Project identifier */
  id: z.string().optional().nullable(),

  /** Project display name */
  name: z.string().optional().nullable(),

  /** Project domains */
  domains: z.array(DomainSchema).optional().nullable(),

  /** Project description */
  description: z.string().optional().nullable(),

  /** Project labels */
  labels: LabelsSchema.optional().nullable(),

  /** Project state */
  state: ProjectStateSchema.optional().nullable(),
});

// ============================================================================
// Project Register Request (flyteidl.admin.IProjectRegisterRequest)
// ============================================================================

/**
 * flyteidl.admin.IProjectRegisterRequest
 * Request to register a new project
 */
export const ProjectRegisterRequestSchema = z.object({
  /** Project to register */
  project: ProjectSchema.optional().nullable(),
});

// ============================================================================
// Project Update Request (flyteidl.admin.IProjectUpdateRequest)
// ============================================================================

/**
 * flyteidl.admin.IProjectUpdateRequest
 * Request to update an existing project
 */
export const ProjectUpdateRequestSchema = z.object({
  /** Project with updated fields */
  project: ProjectSchema.optional().nullable(),
});

// ============================================================================
// Project List Requests
// ============================================================================

/**
 * flyteidl.admin.IProjectListRequest
 * Request to list projects
 */
export const ProjectListRequestSchema = z.object({
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
 * flyteidl.admin.IProjectGetRequest
 * Request to get a specific project
 */
export const ProjectGetRequestSchema = z.object({
  /** Project identifier */
  id: z.string().optional().nullable(),
});

// ============================================================================
// Domain List Requests
// ============================================================================

/**
 * flyteidl.admin.IDomainListRequest
 * Request to list domains
 */
export const DomainListRequestSchema = z.object({
  /** Project identifier */
  project: z.string().optional().nullable(),

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
 * Query parameters for listing projects
 */
export const ProjectListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  token: z.string().optional(),
  filters: z.string().optional(),
});

/**
 * Query parameters for getting project
 */
export const ProjectGetQuerySchema = z.object({
  id: z.string().min(1),
});

/**
 * Query parameters for listing domains
 */
export const DomainListQuerySchema = z.object({
  project: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  token: z.string().optional(),
  filters: z.string().optional(),
});
