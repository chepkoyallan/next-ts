/**
 * Workflow Compiler Service V4
 *
 * Orchestrates the compilation pipeline:
 * 1. Pre-flight validation
 * 2. Task interface prefetch
 * 3. Node binding creation (parallel)
 * 4. Protobuf assembly
 * 5. Post-compilation validation
 */

import type { AdminService } from '@app/engine';
import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';
import { logger } from 'src/app/api/lib/utils/logger';

import { BindingEngine } from './binding-engine';
import { ProtobufBuilder } from './protobuf-builder';
import { TaskInterfaceRegistry } from './task-interface-registry';
import type { WorkflowDraft, WorkflowBuilderNode } from '../workflow-draft-service';
import { CompilationErrorCode, CompilationWarningCode, DEFAULT_COMPILE_OPTIONS } from './types-v4';
import type {
  TaskId,
  CompileOptions,
  ValidationIssue,
  CompilationError,
  CompilationStats,
  ValidationResult,
  CompilationResult,
  CompilationWarning,
  NodeBindingMetadata,
} from './types-v4';

/**
 * Workflow Compiler Service V4
 *
 * Clean architecture compiler with type-aware binding
 */
export class WorkflowCompilerServiceV4 {
  private taskRegistry: TaskInterfaceRegistry;
  private bindingEngine: BindingEngine;
  private protobufBuilder: ProtobufBuilder;
  private options: CompileOptions;

  constructor(
    baseUrl: string = '',
    adminService?: AdminService,
    options: Partial<CompileOptions> = {}
  ) {
    this.options = { ...DEFAULT_COMPILE_OPTIONS, ...options };

    this.taskRegistry = new TaskInterfaceRegistry(
      {
        baseUrl,
      },
      adminService
    );

    this.bindingEngine = new BindingEngine(this.options.bindingOptions);
    this.protobufBuilder = new ProtobufBuilder();

    logger.info('[CompilerV4] Initialized with options', { options: this.options });
  }

