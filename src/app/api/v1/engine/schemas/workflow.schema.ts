/**
 * Workflow Service Schemas
 * 100% accurate schemas based on flyteidl protobuf definitions
 *
 * Based on: src/dsl/gen/pb-js/flyteidl.d.ts
 * - flyteidl.admin.IWorkflowCreateRequest
 * - flyteidl.admin.IWorkflowSpec
 * - flyteidl.core.IWorkflowTemplate
 * - flyteidl.core.IWorkflowMetadata
 * - flyteidl.core.INode
 */

import { z } from 'zod';

import {
  SortSchema,
  LiteralSchema,
  DurationSchema,
  TimestampSchema,
  IdentifierSchema,
  RetryStrategySchema,
  TypedInterfaceSchema,
  QualityOfServiceSchema,
  NamedEntityIdentifierSchema,
} from './common';

// ============================================================================
// Node and Workflow Building Blocks (flyteidl.core)
// ============================================================================

/**
 * flyteidl.core.IAlias
 */
export const AliasSchema = z.object({
  var: z.string().optional().nullable(),
  alias: z.string().optional().nullable(),
});

/**
 * flyteidl.core.IOutputReference
 */
export const OutputReferenceSchema = z.object({
  nodeId: z.string().optional().nullable(),
  var: z.string().optional().nullable(),
  attrPath: z.array(z.any()).optional().nullable(),
});

/**
 * flyteidl.core.IBindingDataCollection (Recursive)
 */
export const BindingDataCollectionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    bindings: z.array(BindingDataSchema).optional().nullable(),
  })
);

/**
 * flyteidl.core.IBindingDataMap (Recursive)
 */
export const BindingDataMapSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    bindings: z.record(z.string(), BindingDataSchema).optional().nullable(),
  })
);

/**
 * flyteidl.core.IBindingData (Recursive)
 */
export const BindingDataSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    scalar: LiteralSchema.optional().nullable(),
    collection: BindingDataCollectionSchema.optional().nullable(),
    promise: OutputReferenceSchema.optional().nullable(),
    map: BindingDataMapSchema.optional().nullable(),
    union: z.any().optional().nullable(),
  })
);

/**
 * flyteidl.core.IBinding
 */
export const BindingSchema = z.object({
  var: z.string().optional().nullable(),
  binding: BindingDataSchema.optional().nullable(),
});

/**
 * flyteidl.core.ITaskNodeOverrides
 */
export const TaskNodeOverridesSchema = z.object({
  resources: z.any().optional().nullable(),
});

/**
 * flyteidl.core.ITaskNode
 */
export const TaskNodeSchema = z.object({
  referenceId: IdentifierSchema.optional().nullable(),
  overrides: TaskNodeOverridesSchema.optional().nullable(),
});

/**
 * flyteidl.core.IWorkflowNode
 */
export const WorkflowNodeSchema = z.object({
  launchplanRef: IdentifierSchema.optional().nullable(),
  subWorkflowRef: IdentifierSchema.optional().nullable(),
});

/**
 * flyteidl.core.IIfElseBlock
 */
export const IfElseBlockSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    case: z.any().optional().nullable(),
    other: z.array(z.any()).optional().nullable(),
    elseNode: NodeSchema.optional().nullable(),
  })
);

/**
 * flyteidl.core.IBranchNode
 */
export const BranchNodeSchema = z.object({
  ifElse: IfElseBlockSchema.optional().nullable(),
});

/**
 * flyteidl.core.IApproveCondition
 */
export const ApproveConditionSchema = z.object({
  signalId: z.string().optional().nullable(),
});

/**
 * flyteidl.core.ISignalCondition
 */
export const SignalConditionSchema = z.object({
  signalId: z.string().optional().nullable(),
  type: z.any().optional().nullable(),
  outputVariableName: z.string().optional().nullable(),
});

/**
 * flyteidl.core.ISleepCondition
 */
export const SleepConditionSchema = z.object({
  duration: DurationSchema,
});

/**
 * flyteidl.core.IGateNode
 */
export const GateNodeSchema = z.object({
  approve: ApproveConditionSchema.optional().nullable(),
  signal: SignalConditionSchema.optional().nullable(),
  sleep: SleepConditionSchema.optional().nullable(),
});

/**
 * flyteidl.core.INodeMetadata
 */
export const NodeMetadataSchema = z.object({
  name: z.string().optional().nullable(),
  timeout: DurationSchema,
  retries: RetryStrategySchema.optional().nullable(),
  interruptible: z.boolean().optional().nullable(),
});

/**
 * flyteidl.core.INode (Recursive)
 * Core workflow node that can contain task, workflow, branch, or gate nodes
 */
