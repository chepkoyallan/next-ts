/**
 * Type Definitions for Workflow Compiler V4
 *
 * Clean, explicit types with clear separation between UI and runtime concerns
 */

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

// ============================================================================
// FLYTE TYPE SYSTEM
// ============================================================================

/**
 * Flyte type kind
 */
export type FlyteTypeKind = 'simple' | 'collection' | 'map' | 'union' | 'struct' | 'blob';

/**
 * Flyte simple types
 */
export enum SimpleType {
  NONE = 0,
  INTEGER = 1,
  FLOAT = 2,
  STRING = 3,
  BOOLEAN = 4,
  DATETIME = 5,
  DURATION = 6,
  BINARY = 7,
  ERROR = 8,
  STRUCT = 9,
}

/**
 * Structured representation of Flyte types
 */
export interface FlyteType {
  kind: FlyteTypeKind;

  // For simple types
  simple?: SimpleType;

  // For collection types (arrays)
  collectionType?: FlyteType;

  // For map types
  mapValueType?: FlyteType;

  // For union types
  unionTypes?: FlyteType[];

  // For struct types with known fields
  structFields?: Map<string, FlyteType>;

  // For blob types
  blobDimensionality?: string;
}

/**
 * Flyte variable (parameter definition)
 */
export interface FlyteVariable {
  name: string;
  type: FlyteType;
  description: string;
  optional?: boolean; // If true, binding can be omitted
}

// ============================================================================
// TASK INTERFACE
// ============================================================================

/**
 * Task identifier
 */
export interface TaskId {
  project: string;
  domain: string;
  name: string;
  version: string;
}

/**
 * Task interface with inputs/outputs
 */
export interface TaskInterface {
  taskId: TaskId;
  inputs: Map<string, FlyteVariable>;
  outputs: Map<string, FlyteVariable>;

  // Cache metadata
  fetchedAt: Date;
  expiresAt: Date;
}

// ============================================================================
// BINDING
// ============================================================================

/**
 * Source of a binding value
 */
export type BindingSourceType = 'static' | 'upstream' | 'workflow-input';

/**
 * Information about where a binding value comes from
 */
export interface BindingSource {
  parameter: string;
  source: BindingSourceType;

  // For static values
  value?: any;

  // For upstream node outputs
  upstreamNodeId?: string;
  upstreamOutputField?: string;

  // For workflow inputs
  workflowInputField?: string;
}

/**
 * Options for binding creation
 */
export interface BindingOptions {
  /**
   * Validation mode
   * - strict: Error on any type mismatch
   * - lenient: Coerce types when safe
   */
  mode: 'strict' | 'lenient';

  /**
   * Skip fields in inputData that don't exist in task interface
   * If false, treat as error
   */
  skipUnknownFields: boolean;

  /**
   * Allow null/undefined for optional parameters
   */
  allowNullForOptional: boolean;
}

/**
 * Default binding options
 */
export const DEFAULT_BINDING_OPTIONS: BindingOptions = {
  mode: 'lenient',
  skipUnknownFields: true,
  allowNullForOptional: true,
};

/**
 * Binding error
 */
export interface BindingError {
  field: string;
  code: BindingErrorCode;
  message: string;
  expectedType?: FlyteType;
  actualValue?: any;
  actualType?: string;
  suggestion?: string;
  documentation?: string;
}

/**
 * Binding error codes
 */
export enum BindingErrorCode {
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  INVALID_VALUE = 'INVALID_VALUE',
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  UNKNOWN_PARAMETER = 'UNKNOWN_PARAMETER',
}

/**
 * Binding warning
 */
export interface BindingWarning {
  field: string;
  code: BindingWarningCode;
  message: string;
  action?: string;
}

/**
 * Binding warning codes
 */