  /**
   * Main compilation entry point
   */
  async compile(draft: WorkflowDraft): Promise<CompilationResult> {
    const startTime = Date.now();

    logger.info('='.repeat(80));
    logger.info('[CompilerV4] *** WORKFLOW COMPILER V4 ***');
    logger.info('[CompilerV4] Timestamp', { timestamp: new Date().toISOString() });
    logger.info('[CompilerV4] Workflow', {
      workflow: `${draft.project}/${draft.domain}/${draft.name}:${draft.version}`,
    });
    logger.info('='.repeat(80));

    const errors: CompilationError[] = [];
    const warnings: CompilationWarning[] = [];
    const nodeMetadata: NodeBindingMetadata[] = [];

    try {
      // ====================================================================
      // PHASE 1: Pre-flight Validation
      // ====================================================================
      logger.info('[CompilerV4] Phase 1: Pre-flight validation');

      const preflightValidation = WorkflowCompilerServiceV4.validateDraftStructure(draft);
      if (!preflightValidation.valid) {
        errors.push(
          ...WorkflowCompilerServiceV4.validationIssuesToCompilationErrors(
            preflightValidation.errors
          )
        );
      }
      warnings.push(
        ...WorkflowCompilerServiceV4.validationIssuesToCompilationWarnings(
          preflightValidation.warnings
        )
      );

      if (errors.length > 0) {
        return WorkflowCompilerServiceV4.buildFailureResult(draft, errors, warnings, {
          nodeCount: draft.nodes.length,
          taskNodeCount: 0,
          branchNodeCount: 0,
          subworkflowNodeCount: 0,
          totalBindings: 0,
          totalSkippedFields: 0,
          compilationTimeMs: Date.now() - startTime,
          taskInterfaceFetches: 0,
          taskInterfaceCacheHits: 0,
        });
      }

      // ====================================================================
      // PHASE 2: Task Interface Prefetch
      // ====================================================================
      logger.info('[CompilerV4] Phase 2: Task interface prefetch');
      const prefetchStart = Date.now();

      const taskIds = WorkflowCompilerServiceV4.extractTaskIds(draft);

      // Prefetch task interfaces (cache enabled for performance)
      await this.taskRegistry.prefetchInterfaces(taskIds);

      const prefetchTime = Date.now() - prefetchStart;
      logger.info(`[CompilerV4] Prefetch completed in ${prefetchTime}ms`);

      // ====================================================================
      // PHASE 3: Node Compilation (Binding Creation)
      // ====================================================================
      logger.info('[CompilerV4] Phase 3: Node compilation');
      const nodeCompilationStart = Date.now();

      const nodeBindings = new Map<
        string,
        { inputs: flyteidl.core.IBinding[]; outputs: Map<string, flyteidl.core.IVariable> }
      >();

      // Filter task and array_map nodes (nodes with inputData to bind OR field mappings from edges)
      const taskNodes = draft.nodes.filter((node) => {
        if ((node.type !== 'task' && node.type !== 'array_map') || !node.data.taskId) {
          return false;
        }

        // Include if node has inputData
        if (node.data.inputData && Object.keys(node.data.inputData).length > 0) {
          return true;
        }

        // Include if node has incoming edges with field mappings
        const hasFieldMappings = draft.edges.some(
          (edge: any) =>
            edge.target === node.id &&
            edge.data?.fieldMappings &&
            edge.data.fieldMappings.length > 0
        );

        return hasFieldMappings;
      });

      logger.info(`[CompilerV4] Compiling ${taskNodes.length} task/array_map nodes`);

      // Filter subworkflow nodes (nodes with inputData to bind)
      const subworkflowNodes = draft.nodes.filter(
        (node) =>
          node.type === 'subworkflow' &&
          node.data.workflowId &&
          node.data.inputData &&
          Object.keys(node.data.inputData).length > 0
      );

      logger.info(`[CompilerV4] Compiling ${subworkflowNodes.length} subworkflow nodes`);

      // Combine task and subworkflow nodes for binding compilation
      const nodesToCompile = [...taskNodes, ...subworkflowNodes];

      // Also process branch nodes to create passthrough bindings
      const branchNodes = draft.nodes.filter((node) => node.type === 'branch');
      logger.info(
        `[CompilerV4] Processing ${branchNodes.length} branch nodes for passthrough bindings`
      );

      // Compile nodes (optionally in parallel)
      if (this.options.parallelCompilation && nodesToCompile.length > 1) {
        logger.info('[CompilerV4] Using parallel compilation');

        const results = await Promise.all(
          nodesToCompile.map((node) => this.compileNode(node, draft.edges, draft.nodes))
        );

        results.forEach((result) => {
          if (result.bindings.length > 0) {
            nodeBindings.set(result.nodeId, {
              inputs: result.bindings,
              outputs: result.outputs,
            });
          }
          if (result.metadata) {
            nodeMetadata.push(result.metadata);
          }
          errors.push(...result.errors);
          warnings.push(...result.warnings);
        });
      } else {
        logger.info('[CompilerV4] Using sequential compilation');

        // Compile nodes sequentially (use reduce to avoid await-in-loop)
        await nodesToCompile.reduce(async (previousPromise, node) => {
          await previousPromise;
          const result = await this.compileNode(node, draft.edges, draft.nodes);

          if (result.bindings.length > 0) {
            nodeBindings.set(result.nodeId, {
              inputs: result.bindings,
              outputs: result.outputs,
            });
          }
          if (result.metadata) {
            nodeMetadata.push(result.metadata);
          }
          errors.push(...result.errors);
          warnings.push(...result.warnings);
        }, Promise.resolve());
      }

      // Create passthrough bindings for branch nodes
      // Branch nodes MUST have inputs for the upstream values they reference in conditions
      // The variable name format is: {upstream-node-id}.{output-var}
      branchNodes.forEach((branchNode) => {
        const upstreamEdges = draft.edges.filter((e) => e.target === branchNode.id);
        if (upstreamEdges.length > 0) {
          const upstreamNodeId = upstreamEdges[0].source;
          const upstreamNode = draft.nodes.find((n) => n.id === upstreamNodeId);

          if (upstreamNode && upstreamNode.type === 'task') {
            // Create a promise binding that passes through the upstream node's output
            // Variable name format: {upstream-node-id}.o0
            const passthroughBinding: flyteidl.core.IBinding = {
              var: `${upstreamNodeId}.o0`,
              binding: {
                promise: {
                  nodeId: upstreamNodeId,
                  var: 'o0',
                },
              },
            };

            nodeBindings.set(branchNode.id, {
              inputs: [passthroughBinding],
              outputs: new Map(),
            });
            logger.info(
              `[CompilerV4] Created passthrough binding for branch node ${branchNode.id} from ${upstreamNodeId}`
            );
          }
        }
      });

      const nodeCompilationTime = Date.now() - nodeCompilationStart;
      logger.info(`[CompilerV4] Node compilation completed in ${nodeCompilationTime}ms`);

      // Check for binding errors
      if (errors.length > 0) {
        logger.error(`[CompilerV4] Compilation failed with ${errors.length} errors`);
        return WorkflowCompilerServiceV4.buildFailureResult(draft, errors, warnings, {
          nodeCount: draft.nodes.length,
          taskNodeCount: taskNodes.length,
          branchNodeCount: draft.nodes.filter((n) => n.type === 'branch').length,
          subworkflowNodeCount: 0,
          totalBindings: Array.from(nodeBindings.values()).reduce(
            (sum, b) => sum + b.inputs.length,
            0
          ),
          totalSkippedFields: nodeMetadata.reduce((sum, m) => sum + m.skippedFields.length, 0),
          compilationTimeMs: Date.now() - startTime,
          taskInterfaceFetches: taskIds.length,
          taskInterfaceCacheHits: 0,
        });
      }

      // ====================================================================
      // PHASE 4: Workflow Assembly
      // ====================================================================
      logger.info('[CompilerV4] Phase 4: Workflow assembly');
      const assemblyStart = Date.now();

      const closure = this.protobufBuilder.buildWorkflowClosure(draft, nodeBindings);

      const assemblyTime = Date.now() - assemblyStart;
      logger.info(`[CompilerV4] Assembly completed in ${assemblyTime}ms`);

      // ====================================================================
      // PHASE 5: Post-compilation Validation
      // ====================================================================
      logger.info('[CompilerV4] Phase 5: Post-compilation validation');
      const validationStart = Date.now();

      const postValidation = WorkflowCompilerServiceV4.validateClosure(closure);
      warnings.push(
        ...WorkflowCompilerServiceV4.validationIssuesToCompilationWarnings(postValidation.warnings)
      );

      const validationTime = Date.now() - validationStart;

      // ====================================================================
      // Build Success Result
      // ====================================================================
      const totalTime = Date.now() - startTime;

      const stats: CompilationStats = {
        nodeCount: draft.nodes.length,
        taskNodeCount: taskNodes.length,
        branchNodeCount: draft.nodes.filter((n) => n.type === 'branch').length,
        subworkflowNodeCount: 0,
        totalBindings: Array.from(nodeBindings.values()).reduce(
          (sum, b) => sum + b.inputs.length,
          0
        ),
        totalSkippedFields: nodeMetadata.reduce((sum, m) => sum + m.skippedFields.length, 0),
        compilationTimeMs: totalTime,
        taskInterfaceFetches: taskIds.length,
        taskInterfaceCacheHits: this.taskRegistry.getCacheStats().size - taskIds.length,
        timingBreakdown: {
          prefetchTimeMs: prefetchTime,
          nodeCompilationTimeMs: nodeCompilationTime,
          assemblyTimeMs: assemblyTime,
          validationTimeMs: validationTime,
        },
      };

      logger.info('[CompilerV4] ✅ Compilation successful');
      logger.info('[CompilerV4] Stats', { stats });

      const result: CompilationResult = {
        success: true,
        closure,
        workflowId: {
          resourceType: flyteidl.core.ResourceType.WORKFLOW,
          project: draft.project,
          domain: draft.domain,
          name: draft.name,
          version: draft.version,
        },
        stats,
        errors: [],
        warnings,
      };

      // Add debug info if enabled
      if (this.options.includeDebugInfo) {
        result.debug = {
          nodeDetails: nodeMetadata.map((m) => ({
            nodeId: m.nodeId,
            nodeType: 'task',
            bindingMetadata: m,
            compilationTimeMs: m.bindingTimeMs,
          })),
          cacheState: this.taskRegistry.getCacheStats(),
        };
      }

      return result;
    } catch (error) {
      logger.error('[CompilerV4] Compilation failed with exception', error as Error);

      errors.push({
        code: CompilationErrorCode.WORKFLOW_ASSEMBLY_FAILED,
        message: `Compilation failed: ${(error as Error).message}`,
        suggestion: 'Check logs for details',
      });

      return WorkflowCompilerServiceV4.buildFailureResult(draft, errors, warnings, {
        nodeCount: draft.nodes.length,
        taskNodeCount: 0,
        branchNodeCount: 0,
        subworkflowNodeCount: 0,
        totalBindings: 0,
        totalSkippedFields: 0,
        compilationTimeMs: Date.now() - startTime,
        taskInterfaceFetches: 0,
        taskInterfaceCacheHits: 0,
      });
    }
  }

