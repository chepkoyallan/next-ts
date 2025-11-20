/**
 * Common Protobuf Schemas
 * Shared types used across all flyteidl services
 *
 * Based on: src/dsl/gen/pb-js/flyteidl.d.ts
 */

import { z } from 'zod';

// ============================================================================
// Google Protobuf Common Types
// ============================================================================

/**
 * google.protobuf.IDuration
 * Represents a duration as seconds and nanoseconds
 */
export const DurationSchema = z
  .object({
    seconds: z.union([z.number(), z.string(), z.null()]).optional(),
    nanos: z.number().int().min(0).max(999999999).optional(),
  })
  .optional()
  .nullable();

/**
 * google.protobuf.ITimestamp
 * Represents a point in time
 */
export const TimestampSchema = z
  .object({
    seconds: z.union([z.number(), z.string(), z.null()]).optional(),
    nanos: z.number().int().min(0).max(999999999).optional(),
  })
  .optional()
  .nullable();

/**
 * google.protobuf.IStruct
 * Represents arbitrary structured data
 */
export const StructSchema = z.record(z.string(), z.any()).optional().nullable();

// ============================================================================
// Core Identifier Types (flyteidl.core)
// ============================================================================

/**
 * ResourceType enum
 * UNSPECIFIED = 0, TASK = 1, WORKFLOW = 2, LAUNCH_PLAN = 3, DATASET = 4
 */
export const ResourceTypeSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);

/**
 * flyteidl.core.IIdentifier
 * Full resource identifier
 */
export const IdentifierSchema = z.object({
  resourceType: ResourceTypeSchema.optional().nullable(),
  project: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  version: z.string().optional().nullable(),
});

/**
 * flyteidl.admin.INamedEntityIdentifier
 * Resource identifier without version
 */
export const NamedEntityIdentifierSchema = z.object({
  project: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
});

/**
 * flyteidl.core.IWorkflowExecutionIdentifier
 */
export const WorkflowExecutionIdentifierSchema = z.object({
  project: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
});

/**
 * flyteidl.core.INodeExecutionIdentifier
 */
export const NodeExecutionIdentifierSchema = z.object({
  nodeId: z.string().optional().nullable(),
  executionId: WorkflowExecutionIdentifierSchema.optional().nullable(),
});

/**
 * flyteidl.core.ITaskExecutionIdentifier
 */
export const TaskExecutionIdentifierSchema = z.object({
  taskId: IdentifierSchema.optional().nullable(),
  nodeExecutionId: NodeExecutionIdentifierSchema.optional().nullable(),
  retryAttempt: z.number().int().optional().nullable(),
});

// ============================================================================
// Core Type System (flyteidl.core)
// ============================================================================

/**
 * SimpleType enum
 */
export const SimpleTypeSchema = z.union([
  z.literal(0), // NONE
  z.literal(1), // INTEGER
  z.literal(2), // FLOAT
  z.literal(3), // STRING
  z.literal(4), // BOOLEAN
  z.literal(5), // DATETIME
  z.literal(6), // DURATION
  z.literal(7), // BINARY
  z.literal(8), // ERROR
  z.literal(9), // STRUCT
]);

/**
 * flyteidl.core.IBlobType
 */
export const BlobTypeSchema = z.object({
  format: z.string().optional().nullable(),
  dimensionality: z
    .union([
      z.literal(0), // SINGLE
      z.literal(1), // MULTIPART
    ])
    .optional()
    .nullable(),
});

/**
 * flyteidl.core.IEnumType
 */
export const EnumTypeSchema = z.object({
  values: z.array(z.string()).optional().nullable(),
});

/**
 * flyteidl.core.ILiteralType (Recursive)
 */
export const LiteralTypeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    simple: SimpleTypeSchema.optional().nullable(),
    schema: StructSchema,
    collectionType: LiteralTypeSchema.optional().nullable(),
    mapValueType: LiteralTypeSchema.optional().nullable(),
    blob: BlobTypeSchema.optional().nullable(),
    enumType: EnumTypeSchema.optional().nullable(),
    structuredDatasetType: z
      .object({
        columns: z.array(z.any()).optional().nullable(),
        format: z.string().optional().nullable(),
        externalSchemaType: z.string().optional().nullable(),
        externalSchemaBytes: z.instanceof(Uint8Array).optional().nullable(),
      })
      .optional()
      .nullable(),
    unionType: z
      .object({
        variants: z.array(LiteralTypeSchema).optional().nullable(),
      })
      .optional()
      .nullable(),
    metadata: StructSchema,
  })
);

/**
 * flyteidl.core.IVariable
 */
export const VariableSchema = z.object({
  type: LiteralTypeSchema.optional().nullable(),
  description: z.string().optional().nullable(),
});

/**
 * flyteidl.core.IVariableMap
 */
export const VariableMapSchema = z.object({
  variables: z.record(z.string(), VariableSchema).optional().nullable(),
});

/**
 * flyteidl.core.ITypedInterface
 */
export const TypedInterfaceSchema = z.object({
  inputs: VariableMapSchema.optional().nullable(),
  outputs: VariableMapSchema.optional().nullable(),
});

/**
 * flyteidl.core.ILiteral (Recursive)
 */
export const LiteralSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    scalar: z.any().optional().nullable(),
    collection: z
      .object({
        literals: z.array(LiteralSchema).optional().nullable(),
      })
      .optional()
      .nullable(),
    map: z
      .object({
        literals: z.record(z.string(), LiteralSchema).optional().nullable(),
      })
      .optional()
      .nullable(),
    hash: z.string().optional().nullable(),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  })
);