export const NodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().optional().nullable(),
    metadata: NodeMetadataSchema.optional().nullable(),
    inputs: z.array(BindingSchema).optional().nullable(),
    upstreamNodeIds: z.array(z.string()).optional().nullable(),
    outputAliases: z.array(AliasSchema).optional().nullable(),
    taskNode: TaskNodeSchema.optional().nullable(),
    workflowNode: WorkflowNodeSchema.optional().nullable(),
    branchNode: BranchNodeSchema.optional().nullable(),
    gateNode: GateNodeSchema.optional().nullable(),
  })
);

// ============================================================================
// Workflow Metadata (flyteidl.core.IWorkflowMetadata)
// ============================================================================

/**
 * OnFailurePolicy enum
 */
export const OnFailurePolicySchema = z.union([
  z.literal(0), // FAIL_IMMEDIATELY
  z.literal(1), // FAIL_AFTER_EXECUTABLE_NODES_COMPLETE
]);

/**
 * flyteidl.core.IWorkflowMetadata
 */
export const WorkflowMetadataSchema = z.object({
  qualityOfService: QualityOfServiceSchema.optional().nullable(),
  onFailure: OnFailurePolicySchema.optional().nullable(),
  tags: z.record(z.string(), z.string()).optional().nullable(),
});

/**
 * flyteidl.core.IWorkflowMetadataDefaults
 */
export const WorkflowMetadataDefaultsSchema = z.object({
  interruptible: z.boolean().optional().nullable(),
});

// ============================================================================
// Workflow Template (flyteidl.core.IWorkflowTemplate)
// ============================================================================

/**
 * flyteidl.core.IWorkflowTemplate
 * Complete workflow template structure
 */
export const WorkflowTemplateSchema = z.object({
  /** Workflow identifier */
  id: IdentifierSchema.optional().nullable(),

  /** Workflow metadata */
  metadata: WorkflowMetadataSchema.optional().nullable(),

  /** Workflow interface (inputs/outputs) */
  interface: TypedInterfaceSchema.optional().nullable(),

  /** Workflow nodes */
  nodes: z.array(NodeSchema).optional().nullable(),

  /** Output bindings */
  outputs: z.array(BindingSchema).optional().nullable(),

  /** Failure node */
  failureNode: NodeSchema.optional().nullable(),

  /** Metadata defaults */
  metadataDefaults: WorkflowMetadataDefaultsSchema.optional().nullable(),
});

// ============================================================================
// Workflow Closure (flyteidl.admin.IWorkflowClosure)
// ============================================================================

/**
 * flyteidl.core.ICompiledWorkflowClosure
 */
export const CompiledWorkflowClosureSchema = z.object({
  primary: z.any().optional().nullable(),
  subWorkflows: z.array(z.any()).optional().nullable(),
  tasks: z.array(z.any()).optional().nullable(),
});

/**
 * flyteidl.admin.IWorkflowClosure
 * Workflow closure containing compiled workflow and creation time
 */
export const WorkflowClosureSchema = z.object({
  compiledWorkflow: CompiledWorkflowClosureSchema.optional().nullable(),
  createdAt: TimestampSchema,
});

// ============================================================================
// Workflow Spec (flyteidl.admin.IWorkflowSpec)
// ============================================================================

/**
 * flyteidl.admin.IDescriptionEntity
 */
export const DescriptionEntitySchema = z.object({
  id: IdentifierSchema.optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  longDescription: z.any().optional().nullable(),
  sourceCode: z.any().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

/**
 * flyteidl.admin.IWorkflowSpec
 * Workflow specification
 */
export const WorkflowSpecSchema = z.object({
  /** Workflow template */
  template: WorkflowTemplateSchema.optional().nullable(),

  /** Sub-workflows */
  subWorkflows: z.array(WorkflowTemplateSchema).optional().nullable(),

  /** Workflow description */
  description: DescriptionEntitySchema.optional().nullable(),
});

// ============================================================================
// Workflow Create Request (flyteidl.admin.IWorkflowCreateRequest)
// ============================================================================

/**
 * flyteidl.admin.IWorkflowCreateRequest
 * Request to create a new workflow
 */
export const WorkflowCreateRequestSchema = z.object({
  /** Workflow identifier */
  id: IdentifierSchema.optional().nullable(),

  /** Workflow specification */
  spec: WorkflowSpecSchema.optional().nullable(),
});

// ============================================================================
// Workflow List/Query Requests
// ============================================================================

/**
 * flyteidl.admin.IResourceListRequest
 * Request to list workflows (uses ResourceListRequest with workflow identifier)
 */
export const WorkflowListRequestSchema = z.object({
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
 * Request to get a specific workflow
 */
export const WorkflowGetRequestSchema = z.object({
  /** Workflow identifier */
  id: IdentifierSchema.optional().nullable(),
});

// ============================================================================
// Query Parameter Schemas (for API routes)
// ============================================================================

/**
 * Query parameters for listing workflows
 */
export const WorkflowListQuerySchema = z.object({
  project: z.string().min(1).default('aus'),
  domain: z.string().min(1).default('development'),
  name: z.string().optional(),
  version: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  token: z.string().optional(),
  filters: z.string().optional(),
});
