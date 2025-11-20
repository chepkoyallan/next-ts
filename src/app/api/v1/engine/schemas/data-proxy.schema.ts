/**
 * Data Proxy Service Schemas
 * 100% accurate schemas based on flyteidl protobuf definitions
 *
 * Based on: src/dsl/gen/pb-js/flyteidl.d.ts
 * - flyteidl.service.ICreateUploadLocationRequest
 * - flyteidl.service.ICreateDownloadLocationRequest
 * - flyteidl.service.ICreateDownloadLinkRequest
 */

import { z } from 'zod';

import { DurationSchema, NodeExecutionIdentifierSchema } from './common';

// ============================================================================
// Artifact Type (flyteidl.service.ArtifactType)
// ============================================================================

/**
 * ArtifactType enum
 */
export const ArtifactTypeSchema = z.union([
  z.literal(0), // ARTIFACT_TYPE_UNDEFINED
  z.literal(1), // ARTIFACT_TYPE_DECK
]);

// ============================================================================
// Create Upload Location Request (flyteidl.service.ICreateUploadLocationRequest)
// ============================================================================

/**
 * flyteidl.service.ICreateUploadLocationRequest
 * Request to create a signed upload location for data artifacts
 */
export const CreateUploadLocationRequestSchema = z.object({
  /** Project name */
  project: z.string().optional().nullable(),

  /** Domain name */
  domain: z.string().optional().nullable(),

  /** Filename for the upload */
  filename: z.string().optional().nullable(),

  /** Expiration duration for the signed URL */
  expiresIn: DurationSchema,

  /** Content MD5 hash (as bytes) */
  contentMd5: z.instanceof(Uint8Array).optional().nullable(),
});

// ============================================================================
// Create Download Location Request (flyteidl.service.ICreateDownloadLocationRequest)
// ============================================================================

/**
 * flyteidl.service.ICreateDownloadLocationRequest
 * Request to create a signed download location for data artifacts
 */
export const CreateDownloadLocationRequestSchema = z.object({
  /** Native URL (e.g., s3://, gs://) */
  nativeUrl: z.string().optional().nullable(),

  /** Expiration duration for the signed URL */
  expiresIn: DurationSchema,
});

// ============================================================================
// Create Download Link Request (flyteidl.service.ICreateDownloadLinkRequest)
// ============================================================================

/**
 * flyteidl.service.ICreateDownloadLinkRequest
 * Request to create a download link for node execution artifacts
 */
export const CreateDownloadLinkRequestSchema = z.object({
  /** Artifact type (deck, etc.) */
  artifactType: ArtifactTypeSchema.optional().nullable(),

  /** Expiration duration for the signed URL */
  expiresIn: DurationSchema,

  /** Node execution identifier */
  nodeExecutionId: NodeExecutionIdentifierSchema.optional().nullable(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * flyteidl.service.ICreateUploadLocationResponse
 */
export const CreateUploadLocationResponseSchema = z.object({
  signedUrl: z.string().optional().nullable(),
  nativeUrl: z.string().optional().nullable(),
  expiresAt: z.any().optional().nullable(),
});

/**
 * flyteidl.service.ICreateDownloadLocationResponse
 */
export const CreateDownloadLocationResponseSchema = z.object({
  signedUrl: z.string().optional().nullable(),
  expiresAt: z.any().optional().nullable(),
});

/**
 * flyteidl.service.ICreateDownloadLinkResponse
 */
export const CreateDownloadLinkResponseSchema = z.object({
  signedUrl: z.array(z.string()).optional().nullable(),
  expiresAt: z.any().optional().nullable(),
});

// ============================================================================
// Query Parameter Schemas (for API routes)
// ============================================================================

/**
 * Query parameters for upload action
 */
export const UploadLocationQuerySchema = z.object({
  action: z.literal('upload'),
});

/**
 * Query parameters for download action
 */
export const DownloadLocationQuerySchema = z.object({
  action: z.literal('download'),
});

/**
 * Query parameters for download-link action
 */
export const DownloadLinkQuerySchema = z.object({
  action: z.literal('download-link'),
});