/**
 * flyteidl.core.ILiteralMap
 */
export const LiteralMapSchema = z.object({
  literals: z.record(z.string(), LiteralSchema).optional().nullable(),
});

/**
 * flyteidl.core.IParameter
 */
export const ParameterSchema = z.object({
  var: VariableSchema.optional().nullable(),
  default: LiteralSchema.optional().nullable(),
  required: z.boolean().optional().nullable(),
});

/**
 * flyteidl.core.IParameterMap
 */
export const ParameterMapSchema = z.object({
  parameters: z.record(z.string(), ParameterSchema).optional().nullable(),
});

// ============================================================================
// Admin Common Types (flyteidl.admin)
// ============================================================================

/**
 * flyteidl.admin.ILabels
 */
export const LabelsSchema = z.object({
  values: z.record(z.string(), z.string()).optional().nullable(),
});

/**
 * flyteidl.admin.IAnnotations
 */
export const AnnotationsSchema = z.object({
  values: z.record(z.string(), z.string()).optional().nullable(),
});

/**
 * flyteidl.admin.IAuthRole
 */
export const AuthRoleSchema = z.object({
  assumableIamRole: z.string().optional().nullable(),
  kubernetesServiceAccount: z.string().optional().nullable(),
});

/**
 * flyteidl.admin.IAuth
 */
export const AuthSchema = z.object({
  assumableIamRole: z.string().optional().nullable(),
  kubernetesServiceAccount: z.string().optional().nullable(),
});

/**
 * flyteidl.admin.IRawOutputDataConfig
 */
export const RawOutputDataConfigSchema = z.object({
  outputLocationPrefix: z.string().optional().nullable(),
});

/**
 * flyteidl.core.ISecurityContext
 */
export const SecurityContextSchema = z.object({
  runAs: z
    .object({
      k8sServiceAccount: z.string().optional().nullable(),
      iamRole: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  secrets: z.array(z.any()).optional().nullable(),
  tokens: z.array(z.any()).optional().nullable(),
});

/**
 * flyteidl.core.IQualityOfService
 */
export const QualityOfServiceSchema = z.object({
  tier: z
    .union([
      z.literal(0), // UNDEFINED
      z.literal(1), // HIGH
      z.literal(2), // MEDIUM
      z.literal(3), // LOW
    ])
    .optional()
    .nullable(),
  spec: z
    .object({
      queueingBudget: DurationSchema,
    })
    .optional()
    .nullable(),
});

/**
 * flyteidl.core.IRetryStrategy
 */
export const RetryStrategySchema = z.object({
  retries: z.number().int().optional().nullable(),
});

/**
 * flyteidl.core.IRuntimeMetadata
 */
export const RuntimeMetadataSchema = z.object({
  type: z
    .union([
      z.literal(0), // OTHER
      z.literal(1), // FLYTE_SDK
    ])
    .optional()
    .nullable(),
  version: z.string().optional().nullable(),
  flavor: z.string().optional().nullable(),
});

/**
 * Sort direction enum
 */
export const SortDirectionSchema = z.union([
  z.literal(0), // DESCENDING
  z.literal(1), // ASCENDING
]);

/**
 * flyteidl.admin.ISort
 */
export const SortSchema = z.object({
  key: z.string().optional().nullable(),
  direction: SortDirectionSchema.optional().nullable(),
});

// ============================================================================
// Container and K8s Types
// ============================================================================

/**
 * flyteidl.core.IResources
 */
export const ResourcesSchema = z.object({
  requests: z.array(z.any()).optional().nullable(),
  limits: z.array(z.any()).optional().nullable(),
});

/**
 * flyteidl.core.IKeyValuePair
 */
export const KeyValuePairSchema = z.object({
  key: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
});

/**
 * flyteidl.core.IContainer
 */
export const ContainerSchema = z.object({
  image: z.string().optional().nullable(),
  command: z.array(z.string()).optional().nullable(),
  args: z.array(z.string()).optional().nullable(),
  resources: ResourcesSchema.optional().nullable(),
  env: z.array(KeyValuePairSchema).optional().nullable(),
  config: z.array(KeyValuePairSchema).optional().nullable(),
});

/**
 * flyteidl.core.IK8sPod
 */
export const K8sPodSchema = z.object({
  metadata: z.any().optional().nullable(),
  podSpec: z.any().optional().nullable(),
});

/**
 * flyteidl.core.ISql
 */
export const SqlSchema = z.object({
  statement: z.string().optional().nullable(),
  dialect: z
    .union([
      z.literal(0), // UNDEFINED
      z.literal(1), // ANSI
      z.literal(2), // HIVE
      z.literal(3), // OTHER
    ])
    .optional()
    .nullable(),
});

// ============================================================================
// Workflow Execution Phase (flyteidl.core.WorkflowExecution.Phase)
// ============================================================================

/**
 * WorkflowExecution.Phase enum
 * Used in notifications, execution closures, and events
 */
export const WorkflowExecutionPhaseSchema = z.union([
  z.literal(0), // UNDEFINED
  z.literal(1), // QUEUED
  z.literal(2), // RUNNING
  z.literal(3), // SUCCEEDING
  z.literal(4), // SUCCEEDED
  z.literal(5), // FAILING
  z.literal(6), // FAILED
  z.literal(7), // ABORTED
  z.literal(8), // TIMED_OUT
  z.literal(9), // ABORTING
]);