  /**
   * Validate draft without compiling
   */
  async validate(draft: WorkflowDraft): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    // Structural validation
    const structureValidation = WorkflowCompilerServiceV4.validateDraftStructure(draft);
    issues.push(...structureValidation.issues);

    // Node-level validation (parallel for all task and array_map nodes)
    const taskNodes = draft.nodes.filter((n) => n.type === 'task' || n.type === 'array_map');
    const nodeIssuesArrays = await Promise.all(
      taskNodes.map((node) => this.validateTaskNode(node, draft.edges))
    );
    nodeIssuesArrays.forEach((nodeIssues) => {
      issues.push(...nodeIssues);
    });

    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    const infos = issues.filter((i) => i.severity === 'info');

    return {
      valid: errors.length === 0,
      issues,
      errors,
      warnings,
      infos,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Compile a single node (create bindings)
   */
  private async compileNode(
    node: WorkflowBuilderNode,
    edges: any[],
    nodes: WorkflowBuilderNode[]
  ): Promise<{
    nodeId: string;
    bindings: flyteidl.core.IBinding[];
    outputs: Map<string, flyteidl.core.IVariable>;
    metadata?: NodeBindingMetadata;
    errors: CompilationError[];
    warnings: CompilationWarning[];
  }> {
    const nodeStart = Date.now();
    const errors: CompilationError[] = [];
    const warnings: CompilationWarning[] = [];

    try {
      logger.info(
        `[CompilerV4] Compiling node: ${node.id} (${node.data.label}) type: ${node.type}`
      );

      // Handle different node types
      let taskId: TaskId | null = null;
      let interfaceId: any = null;

      if (node.type === 'task' || node.type === 'array_map') {
        if (!node.data.taskId) {
          errors.push({
            code: CompilationErrorCode.MISSING_TASK_ID,
            message: `${node.type === 'array_map' ? 'Array map' : 'Task'} node '${
              node.id
            }' is missing taskId`,
            nodeId: node.id,
            nodeLabel: node.data.label,
          });
          return { nodeId: node.id, bindings: [], outputs: new Map(), errors, warnings };
        }
        const { taskId: nodeTaskId } = node.data;
        taskId = nodeTaskId;
        interfaceId = taskId;
      } else if (node.type === 'subworkflow') {
        if (!node.data.workflowId) {
          errors.push({
            code: CompilationErrorCode.MISSING_TASK_ID,
            message: `Subworkflow node '${node.id}' is missing workflowId`,
            nodeId: node.id,
            nodeLabel: node.data.label,
          });
          return { nodeId: node.id, bindings: [], outputs: new Map(), errors, warnings };
        }
        interfaceId = node.data.workflowId;
      } else {
        // Other node types don't need binding compilation
        return { nodeId: node.id, bindings: [], outputs: new Map(), errors, warnings };
      }

      // Get interface (task, array_map, or subworkflow)
      const taskInterface =
        node.type === 'task' || node.type === 'array_map'
          ? await this.taskRegistry.getTaskInterface(taskId!)
          : await this.taskRegistry.getWorkflowInterface(interfaceId);

      if (!taskInterface) {
        errors.push({
          code: CompilationErrorCode.TASK_INTERFACE_FETCH_FAILED,
          message: `Failed to fetch task interface for node '${node.id}'`,
          nodeId: node.id,
          nodeLabel: node.data.label,
          details: {
            taskId: node.data.taskId,
          },
          suggestion: 'Verify task exists in Flyte and is registered correctly',
        });
        return { nodeId: node.id, bindings: [], outputs: new Map(), errors, warnings };
      }

      // Log inputData structure before binding
      logger.info(`[CompilerV4] Node ${node.id} inputData:`, {
        inputData: node.data.inputData,
        inputDataKeys: node.data.inputData ? Object.keys(node.data.inputData) : [],
        inputDataStructure: JSON.stringify(node.data.inputData, null, 2),
      });

      // Collect field mappings from incoming edges and convert them to inputData
      // IMPORTANT: Do this BEFORE checking if inputData is empty!
      const incomingEdges = edges.filter((e: any) => e.target === node.id);
      const edgeMappings = new Map<string, any[]>(); // sourceNodeId -> fieldMappings[]
      const enhancedInputData = { ...(node.data.inputData || {}) }; // Clone inputData (or empty object) to add field mappings

      logger.info(`[CompilerV4] Node ${node.id} has ${incomingEdges.length} incoming edges`);

      // Process edges sequentially to handle async task interface fetching
      for (let index = 0; index < incomingEdges.length; index += 1) {
        const edge = incomingEdges[index];
        logger.info(`[CompilerV4] Edge ${index}: ${edge.source} → ${edge.target}`, {
          hasData: !!edge.data,
          hasFieldMappings: !!edge.data?.fieldMappings,
          fieldMappingsCount: edge.data?.fieldMappings?.length || 0,
          edgeData: JSON.stringify(edge.data || {}, null, 2),
        });

        if (edge.data?.fieldMappings && edge.data.fieldMappings.length > 0) {
          edgeMappings.set(edge.source, edge.data.fieldMappings);
          logger.info(
            `[CompilerV4] Found ${edge.data.fieldMappings.length} field mappings from ${edge.source} to ${node.id}`
          );

          // Convert field mappings to promise references in inputData
          // IMPORTANT: Need to map JSON schema field names to Flyte variable names
          // eslint-disable-next-line no-restricted-syntax
          for (const mapping of edge.data.fieldMappings) {
            const { sourceField, targetField } = mapping;

            // Get the source node's task interface to map field names
            const sourceNode = nodes.find((n: any) => n.id === edge.source);
            let flyteVariableName = sourceField; // Default to sourceField if we can't map it

            if (sourceNode && sourceNode.data.taskId) {
              try {
                // eslint-disable-next-line no-await-in-loop
                const sourceTaskInterface = await this.taskRegistry.getTaskInterface(
                  sourceNode.data.taskId
                );

                // Map JSON schema field name to Flyte variable name
                // For single-output tasks, the JSON schema field maps to the only output variable
                if (sourceTaskInterface && sourceTaskInterface.outputs.size === 1) {
                  const [onlyOutputName] = Array.from(sourceTaskInterface.outputs.keys());
                  flyteVariableName = onlyOutputName;
                  logger.info(
                    `[CompilerV4] Mapped JSON schema field '${sourceField}' to Flyte variable '${flyteVariableName}' (single output)`
                  );
                } else if (sourceTaskInterface && sourceTaskInterface.outputs.has(sourceField)) {
                  // Multi-output task: check if sourceField exists as a Flyte variable
                  flyteVariableName = sourceField;
                  logger.info(
                    `[CompilerV4] Using Flyte variable '${flyteVariableName}' (found in outputs)`
                  );
                } else if (sourceTaskInterface) {
                  // Try to find by matching - check if any output variable name matches
                  const matchingVar = Array.from(sourceTaskInterface.outputs.keys()).find(
                    (varName) => varName.toLowerCase() === sourceField.toLowerCase()
                  );
                  if (matchingVar) {
                    flyteVariableName = matchingVar;
                    logger.info(
                      `[CompilerV4] Mapped JSON schema field '${sourceField}' to Flyte variable '${flyteVariableName}' (case-insensitive match)`
                    );
                  } else {
                    logger.warn(
                      `[CompilerV4] Could not map JSON schema field '${sourceField}' to Flyte variable, using as-is`
                    );
                  }
                }
              } catch (error) {
                logger.warn(
                  `[CompilerV4] Failed to fetch source task interface for field mapping: ${
                    (error as Error).message
                  }`
                );
              }
            }

            // Create promise reference: $node.sourceNodeId.flyteVariableName
            const promiseReference = `$node.${edge.source}.${flyteVariableName}`;

            // Only add if target field doesn't already have a value
            if (
              !(targetField in enhancedInputData) ||
              enhancedInputData[targetField] === undefined ||
              enhancedInputData[targetField] === null ||
              enhancedInputData[targetField] === ''
            ) {
              enhancedInputData[targetField] = promiseReference;
              logger.info(`[CompilerV4] ✓ Mapped field: ${targetField} = ${promiseReference}`);
            } else {
              logger.info(
                `[CompilerV4] ⚠ Target field ${targetField} already has value, skipping field mapping`
              );
            }
          }
        }
      }

      // Check if we have any input data (either from node.data.inputData or field mappings)
      if (Object.keys(enhancedInputData).length === 0) {
        logger.info(
          `[CompilerV4] Node ${node.id} has no inputData and no field mappings, skipping binding`
        );
        return { nodeId: node.id, bindings: [], outputs: taskInterface.outputs, errors, warnings };
      }

      logger.info(`[CompilerV4] Node ${node.id} enhanced inputData:`, {
        enhancedInputData,
        enhancedInputDataKeys: Object.keys(enhancedInputData),
        enhancedInputDataStructure: JSON.stringify(enhancedInputData, null, 2),
      });

      // Log task interface structure
      logger.info(`[CompilerV4] Node ${node.id} taskInterface:`, {
        taskId: taskInterface.taskId,
        hasInputs: !!taskInterface.inputs,
        inputsType: taskInterface.inputs?.constructor?.name,
        inputsSize: taskInterface.inputs instanceof Map ? taskInterface.inputs.size : 'N/A',
        inputKeys:
          taskInterface.inputs instanceof Map ? Array.from(taskInterface.inputs.keys()) : 'N/A',
        hasOutputs: !!taskInterface.outputs,
        outputsType: taskInterface.outputs?.constructor?.name,
        outputsSize: taskInterface.outputs instanceof Map ? taskInterface.outputs.size : 'N/A',
      });

      // Create bindings with enhanced inputData that includes field mappings
      // Note: Field mappings have already been resolved to Flyte variable names in enhancedInputData
      // so we don't pass edgeMappings to avoid double-mapping
      const bindingResult = this.bindingEngine.createBindings(enhancedInputData, taskInterface);

      // Convert binding errors to compilation errors
      bindingResult.errors.forEach((err) => {
        errors.push({
          code: CompilationErrorCode.BINDING_FAILED,
          message: err.message,
          nodeId: node.id,
          nodeLabel: node.data.label,
          details: {
            field: err.field,
            expectedType: err.expectedType,
            actualValue: err.actualValue,
            actualType: err.actualType,
          },
          suggestion: err.suggestion,
        });
      });

      // Convert binding warnings to compilation warnings
      bindingResult.warnings.forEach((warn) => {
        warnings.push({
          code: CompilationWarningCode.BINDING_WARNING,
          message: warn.message,
          nodeId: node.id,
          nodeLabel: node.data.label,
          action: warn.action,
        });
      });

      // Build metadata using enhancedInputData (which includes field mappings)
      const metadata: NodeBindingMetadata = {
        nodeId: node.id,
        taskId: node.data.taskId!, // We know taskId exists because we fetched taskInterface
        boundParameters: bindingResult.bindings.map((b) => {
          const varName = b.var!;
          const value = enhancedInputData[varName];
          const isString = typeof value === 'string';

          let sourceType: 'upstream' | 'workflow-input' | 'static';
          if (isString && value.startsWith('$node.')) {
            sourceType = 'upstream';
          } else if (isString && value.startsWith('$workflow.')) {
            sourceType = 'workflow-input';
          } else {
            sourceType = 'static';
          }

          return {
            name: varName,
            type: taskInterface.inputs.get(varName)!.type,
            sourceType,
            value,
          };
        }),
        skippedFields: bindingResult.skipped.map((field) => ({
          name: field,
          reason: 'not-in-task-interface',
          value: enhancedInputData[field],
        })),
        errors: bindingResult.errors,
        warnings: bindingResult.warnings,
        bindingTimeMs: Date.now() - nodeStart,
        taskInterfaceCacheHit: true, // Approximate
      };

      logger.info(
        `[CompilerV4] Node ${node.id}: ${bindingResult.bindings.length} bindings, ${bindingResult.skipped.length} skipped, ${bindingResult.errors.length} errors`
      );

      return {
        nodeId: node.id,
        bindings: bindingResult.bindings,
        outputs: taskInterface.outputs,
        metadata,
        errors,
        warnings,
      };
    } catch (error) {
      logger.error(`[CompilerV4] Failed to compile node ${node.id}`, error as Error);

      errors.push({
        code: CompilationErrorCode.BINDING_FAILED,
        message: `Node compilation failed: ${(error as Error).message}`,
        nodeId: node.id,
        nodeLabel: node.data.label,
      });

      return { nodeId: node.id, bindings: [], outputs: new Map(), errors, warnings };
    }
  }

  /**
   * Extract task IDs from draft (includes array_map nodes)
   */
  private static extractTaskIds(draft: WorkflowDraft): TaskId[] {
    return draft.nodes
      .filter((node) => (node.type === 'task' || node.type === 'array_map') && node.data.taskId)
      .map((node) => node.data.taskId!);
  }

  /**
   * Validate draft structure
   */
  private static validateDraftStructure(draft: WorkflowDraft): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Note: Start/End nodes are UI-only constructs
    // Flyte automatically figures out workflow start/end from the task graph
    // So we don't validate for their presence

    // Check for orphaned nodes (warning only)
    const connectedNodes = new Set<string>();
    draft.edges.forEach((e) => {
      connectedNodes.add(e.source);
      connectedNodes.add(e.target);
    });

    draft.nodes.forEach((node) => {
      // Only check actual task/branch nodes, not UI-only start/end nodes
      if (node.type !== 'start' && node.type !== 'end' && !connectedNodes.has(node.id)) {
        issues.push({
          severity: 'warning',
          code: 'ORPHANED_NODE',
          message: `Node '${node.data.label || node.id}' is not connected`,
          nodeId: node.id,
        });
      }
    });

    // Check for at least one task node
    const taskNodes = draft.nodes.filter(
      (n) => n.type === 'task' || n.type === 'array_map' || n.type === 'branch'
    );
    if (taskNodes.length === 0) {
      issues.push({
        severity: 'error',
        code: 'NO_TASK_NODES',
        message: 'Workflow must have at least one task, array_map, or branch node',
      });
    }

    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    const infos = issues.filter((i) => i.severity === 'info');

    return {
      valid: errors.length === 0,
      issues,
      errors,
      warnings,
      infos,
    };
  }