export enum BindingWarningCode {
  UNKNOWN_FIELD_SKIPPED = 'UNKNOWN_FIELD_SKIPPED',
  NULL_FOR_OPTIONAL = 'NULL_FOR_OPTIONAL',
  TYPE_COERCION = 'TYPE_COERCION',
  DEPRECATED_PARAMETER = 'DEPRECATED_PARAMETER',
}

/**
 * Result of binding creation
 */
export interface BindingResult {
  bindings: flyteidl.core.IBinding[];

  // Fields from inputData that were skipped
  skipped: string[];

  // Required fields not provided in inputData
  missing: string[];

  // Errors encountered
  errors: BindingError[];

  // Warnings generated
  warnings: BindingWarning[];

  // Success flag
  success: boolean;
}

/**
 * Metadata about a bound parameter
 */
export interface BoundParameter {
  name: string;
  type: FlyteType;
  sourceType: BindingSourceType;
  value?: any;
  upstreamReference?: string;
}

/**
 * Information about a skipped field
 */
export interface SkippedField {
  name: string;
  reason: 'not-in-task-interface' | 'ui-metadata' | 'null-optional';
  value: any;
}

/**
 * Metadata about node bindings
 */
export interface NodeBindingMetadata {
  nodeId: string;
  taskId: TaskId;

  // What was bound
  boundParameters: BoundParameter[];

  // What was skipped
  skippedFields: SkippedField[];

  // Issues
  errors: BindingError[];
  warnings: BindingWarning[];

  // Timing
  bindingTimeMs: number;
  taskInterfaceCacheHit: boolean;
}

// ============================================================================
// COMPILATION
// ============================================================================

/**
 * Compilation options
 */
export interface CompileOptions {
  /**
   * Validation strictness
   */
  validationMode: 'strict' | 'lenient';

  /**
   * Fail compilation if warnings present
   */
  failOnWarnings: boolean;

  /**
   * Include detailed debug info in result
   */
  includeDebugInfo: boolean;

  /**
   * Compile independent nodes in parallel
   */
  parallelCompilation: boolean;

  /**
   * Binding options (passed to binding engine)
   */
  bindingOptions?: BindingOptions;
}

/**
 * Default compilation options
 */
export const DEFAULT_COMPILE_OPTIONS: CompileOptions = {
  validationMode: 'lenient',
  failOnWarnings: false,
  includeDebugInfo: false,
  parallelCompilation: true,
  bindingOptions: DEFAULT_BINDING_OPTIONS,
};

/**
 * Compilation statistics
 */
export interface CompilationStats {
  // Node counts
  nodeCount: number;
  taskNodeCount: number;
  branchNodeCount: number;
  subworkflowNodeCount: number;

  // Binding stats
  totalBindings: number;
  totalSkippedFields: number;

  // Performance
  compilationTimeMs: number;
  taskInterfaceFetches: number;
  taskInterfaceCacheHits: number;

  // Timing breakdown
  timingBreakdown?: {
    prefetchTimeMs: number;
    nodeCompilationTimeMs: number;
    assemblyTimeMs: number;
    validationTimeMs: number;
  };
}

/**
 * Compilation error
 */
export interface CompilationError {
  code: CompilationErrorCode;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
  details?: any;
  suggestion?: string;
}

/**
 * Compilation error codes
 */
export enum CompilationErrorCode {
  // Draft validation
  INVALID_DRAFT_STRUCTURE = 'INVALID_DRAFT_STRUCTURE',
  NO_TASK_NODES = 'NO_TASK_NODES',
  ORPHANED_NODES = 'ORPHANED_NODES',
  CYCLIC_DEPENDENCY = 'CYCLIC_DEPENDENCY',

  // Node validation
  MISSING_TASK_ID = 'MISSING_TASK_ID',
  INVALID_NODE_CONFIG = 'INVALID_NODE_CONFIG',
  MISSING_INPUT_DATA = 'MISSING_INPUT_DATA',

  // Task interface
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_INTERFACE_FETCH_FAILED = 'TASK_INTERFACE_FETCH_FAILED',