  /**
   * Validate task node
   */
  private async validateTaskNode(
    node: WorkflowBuilderNode,
    edges: any[]
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    if (!node.data.taskId) {
      issues.push({
        severity: 'error',
        code: 'MISSING_TASK_ID',
        message: `Task node '${node.data.label || node.id}' is missing taskId`,
        nodeId: node.id,
      });
      return issues;
    }

    // Check if task interface can be fetched
    const taskInterface = await this.taskRegistry.getTaskInterface(node.data.taskId);
    if (!taskInterface) {
      issues.push({
        severity: 'error',
        code: 'TASK_NOT_FOUND',
        message: `Task '${node.data.taskId.name}' not found in Flyte`,
        nodeId: node.id,
      });
      return issues;
    }

    // Validate required inputs are provided via inputData OR edge field mappings
    const inputSchema = taskInterface.inputs;
    if (inputSchema && inputSchema.size > 0) {
      const requiredFields = Array.from(inputSchema.entries())
        .filter(([, variable]) => !variable.optional)
        .map(([name]) => name);
      const inputData = node.data.inputData || {};

      // Get fields mapped from incoming edges
      const mappedFields = new Set<string>();
      const incomingEdges = edges.filter((edge: any) => edge.target === node.id);
      incomingEdges.forEach((edge: any) => {
        const fieldMappings = edge.data?.fieldMappings || [];
        fieldMappings.forEach((mapping: any) => {
          mappedFields.add(mapping.targetField);
        });
      });

      // Check each required field
      requiredFields.forEach((fieldName: string) => {
        const inputValue = inputData[fieldName];

        // Check if field has a value (literal or promise reference)
        const hasInputData =
          fieldName in inputData &&
          inputValue !== undefined &&
          inputValue !== null &&
          inputValue !== '';

        // Check if field is mapped via an edge
        const hasMappedField = mappedFields.has(fieldName);

        // Check if the value is a promise reference (will be bound at compile time)
        const isPromiseReference =
          typeof inputValue === 'string' &&
          (inputValue.startsWith('$node.') || inputValue.startsWith('$workflow.'));

        // Field is satisfied if it has inputData, a mapping, OR is a promise reference
        if (!hasInputData && !hasMappedField && !isPromiseReference) {
          issues.push({
            severity: 'error',
            code: 'MISSING_REQUIRED_INPUT',
            message: `Required input '${fieldName}' is not provided for task '${
              node.data.label || node.id
            }'`,
            nodeId: node.id,
            field: fieldName,
          });
        }
      });
    }

    return issues;
  }