  // Binding
  BINDING_FAILED = 'BINDING_FAILED',

  // Assembly
  WORKFLOW_ASSEMBLY_FAILED = 'WORKFLOW_ASSEMBLY_FAILED',
}

/**
 * Compilation warning
 */
export interface CompilationWarning {
  code: CompilationWarningCode;
  message: string;
  nodeId?: string;
  nodeLabel?: string;
  action?: string;
}

/**
 * Compilation warning codes
 */
export enum CompilationWarningCode {
  UNUSED_NODE = 'UNUSED_NODE',
  MISSING_DESCRIPTION = 'MISSING_DESCRIPTION',
  BINDING_WARNING = 'BINDING_WARNING',
  PERFORMANCE_WARNING = 'PERFORMANCE_WARNING',
}

/**
 * Debug information for compilation
 */
export interface CompilationDebugInfo {
  // Node-by-node breakdown
  nodeDetails: Array<{
    nodeId: string;
    nodeType: string;
    bindingMetadata?: NodeBindingMetadata;
    compilationTimeMs: number;
  }>;

  // Task interface cache state
  cacheState: {
    size: number;
    entries: Array<{
      taskId: string;
      fetchedAt: string;
      expiresAt: string;
    }>;
  };

  // Full protobuf structure (for advanced debugging)
  protobufJson?: any;
}

/**
 * Result of workflow compilation
 */
export interface CompilationResult {
  success: boolean;

  // Compiled workflow closure (if successful)
  closure?: flyteidl.core.ICompiledWorkflowClosure;

  // Workflow identifier
  workflowId: flyteidl.core.IIdentifier;

  // Statistics
  stats: CompilationStats;

  // Issues
  errors: CompilationError[];
  warnings: CompilationWarning[];

  // Debug info (if enabled)
  debug?: CompilationDebugInfo;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validation issue severity
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * Validation issue
 */
export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  field?: string;
  suggestion?: string;
}

/**
 * Result of workflow validation
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

// ============================================================================
// WORKFLOW DRAFT (Enhanced for V4)
// ============================================================================

/**
 * Enhanced node data with explicit UI/runtime separation
 */
export interface WorkflowNodeDataV4 {
  // Basic info
  label: string;
  description?: string;

  // UI LAYER (design-time, for forms/display)
  ui?: {
    inputSchema?: any; // JSONSchema
    outputSchema?: any; // JSONSchema
    formConfig?: any; // JSONForms uischema
    displayHints?: any;
  };

  // RUNTIME LAYER (execution-time, for Flyte)
  runtime: {
    inputData: Record<string, any>; // Actual values to bind
    inputSources?: BindingSource[]; // Provenance tracking
  };

  // Task reference (for task nodes)
  taskId?: TaskId;

  // Branch configuration (for branch nodes)
  branchConfig?: any;

  // Configuration
  config?: {
    timeout?: number; // seconds
    retries?: number;
    cacheable?: boolean;
    cacheVersion?: string;
  };

  // Metadata
  metadata?: Record<string, any>;

  // Validation state (set by compiler)
  validationErrors?: string[];
  validationWarnings?: string[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E };

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Pretty-printed type name for error messages
 */
export function prettyPrintType(type: FlyteType): string {
  switch (type.kind) {
    case 'simple':
      return SimpleType[type.simple || 0];
    case 'collection':
      return `Array<${prettyPrintType(type.collectionType!)}>`;
    case 'map':
      return `Map<string, ${prettyPrintType(type.mapValueType!)}>`;
    case 'union':
      return type.unionTypes!.map(prettyPrintType).join(' | ');
    case 'struct':
      return 'STRUCT';
    case 'blob':
      return 'BLOB';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Get type name from JavaScript value
 */
export function getValueTypeName(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Array<unknown>';
    return `Array<${getValueTypeName(value[0])}>`;
  }
  if (typeof value === 'object') return 'Object';
  return typeof value;
}