  /**
   * Get required fields from JSON schema
   */
  private static getRequiredFields(schema: any): string[] {
    if (!schema.properties) {
      return [];
    }

    const required = schema.required || [];
    return required.filter((fieldName: string) => fieldName in schema.properties);
  }

  /**
   * Validate compiled closure
   */
  private static validateClosure(
    closure: flyteidl.core.ICompiledWorkflowClosure
  ): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Basic structure checks
    if (!closure.primary) {
      issues.push({
        severity: 'error',
        code: 'INVALID_CLOSURE',
        message: 'Closure missing primary workflow',
      });
    }

    if (!closure.primary?.template) {
      issues.push({
        severity: 'error',
        code: 'INVALID_CLOSURE',
        message: 'Closure missing workflow template',
      });
    }

    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');
    const infos = issues.filter((i) => i.severity === 'info');

    return {
      valid: errors.length === 0,
      issues,
      errors,
      warnings,
      infos,
    };
  }

  /**
   * Build failure result
   */
  private static buildFailureResult(
    draft: WorkflowDraft,
    errors: CompilationError[],
    warnings: CompilationWarning[],
    stats: CompilationStats
  ): CompilationResult {
    return {
      success: false,
      workflowId: {
        resourceType: flyteidl.core.ResourceType.WORKFLOW,
        project: draft.project,
        domain: draft.domain,
        name: draft.name,
        version: draft.version,
      },
      stats,
      errors,
      warnings,
    };
  }

  /**
   * Convert validation issues to compilation errors
   */
  private static validationIssuesToCompilationErrors(
    issues: ValidationIssue[]
  ): CompilationError[] {
    return issues.map((issue) => ({
      code: issue.code as CompilationErrorCode,
      message: issue.message,
      nodeId: issue.nodeId,
      suggestion: issue.suggestion,
    }));
  }

  /**
   * Convert validation issues to compilation warnings
   */
  private static validationIssuesToCompilationWarnings(
    issues: ValidationIssue[]
  ): CompilationWarning[] {
    return issues.map((issue) => ({
      code: issue.code as CompilationWarningCode,
      message: issue.message,
      nodeId: issue.nodeId,
    }));
  }
}
