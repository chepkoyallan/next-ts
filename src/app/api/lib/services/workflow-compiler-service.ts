/**
 * Workflow Compiler Service
 * Converts WorkflowDraft JSON to Flyte protobuf structures
 */

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import type { TaskInterfaceService } from './task-interface-service';
import type {
  WorkflowDraft,
  WorkflowBuilderNode,
  WorkflowBuilderEdge,
} from './workflow-draft-service';

/**
 * Compilation result containing the full workflow closure
 */
export interface CompilationResult {
  closure: flyteidl.core.ICompiledWorkflowClosure;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    taskCount: number;
    branchCount: number;
    gateCount: number;
  };
}

/**
 * Compilation error (exported as standard error, not a class to avoid max-classes-per-file)
 */
export function CompilationError(message: string, nodeId?: string, details?: any): Error {
  const error = new Error(message);
  error.name = 'CompilationError';
  (error as any).nodeId = nodeId;
  (error as any).details = details;
  return error;
}

/**
 * Workflow Compiler Service
 */
export class WorkflowCompilerService {
  private taskInterfaceService?: TaskInterfaceService;

  /**
   * Set task interface service for intelligent wrapping detection
   */
  setTaskInterfaceService(service: TaskInterfaceService): void {
    this.taskInterfaceService = service;
    console.log('[Compiler] Task interface service configured');
  }

  /**
   * Validate workflow configuration before compilation
   * Catches common issues that would cause Flyte validation errors
   */
  private validateWorkflowConfiguration(draft: WorkflowDraft): void {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check 1: Nodes with missing schemas
    draft.nodes.forEach((node) => {
      if (node.type === 'task') {
        if (!node.data.inputSchema) {
          errors.push(
            `Task node '${node.data.label || node.id}' is missing input schema. ` +
              `Please ensure the task is properly registered in the system.`
          );
        }
        if (!node.data.outputSchema) {
          warnings.push(
            `Task node '${node.data.label || node.id}' is missing output schema. ` +
              `This may cause issues with data flow between nodes.`
          );
        }
      }
    });

    // Check 2: Edges without field mappings connecting to nodes that need data
    draft.edges.forEach((edge) => {
      const targetNode = draft.nodes.find((n) => n.id === edge.target);
      const sourceNode = draft.nodes.find((n) => n.id === edge.source);

      if (!targetNode || !sourceNode) return;

      // Check if this is a data edge (not execution-only)
      const isDataEdge = edge.type !== 'execution-path';
      const hasFieldMappings = edge.data?.fieldMappings && edge.data.fieldMappings.length > 0;
      // const targetHasInputData =
      //   (targetNode.data as any).inputData &&
      //   Object.keys((targetNode.data as any).inputData).length > 0;

      if (isDataEdge && !hasFieldMappings && targetNode.type !== 'end') {
        // Check if target node has required fields that aren't filled with static data
        if (targetNode.data.inputSchema?.required) {
          const requiredFields = targetNode.data.inputSchema.required;
          const staticInputData = (targetNode.data as any).inputData || {};

          const missingFields = requiredFields.filter((field: string) => !staticInputData[field]);

          if (missingFields.length > 0) {
            warnings.push(
              `Edge from '${sourceNode.data.label || edge.source}' to '${
                targetNode.data.label || edge.target
              }' ` +
                `has no field mappings configured. Target node requires: ${missingFields.join(
                  ', '
                )}. ` +
                `Please configure field mappings or provide static values for these fields.`
            );
          }
        }
      }
    });

    // Check 3: Branch nodes with conditions referencing fields that won't be available
    draft.nodes.forEach((node) => {
      if (node.type === 'branch' && node.data.branchConfig) {
        const { branchConfig } = node.data;
        const primaryCondition = branchConfig.primaryCase?.condition;

        // Extract field references from condition
        const fieldReferences = this.extractFieldReferencesFromCondition(primaryCondition);

        if (fieldReferences.length > 0) {
          // Check if branch has incoming edges
          const incomingEdges = draft.edges.filter((e) => e.target === node.id);

          if (incomingEdges.length === 0) {
            errors.push(
              `Branch node '${
                node.data.label || node.id
              }' condition references fields [${fieldReferences.join(', ')}] ` +
                `but has no incoming connections. Please connect a task node to provide these fields.`
            );
            return;
          }

          // NEW: Check if source node has output schema with the required fields
          // If explicit field mappings don't exist, we'll auto-generate them from output schema
          const sourceNode = draft.nodes.find((n) => n.id === incomingEdges[0].source);

          if (!sourceNode) {
            errors.push(
              `Branch node '${node.data.label || node.id}' has an invalid incoming connection.`
            );
            return;
          }

          // Check explicit field mappings
          const mappedFields = new Set<string>();
          incomingEdges.forEach((edge) => {
            edge.data?.fieldMappings?.forEach((mapping) => {
              mappedFields.add(mapping.targetField);
            });
          });

          // Check source output schema for auto-generated bindings
          const sourceOutputFields = sourceNode.data.outputSchema?.properties
            ? Object.keys(sourceNode.data.outputSchema.properties)
            : [];

          const availableFields = new Set([...Array.from(mappedFields), ...sourceOutputFields]);
          const missingFields = fieldReferences.filter((field) => !availableFields.has(field));

          if (missingFields.length > 0) {
            errors.push(
              `Branch node '${
                node.data.label || node.id
              }' condition references fields [${missingFields.join(', ')}] ` +
                `but source node '${
                  sourceNode.data.label || sourceNode.id
                }' does not provide these fields. ` +
                `Source outputs: [${sourceOutputFields.join(', ') || 'none'}]. ` +
                `Please ensure the source task returns the required fields.`
            );
          }
        }
      }
    });

    // If there are errors, throw compilation error
    if (errors.length > 0) {
      const errorMessage = `Workflow configuration validation failed:\n\n${errors
        .map((e, i) => `${i + 1}. ${e}`)
        .join('\n\n')}${
        warnings.length > 0
          ? `\n\nWarnings:\n${warnings.map((w, i) => `${i + 1}. ${w}`).join('\n')}`
          : ''
      }`;

      console.error('[Compiler] ❌ Configuration validation failed');
      errors.forEach((e) => console.error(`[Compiler]   - ${e}`));
      throw CompilationError(errorMessage);
    }

    // Log warnings
    if (warnings.length > 0) {
      console.warn('[Compiler] ⚠️ Configuration warnings:');
      warnings.forEach((w) => console.warn(`[Compiler]   - ${w}`));
    }
  }

  /**
   * Extract field references from a branch condition
   */
  private extractFieldReferencesFromCondition(condition: any): string[] {
    if (!condition) return [];

    const fields: string[] = [];

    // Unwrap condition type wrapper
    if (condition.type === 'comparison' && condition.expression) {
      condition = condition.expression;
    }

    // Extract from comparison
    if (condition.leftValue?.type === 'field' && condition.leftValue.field) {
      fields.push(condition.leftValue.field);
    }
    if (condition.rightValue?.type === 'field' && condition.rightValue.field) {
      fields.push(condition.rightValue.field);
    }

    // Recursively extract from conjunction (AND/OR)
    if (condition.conjunction) {
      fields.push(...this.extractFieldReferencesFromCondition(condition.conjunction.left));
      fields.push(...this.extractFieldReferencesFromCondition(condition.conjunction.right));
    }

    return Array.from(new Set(fields)); // Remove duplicates
  }

  /**
   * Compile a workflow draft to Flyte protobuf format (NOW ASYNC)
   */
  async compile(draft: WorkflowDraft): Promise<CompilationResult> {
    console.log('[Compiler] ===== COMPILATION STARTED =====');
    console.log(
      `[Compiler] Workflow: ${draft.project}/${draft.domain}/${draft.name}:${draft.version}`
    );
    console.log(`[Compiler] Nodes: ${draft.nodes.length}, Edges: ${draft.edges.length}`);

    try {
      // Pre-validation: Check for common configuration issues
      this.validateWorkflowConfiguration(draft);

      // Build workflow template (now async)
      const template = await this.compileWorkflowTemplate(draft);

      // Build connections
      const connections = WorkflowCompilerService.compileConnections(draft.nodes, draft.edges);

      // Build primary workflow
      const primary: flyteidl.core.ICompiledWorkflow = {
        template,
        connections,
      };

      // NOTE: Tasks should already be registered in Flyte separately
      // We should NOT include task templates in the workflow closure
      // Only include task REFERENCES in the workflow nodes
      const tasks: flyteidl.core.ICompiledTask[] = [];

      // Build sub-workflows (for complex branches if needed)
      const subWorkflows: flyteidl.core.ICompiledWorkflow[] = [];

      // Build closure
      const closure: flyteidl.core.ICompiledWorkflowClosure = {
        primary,
        tasks, // Empty - tasks are registered separately
        subWorkflows,
      };

      // Calculate metadata
      const metadata = {
        nodeCount: draft.nodes.length,
        edgeCount: draft.edges.length,
        taskCount: draft.nodes.filter((n) => n.type === 'task').length,
        branchCount: draft.nodes.filter((n) => n.type === 'branch').length,
        gateCount: draft.nodes.filter((n) => n.type === 'gate').length,
      };

      console.log('[Compiler] ✅ Compilation successful:', {
        nodes: metadata.nodeCount,
        tasks: metadata.taskCount,
        branches: metadata.branchCount,
        inputs: Object.keys(template.interface?.inputs?.variables || {}).length,
        outputs: Object.keys(template.interface?.outputs?.variables || {}).length,
      });

      return { closure, metadata };
    } catch (error: any) {
      console.error('[Compiler] ===== COMPILATION FAILED =====');
      console.error(`[Compiler] Error: ${error.message}`);
      if ((error as any).nodeId) {
        console.error(`[Compiler] Failed at node: ${(error as any).nodeId}`);
      }
      if (error.name === 'CompilationError') {
        throw error;
      }
      throw CompilationError(`Workflow compilation failed: ${error.message}`, undefined, error);
    }
  }

  /**
   * Compile workflow template (NOW ASYNC)
   */
  private async compileWorkflowTemplate(
    draft: WorkflowDraft
  ): Promise<flyteidl.core.IWorkflowTemplate> {
    // Build workflow identifier
    const id: flyteidl.core.IIdentifier = {
      resourceType: flyteidl.core.ResourceType.WORKFLOW,
      project: draft.project,
      domain: draft.domain,
      name: draft.name,
      version: draft.version,
    };

    // Build workflow metadata
    const metadata: flyteidl.core.IWorkflowMetadata = {
      onFailure: flyteidl.core.WorkflowMetadata.OnFailurePolicy.FAIL_IMMEDIATELY,
    };

    // Build nodes (now async)
    const nodes = await this.compileNodes(draft.nodes, draft.edges);

    // Build workflow interface (inputs/outputs)
    const workflowInterface = this.compileWorkflowInterface(draft);

    // Build output bindings
    const outputs = WorkflowCompilerService.compileWorkflowOutputs(draft.nodes, draft.edges);

    return {
      id,
      metadata,
      interface: workflowInterface,
      nodes,
      outputs,
    };
  }

  /**
   * Compile workflow interface (inputs/outputs)
   * CRITICAL FIX: Interface must EXACTLY match what compileWorkflowOutputs produces
   */
  private compileWorkflowInterface(draft: WorkflowDraft): flyteidl.core.ITypedInterface {
    // Find first node (nodes that have no incoming edges, excluding start)
    const firstNodes = draft.nodes.filter(
      (n) => n.type !== 'start' && !draft.edges.some((e) => e.target === n.id)
    );

    // CRITICAL: Identify branch-embedded nodes (same logic as compileNodes and compileWorkflowOutputs)
    const branchTargetIds = new Set<string>();
    draft.nodes
      .filter((n) => n.type === 'branch')
      .forEach((branchNode) => {
        const config = branchNode.data.branchConfig;
        if (config) {
          if (config.primaryCase?.thenNodeId) {
            branchTargetIds.add(config.primaryCase.thenNodeId);
          }
          config.elseCases?.forEach((elseCase: any) => {
            if (elseCase.thenNodeId) {
              branchTargetIds.add(elseCase.thenNodeId);
            }
          });
          if (config.elseNodeId) {
            branchTargetIds.add(config.elseNodeId);
          }
        }
      });

    // Find last node (nodes that have no outgoing edges, excluding end)
    // EXCLUDE branch-embedded nodes from consideration
    const lastNodes = draft.nodes.filter((n) => {
      if (n.type === 'end' || n.type === 'start') return false;

      // CRITICAL: Skip branch-embedded nodes
      if (branchTargetIds.has(n.id)) return false;

      const outgoing = draft.edges.filter((e) => e.source === n.id);
      if (outgoing.length === 0) return true;
      return outgoing.every((e) => {
        const target = draft.nodes.find((node) => node.id === e.target);
        return target?.type === 'end';
      });
    });

    // Extract inputs from first task node
    let inputs: flyteidl.core.IVariableMap | undefined;
    const firstTaskNode = firstNodes.find((n) => n.type === 'task');
    if (firstTaskNode?.data.inputSchema && firstTaskNode.data.inputSchema.properties) {
      inputs = this.schemaToVariableMap(firstTaskNode.data.inputSchema);
    }

    // If no inputs found from first node, create minimal default input
    if (!inputs || !inputs.variables || Object.keys(inputs.variables).length === 0) {
      console.log('[Compiler] ⚠️  No workflow inputs found, creating default input parameter');
      inputs = {
        variables: {
          workflow_input: {
            type: {
              simple: flyteidl.core.SimpleType.STRUCT,
            },
            description: 'Default workflow input',
          },
        },
      };
    }

    // ===== CRITICAL FIX: Match outputs with compileWorkflowOutputs exactly =====
    // Extract outputs from last task/branch node
    let outputs: flyteidl.core.IVariableMap | undefined;

    // Check if workflow ends with a branch node
    const lastBranchNode = lastNodes.find((n) => n.type === 'branch');
    if (lastBranchNode) {
      console.log('[Compiler] Workflow ends with branch node - using generic output');
      // Branch nodes use single generic 'output' variable (matches compileWorkflowOutputs)
      outputs = {
        variables: {
          output: {
            type: {
              simple: flyteidl.core.SimpleType.STRUCT,
            },
            description: 'Branch node output',
          },
        },
      };
    } else {
      // Normal case: workflow ends with task nodes
      const taskNodes = lastNodes.filter((node) => node.type === 'task');

      if (taskNodes.length === 1) {
        // Single output - use simple 'output' name (MATCHES compileWorkflowOutputs)
        const lastTaskNode = taskNodes[0];
        if (lastTaskNode?.data.outputSchema && lastTaskNode.data.outputSchema.properties) {
          // Use task's output schema if available
          outputs = this.schemaToVariableMap(lastTaskNode.data.outputSchema);
        } else {
          // Fallback to generic 'output' variable
          console.log('[Compiler] ⚠️  Last task node has no output schema, using generic output');
          outputs = {
            variables: {
              output: {
                type: {
                  simple: flyteidl.core.SimpleType.STRUCT,
                },
                description: 'Task output',
              },
            },
          };
        }
      } else if (taskNodes.length > 1) {
        // Multiple outputs - generate unique names (MATCHES compileWorkflowOutputs)
        console.log(
          `[Compiler] ⚠️  Multiple output nodes detected (${taskNodes.length}), generating unique output names`
        );
        const outputVariables: { [key: string]: flyteidl.core.IVariable } = {};

        taskNodes.forEach((node) => {
          // Use same naming logic as compileWorkflowOutputs
          const nodeName = (node.data.label || node.id)
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^[0-9]/, 'output_$&');

          const nodeIdSuffix = node.id.replace(/[^a-z0-9_]/g, '_');
          const outputVarName = `${nodeName}_${nodeIdSuffix}_output`;

          outputVariables[outputVarName] = {
            type: {
              simple: flyteidl.core.SimpleType.STRUCT,
            },
            description: `Output from ${node.data.label || node.id}`,
          };
        });

        outputs = {
          variables: outputVariables,
        };
      } else {
        // No task or branch nodes found - create default
        console.log('[Compiler] ⚠️  No task or branch nodes found as workflow outputs');
        outputs = {
          variables: {
            output: {
              type: {
                simple: flyteidl.core.SimpleType.STRUCT,
              },
              description: 'Default workflow output',
            },
          },
        };
      }
    }

    return {
      inputs,
      outputs,
    };
  }

  /**
   * Convert JSON schema to Flyte VariableMap
   */
  private schemaToVariableMap(schema: any): flyteidl.core.IVariableMap {
    const variables: { [key: string]: flyteidl.core.IVariable } = {};

    if (schema.properties) {
      Object.entries(schema.properties).forEach(([fieldName, fieldSchema]) => {
        const field = fieldSchema as any;
        variables[fieldName] = {
          type: this.jsonTypeToLiteralType(field),
          description: field.description || '',
        };
      });
    }

    return { variables };
  }

  /**
   * Convert JSON schema type to Flyte LiteralType
   */
  private jsonTypeToLiteralType(field: any): flyteidl.core.ILiteralType {
    switch (field.type) {
      case 'string':
        return {
          simple: flyteidl.core.SimpleType.STRING,
        };
      case 'integer':
        return {
          simple: flyteidl.core.SimpleType.INTEGER,
        };
      case 'number':
        return {
          simple: flyteidl.core.SimpleType.FLOAT,
        };
      case 'boolean':
        return {
          simple: flyteidl.core.SimpleType.BOOLEAN,
        };
      case 'array':
        return {
          collectionType: field.items
            ? this.jsonTypeToLiteralType(field.items)
            : { simple: flyteidl.core.SimpleType.STRING },
        };
      case 'object':
        return {
          simple: flyteidl.core.SimpleType.STRUCT,
        };
      default:
        return {
          simple: flyteidl.core.SimpleType.STRING,
        };
    }
  }

  /**
   * Compile nodes to Flyte Node format (NOW ASYNC)
   * CRITICAL: Exclude nodes that are embedded in branches (thenNode/elseNode)
   * Those nodes should ONLY exist inline within branch definitions, not at top-level
   */
  private async compileNodes(
    nodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): Promise<flyteidl.core.INode[]> {
    // Collect all node IDs that are referenced as branch targets
    const branchTargetIds = new Set<string>();

    nodes
      .filter((n) => n.type === 'branch')
      .forEach((branchNode) => {
        const config = branchNode.data.branchConfig;
        if (config) {
          // Add primary case target
          if (config.primaryCase?.thenNodeId) {
            branchTargetIds.add(config.primaryCase.thenNodeId);
          }

          // Add else-if case targets
          config.elseCases?.forEach((elseCase: any) => {
            if (elseCase.thenNodeId) {
              branchTargetIds.add(elseCase.thenNodeId);
            }
          });

          // Add else default target
          if (config.elseNodeId) {
            branchTargetIds.add(config.elseNodeId);
          }
        }
      });

    // Filter out start, end, and branch-embedded nodes
    const nodesToCompile = nodes.filter((node) => {
      if (node.type === 'start' || node.type === 'end') return false;
      if (branchTargetIds.has(node.id)) return false;
      return true;
    });

    // Compile nodes in parallel for better performance
    const compiledNodes = await Promise.all(
      nodesToCompile.map((node) => this.compileNode(node, nodes, edges))
    );

    return compiledNodes.filter((compiled): compiled is flyteidl.core.INode => compiled !== null);
  }

  /**
   * Compile a single node (NOW ASYNC)
   */
  private async compileNode(
    node: WorkflowBuilderNode,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): Promise<flyteidl.core.INode | null> {
    // Build node metadata
    const metadata: flyteidl.core.INodeMetadata = {
      name: node.data.label || node.id,
      timeout: node.data.config?.timeout ? { seconds: node.data.config.timeout } : undefined,
      retries: node.data.config?.retries
        ? {
            retries: node.data.config.retries,
          }
        : undefined,
    };

    // Get upstream node IDs
    const upstreamNodeIds = edges
      .filter((e) => e.target === node.id)
      .map((e) => e.source)
      .filter((id) => {
        const sourceNode = allNodes.find((n) => n.id === id);
        return sourceNode && sourceNode.type !== 'start';
      });

    // Build input bindings (now async)
    const inputs = await this.compileNodeInputs(node, allNodes, edges);

    // Build node based on type
    const compiledNode: flyteidl.core.INode = {
      id: node.id,
      metadata,
      inputs,
      upstreamNodeIds,
    };

    switch (node.type) {
      case 'task':
        compiledNode.taskNode = WorkflowCompilerService.compileTaskNode(node);
        break;
      case 'branch':
        compiledNode.branchNode = await this.compileBranchNode(node, allNodes, edges);
        break;
      case 'gate':
        compiledNode.gateNode = WorkflowCompilerService.compileGateNode(node);
        break;
      case 'subworkflow':
        compiledNode.workflowNode = WorkflowCompilerService.compileWorkflowNode(node);
        break;
      default:
        throw CompilationError(`Unknown node type: ${node.type}`, node.id);
    }

    return compiledNode;
  }

  /**
   * Compile task node
   */
  private static compileTaskNode(node: WorkflowBuilderNode): flyteidl.core.ITaskNode {
    if (!node.data.taskId) {
      throw CompilationError('Task node missing taskId', node.id);
    }

    const referenceId: flyteidl.core.IIdentifier = {
      resourceType: flyteidl.core.ResourceType.TASK,
      project: node.data.taskId.project,
      domain: node.data.taskId.domain,
      name: node.data.taskId.name,
      version: node.data.taskId.version,
    };

    return {
      referenceId,
    };
  }

  /**
   * Compile branch node (NOW ASYNC)
   * IMPORTANT: Branch nodes in Flyte contain INLINE node structures for then/else paths
   * These are not references - they are full node definitions
   */
  private async compileBranchNode(
    node: WorkflowBuilderNode,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): Promise<flyteidl.core.IBranchNode> {
    if (!node.data.branchConfig) {
      throw CompilationError('Branch node missing branchConfig', node.id);
    }

    const config = node.data.branchConfig;

    // Get upstream node for condition compilation
    // Branch conditions need to know which node's output to reference
    const upstreamEdges = edges.filter((e) => e.target === node.id);
    const upstreamNodeId = upstreamEdges.length > 0 ? upstreamEdges[0].source : null;

    // Build primary IF case with INLINE node compilation
    const primaryCase: flyteidl.core.IIfBlock = {
      condition: this.compileBooleanExpression(config.primaryCase.condition, upstreamNodeId),
      thenNode: await this.compileNodeForBranch(
        config.primaryCase.thenNodeId,
        node.id, // ← NEW: Pass branch node ID
        allNodes,
        edges
      ),
    };

    // Build other ELSE-IF cases with INLINE node compilation
    const otherCases: flyteidl.core.IIfBlock[] = await Promise.all(
      config.elseCases.map(async (elseCase) => ({
        condition: this.compileBooleanExpression(elseCase.condition, upstreamNodeId),
        thenNode: await this.compileNodeForBranch(
          elseCase.thenNodeId,
          node.id, // ← NEW: Pass branch node ID
          allNodes,
          edges
        ),
      }))
    );

    // Build ELSE default case with INLINE node compilation
    const elseNode = config.elseNodeId
      ? await this.compileNodeForBranch(
          config.elseNodeId,
          node.id, // ← NEW: Pass branch node ID
          allNodes,
          edges
        )
      : undefined;

    const ifElse: flyteidl.core.IIfElseBlock = {
      case: primaryCase,
      other: otherCases,
      elseNode,
    };

    return {
      ifElse,
    };
  }

  /**
   * Compile a node for use within a branch (inline compilation) - NOW ASYNC
   * Returns a full node structure to be embedded in the branch
   * CRITICAL: Inline nodes should NOT have upstreamNodeIds AND should NOT reference parent branch
   */
  private async compileNodeForBranch(
    nodeId: string,
    branchNodeId: string, // ← NEW PARAMETER
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): Promise<flyteidl.core.INode | undefined> {
    const targetNode = allNodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      console.warn(`[Compiler] Branch target node '${nodeId}' not found`);
      return undefined;
    }

    // Build node metadata
    const metadata: flyteidl.core.INodeMetadata = {
      name: targetNode.data.label || targetNode.id,
      timeout: targetNode.data.config?.timeout
        ? { seconds: targetNode.data.config.timeout }
        : undefined,
      retries: targetNode.data.config?.retries
        ? {
            retries: targetNode.data.config.retries,
          }
        : undefined,
    };

    // CRITICAL: For inline branch nodes, do NOT set upstreamNodeIds
    // These nodes are embedded definitions, not part of the workflow graph
    // Setting upstream IDs creates circular dependencies (node references its parent branch)
    const upstreamNodeIds: string[] = [];

    // CRITICAL FIX: Filter out edges that would create circular references
    // Branch-embedded nodes should NOT reference the branch node itself
    // They should only reference nodes BEFORE the branch
    const filteredEdges = edges.filter((edge) => {
      // Exclude edges FROM the branch node TO the embedded node
      if (edge.source === branchNodeId && edge.target === targetNode.id) {
        return false;
      }
      return true;
    });

    // Build input bindings with filtered edges to prevent circular references
    const inputs = await this.compileNodeInputs(targetNode, allNodes, filteredEdges);

    // CRITICAL: If embedded node has NO inputs from edges, it should inherit from branch
    if (inputs.length === 0 || !inputs.some((b) => b.binding?.promise)) {
      // Find what the branch node receives as input
      const branchInputEdges = edges.filter((e) => e.target === branchNodeId);

      if (branchInputEdges.length > 0) {
        const sourceNodeId = branchInputEdges[0].source;
        const sourceNode = allNodes.find((n) => n.id === sourceNodeId);

        if (sourceNode && sourceNode.type !== 'start') {
          // Inherit input from node BEFORE the branch
          const inheritedBinding: flyteidl.core.IBinding = {
            var: 'input',
            binding: {
              promise: {
                nodeId: sourceNodeId,
                var: 'output',
              },
            },
          };
          inputs.unshift(inheritedBinding);
        }
      }
    }

    // Build node based on type
    const compiledNode: flyteidl.core.INode = {
      id: targetNode.id,
      metadata,
      inputs,
      upstreamNodeIds, // Empty for inline nodes
    };

    switch (targetNode.type) {
      case 'task':
        compiledNode.taskNode = WorkflowCompilerService.compileTaskNode(targetNode);
        break;
      case 'branch':
        // Nested branches - recursively compile
        compiledNode.branchNode = await this.compileBranchNode(targetNode, allNodes, edges);
        break;
      case 'gate':
        compiledNode.gateNode = WorkflowCompilerService.compileGateNode(targetNode);
        break;
      case 'subworkflow':
        compiledNode.workflowNode = WorkflowCompilerService.compileWorkflowNode(targetNode);
        break;
      default:
        throw CompilationError(`Unknown node type: ${targetNode.type}`, targetNode.id);
    }

    return compiledNode;
  }

  /**
   * Compile boolean expression from condition
   * upstreamNodeId is the node ID whose output the condition should reference
   */
  private compileBooleanExpression(
    condition: any,
    upstreamNodeId?: string | null
  ): flyteidl.core.IBooleanExpression {
    // If condition has a type and expression, unwrap it
    if (condition.type === 'comparison' && condition.expression) {
      condition = condition.expression;
    }

    // Handle simple comparison
    if (condition.operator && condition.leftValue && condition.rightValue) {
      return {
        comparison: {
          operator: WorkflowCompilerService.mapComparisonOperator(condition.operator),
          leftValue: WorkflowCompilerService.compileOperand(condition.leftValue, upstreamNodeId),
          rightValue: WorkflowCompilerService.compileOperand(condition.rightValue, upstreamNodeId),
        },
      };
    }

    // Handle conjunction (AND)
    if (condition.conjunction) {
      return {
        conjunction: {
          operator: flyteidl.core.ConjunctionExpression.LogicalOperator.AND,
          leftExpression: this.compileBooleanExpression(condition.conjunction.left, upstreamNodeId),
          rightExpression: this.compileBooleanExpression(
            condition.conjunction.right,
            upstreamNodeId
          ),
        },
      };
    }

    throw CompilationError('Invalid boolean expression', undefined, {
      type: condition.type || 'unknown',
      expression: condition,
    });
  }

  /**
   * Map comparison operator
   */
  private static mapComparisonOperator(op: string): flyteidl.core.ComparisonExpression.Operator {
    const mapping: Record<string, flyteidl.core.ComparisonExpression.Operator> = {
      // Symbol operators
      '==': flyteidl.core.ComparisonExpression.Operator.EQ,
      '!=': flyteidl.core.ComparisonExpression.Operator.NEQ,
      '>': flyteidl.core.ComparisonExpression.Operator.GT,
      '>=': flyteidl.core.ComparisonExpression.Operator.GTE,
      '<': flyteidl.core.ComparisonExpression.Operator.LT,
      '<=': flyteidl.core.ComparisonExpression.Operator.LTE,
      // Named operators (used in UI)
      EQ: flyteidl.core.ComparisonExpression.Operator.EQ,
      NEQ: flyteidl.core.ComparisonExpression.Operator.NEQ,
      GT: flyteidl.core.ComparisonExpression.Operator.GT,
      GTE: flyteidl.core.ComparisonExpression.Operator.GTE,
      LT: flyteidl.core.ComparisonExpression.Operator.LT,
      LTE: flyteidl.core.ComparisonExpression.Operator.LTE,
    };

    return mapping[op] || flyteidl.core.ComparisonExpression.Operator.EQ;
  }

  /**
   * Compile operand (left or right value)
   * upstreamNodeId: ID of the upstream node whose output the condition references
   *
   * IMPORTANT: When a branch receives input from an upstream node, the compiler creates
   * a pass-through binding (var: 'input') that references the upstream node's output.
   * Branch conditions must reference fields from this 'input' binding, NOT directly
   * from the upstream node ID, because Flyte doesn't support dot-notation for accessing
   * nested fields from task outputs (e.g., node-123.field is invalid).
   */
  private static compileOperand(
    operand: any,
    upstreamNodeId?: string | null
  ): flyteidl.core.IOperand {
    // If it's a promise (reference to another node's output)
    // Promises are represented as variable references in protobuf
    if (operand.promise) {
      return {
        var: `${operand.promise.nodeId}.${operand.promise.var || 'result'}`,
      };
    }

    // If it's a field reference (variable or input parameter)
    if (operand.type === 'field' && operand.field) {
      // CRITICAL: Always use 'input' binding for field references in branch conditions
      // The compileNodeInputs method creates a pass-through binding that makes the
      // upstream node's output available as 'input' to the branch. Branch conditions
      // then access fields from this input binding using input.field_name syntax.
      //
      // This is the ONLY correct way to reference upstream fields in Flyte branches,
      // because Flyte doesn't support accessing nested fields directly from node outputs.
      return {
        var: `input.${operand.field}`,
      };
    }

    // If it's a constant value (from UI)
    if (operand.type === 'constant' && operand.constant) {
      const { constant } = operand;
      // Extract the actual value based on type
      const value = constant.value !== undefined ? constant.value : constant;
      const scalar = WorkflowCompilerService.compileScalar(value);
      return {
        primitive: scalar.primitive,
      };
    }

    // If it's a var reference (direct string reference)
    if (operand.var) {
      return {
        var: operand.var,
      };
    }

    // If it's a scalar value
    if (operand.scalar !== undefined) {
      const scalar = WorkflowCompilerService.compileScalar(operand.scalar);
      return {
        primitive: scalar.primitive,
      };
    }

    // If operand has a value property, use that
    if (operand.value !== undefined) {
      const scalar = WorkflowCompilerService.compileScalar(operand.value);
      return {
        primitive: scalar.primitive,
      };
    }

    // If it's a primitive value, wrap it as scalar
    if (
      typeof operand === 'string' ||
      typeof operand === 'number' ||
      typeof operand === 'boolean'
    ) {
      const scalar = WorkflowCompilerService.compileScalar(operand);
      return {
        primitive: scalar.primitive,
      };
    }

    throw CompilationError('Unsupported operand type', undefined, operand);
  }

  /**
   * Compile scalar value (enhanced version with more type support)
   */
  private static compileScalar(value: any): flyteidl.core.IScalar {
    if (typeof value === 'string') {
      return {
        primitive: {
          stringValue: value,
        },
      };
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return {
          primitive: {
            integer: value as any, // Cast to Long for protobuf compatibility
          },
        };
      }
      return {
        primitive: {
          floatValue: value,
        },
      };
    }

    if (typeof value === 'boolean') {
      return {
        primitive: {
          boolean: value,
        },
      };
    }

    throw CompilationError('Unsupported scalar type', undefined, value);
  }

  /**
   * Convert a JavaScript value to Flyte Literal
   * Handles primitives, arrays, objects, null, undefined with full edge case coverage
   */
  private static compileStaticValue(value: any, fieldSchema?: any): flyteidl.core.ILiteral {
    // === NULL/UNDEFINED ===
    if (value === null || value === undefined) {
      return {
        scalar: {
          noneType: {}, // Flyte's representation of null
        },
      };
    }

    // === BOOLEAN ===
    if (typeof value === 'boolean') {
      return {
        scalar: {
          primitive: {
            boolean: value,
          },
        },
      };
    }

    // === NUMBER ===
    if (typeof value === 'number') {
      if (Number.isNaN(value)) {
        throw CompilationError('NaN is not supported in workflow static values', undefined, value);
      }
      if (!Number.isFinite(value)) {
        throw CompilationError(
          'Infinity is not supported in workflow static values',
          undefined,
          value
        );
      }

      // Check schema hint for integer vs float
      if (fieldSchema?.type === 'integer' || Number.isInteger(value)) {
        return {
          scalar: {
            primitive: {
              integer: value as any, // Cast to Long for protobuf
            },
          },
        };
      }
      return {
        scalar: {
          primitive: {
            floatValue: value,
          },
        },
      };
    }

    // === STRING ===
    if (typeof value === 'string') {
      // Handle special formats based on schema hints
      if (fieldSchema?.format === 'date-time') {
        // Validate ISO date format
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          return {
            scalar: {
              primitive: {
                datetime: date as any,
              },
            },
          };
        }
      }

      // Default: plain string
      return {
        scalar: {
          primitive: {
            stringValue: value,
          },
        },
      };
    }

    // === ARRAY ===
    if (Array.isArray(value)) {
      const itemSchema = fieldSchema?.items;
      const collection = value.map((item) => this.compileStaticValue(item, itemSchema));

      return {
        collection: {
          literals: collection,
        },
      };
    }

    // === DATE OBJECT ===
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw CompilationError('Invalid Date object', undefined, value);
      }
      return {
        scalar: {
          primitive: {
            datetime: value as any,
          },
        },
      };
    }

    // === OBJECT (as Struct) ===
    if (typeof value === 'object') {
      const fields: { [key: string]: any } = {};

      Object.entries(value).forEach(([key, val]) => {
        const propSchema = fieldSchema?.properties?.[key];
        try {
          const literal = this.compileStaticValue(val, propSchema);
          // Convert literal to google.protobuf.Value format for struct fields
          if (literal.scalar?.primitive) {
            if (literal.scalar.primitive.stringValue !== undefined) {
              fields[key] = { stringValue: literal.scalar.primitive.stringValue };
            } else if (literal.scalar.primitive.integer !== undefined) {
              fields[key] = { numberValue: Number(literal.scalar.primitive.integer) };
            } else if (literal.scalar.primitive.floatValue !== undefined) {
              fields[key] = { numberValue: literal.scalar.primitive.floatValue };
            } else if (literal.scalar.primitive.boolean !== undefined) {
              fields[key] = { boolValue: literal.scalar.primitive.boolean };
            }
          } else if (literal.collection) {
            // Wrap array in google.protobuf.ListValue format
            // Each literal in the collection needs to be converted to google.protobuf.IValue
            const listValues = (literal.collection.literals || []).map((lit) => {
              if (lit.scalar?.primitive) {
                const prim = lit.scalar.primitive;
                if (prim.stringValue !== undefined) return { stringValue: prim.stringValue };
                if (prim.integer !== undefined) return { numberValue: Number(prim.integer) };
                if (prim.floatValue !== undefined) return { numberValue: prim.floatValue };
                if (prim.boolean !== undefined) return { boolValue: prim.boolean };
              } else if (lit.scalar?.generic) {
                return { structValue: lit.scalar.generic };
              } else if (lit.collection) {
                // Nested array - recursively handle
                return { listValue: { values: [] } }; // Simplified for now
              }
              return { stringValue: '' }; // Fallback
            });
            fields[key] = { listValue: { values: listValues } };
          } else if (literal.scalar?.generic) {
            // Nested struct
            fields[key] = { structValue: literal.scalar.generic };
          }
        } catch (error) {
          console.warn(`Failed to compile nested field '${key}':`, error);
          // Continue with other fields
        }
      });

      return {
        scalar: {
          generic: {
            fields, // google.protobuf.Struct format
          },
        },
      };
    }

    throw CompilationError(`Unsupported value type: ${typeof value}`, undefined, value);
  }

  /**
   * Create a literal binding for a static configuration value
   */
  private static createLiteralBinding(
    fieldName: string,
    value: any,
    fieldSchema?: any
  ): flyteidl.core.IBinding {
    // compileStaticValue returns ILiteral which has .scalar, .collection, or .map
    // IBindingData expects the same structure, so we can use it directly
    const literal = this.compileStaticValue(value, fieldSchema);

    // Extract the binding data from the literal
    // IBindingData can be: scalar, collection, promise, map, or union
    const bindingData: flyteidl.core.IBindingData = {};

    if (literal.scalar) {
      bindingData.scalar = literal.scalar;
    } else if (literal.collection) {
      bindingData.collection = {
        bindings:
          literal.collection.literals?.map((lit) => {
            const bd: flyteidl.core.IBindingData = {};
            if (lit.scalar) bd.scalar = lit.scalar;
            else if (lit.collection) bd.collection = { bindings: [] }; // Nested collections
            return bd;
          }) || [],
      };
    } else if (literal.map) {
      bindingData.map = {
        bindings: Object.entries(literal.map.literals || {}).reduce(
          (acc, [key, lit]) => {
            const bd: flyteidl.core.IBindingData = {};
            if (lit.scalar) bd.scalar = lit.scalar;
            acc[key] = bd;
            return acc;
          },
          {} as { [key: string]: flyteidl.core.IBindingData }
        ),
      };
    }

    return {
      var: fieldName,
      binding: bindingData,
    };
  }

  /**
   * Check if a string value contains a node reference pattern
   * Patterns: "node-123.output", "node-123.output.field", etc.
   */
  private static isNodeReferencePattern(value: string): boolean {
    if (typeof value !== 'string') return false;

    // Match patterns like: node-123.output or node-123.output.field
    // Node IDs can be: node-{uuid}, node-{timestamp}, or custom node IDs
    const nodeRefPattern =
      /^node-[a-zA-Z0-9-]+\.[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
    return nodeRefPattern.test(value);
  }

  /**
   * Parse a node reference string and create a promise binding
   * Example: "node-123.output.field" → { nodeId: "node-123", var: "output.field" }
   */
  private static parseNodeReference(
    value: string,
    fieldName: string,
    currentNodeId: string,
    allNodes: WorkflowBuilderNode[]
  ): flyteidl.core.IBinding | null {
    // Parse pattern: "node-123.output.field"
    const parts = value.split('.');
    if (parts.length < 2) {
      console.warn(`[Compiler] Invalid node reference format: ${value}. Expected: 'node-id.var'`);
      return null;
    }

    const nodeId = parts[0];
    const varPath = parts.slice(1).join('.');

    // Validate nodeId format
    if (!nodeId.startsWith('node-')) {
      console.warn(`[Compiler] Invalid node ID in reference: ${nodeId}`);
      return null;
    }

    // Validate referenced node exists
    const referencedNode = allNodes.find((n) => n.id === nodeId);
    if (!referencedNode) {
      console.warn(
        `[Compiler] Referenced node '${nodeId}' not found in workflow. ` +
          `Available nodes: ${allNodes.map((n) => n.id).join(', ')}`
      );
      return null;
    }

    // Prevent self-reference
    if (nodeId === currentNodeId) {
      console.warn(`[Compiler] Node '${currentNodeId}' cannot reference itself`);
      return null;
    }

    // Create promise binding
    return {
      var: fieldName,
      binding: {
        promise: {
          nodeId,
          var: varPath,
        },
      },
    };
  }

  /**
   * Compile gate node
   */
  private static compileGateNode(node: WorkflowBuilderNode): flyteidl.core.IGateNode {
    if (!node.data.gateConfig) {
      throw CompilationError('Gate node missing gateConfig', node.id);
    }

    const config = node.data.gateConfig;

    switch (config.type) {
      case 'approve':
      case 'signal':
        return {
          signal: {
            signalId: config.signalId || node.id,
            type: WorkflowCompilerService.compileSignalType(config.signalType),
            outputVariableName: config.outputVariableName,
          },
          sleep: undefined,
          approve: config.type === 'approve' ? {} : undefined,
        };

      case 'sleep':
        return {
          sleep: {
            duration: config.duration || { seconds: 60 as any }, // Cast seconds to Long
          },
          signal: undefined,
          approve: undefined,
        };

      default:
        throw CompilationError(`Unknown gate type: ${config.type}`, node.id);
    }
  }

  /**
   * Compile signal type
   */
  private static compileSignalType(signalType?: string): flyteidl.core.ILiteralType | undefined {
    if (!signalType) {
      return {
        simple: flyteidl.core.SimpleType.STRING,
      };
    }

    return {
      simple: flyteidl.core.SimpleType.STRING,
    };
  }

  /**
   * Compile workflow node (subworkflow)
   */
  private static compileWorkflowNode(node: WorkflowBuilderNode): flyteidl.core.IWorkflowNode {
    if (!node.data.workflowId) {
      throw CompilationError('Workflow node missing workflowId', node.id);
    }

    const referenceId: flyteidl.core.IIdentifier = {
      resourceType: flyteidl.core.ResourceType.WORKFLOW,
      project: node.data.workflowId.project,
      domain: node.data.workflowId.domain,
      name: node.data.workflowId.name,
      version: node.data.workflowId.version,
    };

    return {
      launchplanRef: referenceId,
    };
  }

  /**
   * Helper: Wrap individual field bindings into a collection (list) parameter binding
   * Creates a COLLECTION binding containing a single STRUCT element
   * This is used when a task expects List[RequestConfig] but UI provides flat fields
   */
  private static wrapBindingsIntoCollection(
    bindings: flyteidl.core.IBinding[],
    wrapperFieldName: string,
    nodeId: string
  ): flyteidl.core.IBinding[] {
    console.log(`[Compiler] wrapBindingsIntoCollection called for node '${nodeId}':`, {
      wrapperFieldName,
      totalBindings: bindings.length,
      bindingVars: bindings.map((b) => b.var),
    });

    // Separate static/map/collection bindings from promise bindings
    // CRITICAL: Filter out EMPTY scalars/collections that have no actual data
    const staticBindings = bindings.filter((b) => {
      if (b.binding?.scalar) {
        // Check if scalar has actual primitive data
        if (b.binding.scalar.primitive) return true;
        if (
          b.binding.scalar.generic?.fields &&
          Object.keys(b.binding.scalar.generic.fields).length > 0
        )
          return true;
        if (b.binding.scalar.noneType) return true;
        // Empty scalar object - exclude it
        return false;
      }
      if (b.binding?.collection) {
        // Check if collection has actual elements
        return b.binding.collection.bindings && b.binding.collection.bindings.length > 0;
      }
      if (b.binding?.map) {
        // Check if map has actual entries
        return b.binding.map.bindings && Object.keys(b.binding.map.bindings).length > 0;
      }
      return false;
    });
    const promiseBindings = bindings.filter((b) => b.binding?.promise);

    console.log(`[Compiler] Collection wrapping analysis:`, {
      staticBindings: staticBindings.length,
      promiseBindings: promiseBindings.length,
      staticVars: staticBindings.map((b) => b.var),
      promiseVars: promiseBindings.map((b) => b.var),
    });

    if (staticBindings.length === 0) {
      console.warn(
        `[Compiler] ⚠️  Cannot wrap into collection '${wrapperFieldName}' for node '${nodeId}' - no static bindings found.`
      );
      return bindings;
    }

    // Step 1: Create a struct object from static bindings
    const structFields: { [key: string]: any } = {};

    staticBindings.forEach((binding) => {
      if (binding.var && binding.binding) {
        const bindingData = binding.binding;

        if (bindingData.scalar?.primitive) {
          const prim = bindingData.scalar.primitive;
          // Wrap values in google.protobuf.Value format
          if (prim.stringValue !== undefined) {
            structFields[binding.var] = { stringValue: prim.stringValue };
          } else if (prim.integer !== undefined) {
            structFields[binding.var] = { numberValue: Number(prim.integer) };
          } else if (prim.floatValue !== undefined) {
            structFields[binding.var] = { numberValue: prim.floatValue };
          } else if (prim.boolean !== undefined) {
            structFields[binding.var] = { boolValue: prim.boolean };
          } else if (prim.datetime !== undefined && prim.datetime !== null) {
            structFields[binding.var] = { stringValue: prim.datetime.toString() };
          }
        } else if (bindingData.scalar?.generic) {
          const genericValue = bindingData.scalar.generic;
          if (genericValue.fields) {
            structFields[binding.var] = { structValue: genericValue };
          } else {
            structFields[binding.var] = { structValue: { fields: genericValue } };
          }
        }
      }
    });

    console.log(
      `[Compiler] Created struct with ${Object.keys(structFields).length} fields for collection`
    );

    // CRITICAL FIX: Don't create empty collections if no fields were added
    if (Object.keys(structFields).length === 0) {
      console.warn(
        `[Compiler] ⚠️  Cannot create collection '${wrapperFieldName}' for node '${nodeId}' - no valid field values. ` +
          `All static bindings were empty. This usually means the UI form fields are not filled in.`
      );
      // Return only promise bindings (data flow from other nodes)
      return promiseBindings;
    }

    // Step 2: Create a single-element struct for the list
    const singleElement: flyteidl.core.IBindingData = {
      scalar: {
        generic: {
          fields: structFields,
        },
      },
    };

    // Step 3: Wrap into a collection (list) binding
    const collectionBinding: flyteidl.core.IBinding = {
      var: wrapperFieldName,
      binding: {
        collection: {
          bindings: [singleElement],
        },
      },
    };

    console.log(
      `[Compiler] ✅ Created collection binding '${wrapperFieldName}' with 1 element containing ${
        Object.keys(structFields).length
      } fields`
    );

    // Replace static bindings with the single collection binding
    return [collectionBinding, ...promiseBindings];
  }

  /**
   * Helper: Wrap individual field bindings into a single object parameter binding
   * Creates a STRUCT binding (not MAP) as Flyte expects structured types
   */
  private static wrapBindingsIntoObject(
    bindings: flyteidl.core.IBinding[],
    wrapperFieldName: string,
    nodeId: string
  ): flyteidl.core.IBinding[] {
    console.log(`[Compiler] wrapBindingsIntoObject called for node '${nodeId}':`, {
      wrapperFieldName,
      totalBindings: bindings.length,
      bindingVars: bindings.map((b) => b.var),
    });

    // Separate static/map/collection bindings from promise bindings
    // CRITICAL: Filter out EMPTY scalars/collections that have no actual data
    const staticBindings = bindings.filter((b) => {
      if (b.binding?.scalar) {
        // Check if scalar has actual primitive data
        if (b.binding.scalar.primitive) return true;
        if (
          b.binding.scalar.generic?.fields &&
          Object.keys(b.binding.scalar.generic.fields).length > 0
        )
          return true;
        if (b.binding.scalar.noneType) return true;
        // Empty scalar object - exclude it
        return false;
      }
      if (b.binding?.collection) {
        // Check if collection has actual elements
        return b.binding.collection.bindings && b.binding.collection.bindings.length > 0;
      }
      if (b.binding?.map) {
        // Check if map has actual entries
        return b.binding.map.bindings && Object.keys(b.binding.map.bindings).length > 0;
      }
      return false;
    });
    const promiseBindings = bindings.filter((b) => b.binding?.promise);

    console.log(`[Compiler] Wrapping analysis:`, {
      staticBindings: staticBindings.length,
      promiseBindings: promiseBindings.length,
      staticVars: staticBindings.map((b) => b.var),
      promiseVars: promiseBindings.map((b) => b.var),
    });

    // CRITICAL FIX: Don't wrap if no static bindings
    if (staticBindings.length === 0) {
      console.warn(
        `[Compiler] ⚠️  Cannot wrap into '${wrapperFieldName}' for node '${nodeId}' - no static bindings found. ` +
          `This usually means the task expects a parameter but the UI provided no values.`
      );
      return bindings; // Return unchanged
    }

    // NEW: Check if any static bindings have actual values
    const hasValidValues = staticBindings.some((b) => {
      if (b.binding?.scalar?.primitive) return true;
      if (b.binding?.scalar?.generic?.fields) {
        return Object.keys(b.binding.scalar.generic.fields).length > 0;
      }
      if (b.binding?.collection?.bindings) {
        return b.binding.collection.bindings.length > 0;
      }
      if (b.binding?.map?.bindings) {
        return Object.keys(b.binding.map.bindings).length > 0;
      }
      return false;
    });

    if (!hasValidValues) {
      console.warn(
        `[Compiler] ⚠️  Cannot wrap into '${wrapperFieldName}' for node '${nodeId}' - all bindings are empty. ` +
          `Possible causes:\n` +
          `  1. UI form fields are empty and task expects values\n` +
          `  2. Data binding configuration is missing\n` +
          `  3. Task interface mismatch with UI schema\n` +
          `Suggestion: Check task '${nodeId}' configuration in workflow builder.`
      );
      return promiseBindings; // Return only promise bindings, discard empty static ones
    }

    // Create a google.protobuf.Struct with proper field format
    const structFields: { [key: string]: any } = {};

    staticBindings.forEach((binding) => {
      if (binding.var && binding.binding) {
        const bindingData = binding.binding;

        if (bindingData.scalar?.primitive) {
          const prim = bindingData.scalar.primitive;
          // Wrap values in google.protobuf.Value format
          if (prim.stringValue !== undefined) {
            structFields[binding.var] = { stringValue: prim.stringValue };
          } else if (prim.integer !== undefined) {
            structFields[binding.var] = { numberValue: Number(prim.integer) };
          } else if (prim.floatValue !== undefined) {
            structFields[binding.var] = { numberValue: prim.floatValue };
          } else if (prim.boolean !== undefined) {
            structFields[binding.var] = { boolValue: prim.boolean };
          } else if (prim.datetime !== undefined && prim.datetime !== null) {
            structFields[binding.var] = { stringValue: prim.datetime.toString() };
          }
        } else if (bindingData.scalar?.generic) {
          // Already a struct/generic object - check if it already has 'fields' wrapper
          const genericValue = bindingData.scalar.generic;
          if (genericValue.fields) {
            // Already properly formatted with fields wrapper
            structFields[binding.var] = { structValue: genericValue };
          } else {
            // Old format without fields wrapper - wrap it
            structFields[binding.var] = { structValue: { fields: genericValue } };
          }
        }
      }
    });

    console.log(`[Compiler] Created struct fields:`, {
      fieldCount: Object.keys(structFields).length,
      fieldNames: Object.keys(structFields),
    });

    // Create the wrapped binding as a google.protobuf.Struct
    const wrappedBinding: flyteidl.core.IBinding = {
      var: wrapperFieldName,
      binding: {
        scalar: {
          generic: {
            fields: structFields,
          },
        },
      },
    };

    console.log(
      `[Compiler] ✅ Created wrapped binding '${wrapperFieldName}' with ${
        Object.keys(structFields).length
      } fields`
    );

    // Replace static bindings with the single wrapped binding
    return [wrappedBinding, ...promiseBindings];
  }

  /**
   * Compile node inputs (bindings) - NOW ASYNC
   * Combines edge-based bindings (data flow) with static literal bindings (form data)
   */
  private async compileNodeInputs(
    node: WorkflowBuilderNode,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): Promise<flyteidl.core.IBinding[]> {
    const bindings: flyteidl.core.IBinding[] = [];

    // ===== LAYER 1: Edge Bindings (Highest Priority - Data Flow) =====
    const incomingEdges = edges.filter((e) => e.target === node.id);

    // Build edge bindings (async because we need to query task output variable names)
    const edgeBindingsPromises = incomingEdges.map(async (edge) => {
      const sourceNode = allNodes.find((n) => n.id === edge.source);
      if (!sourceNode || sourceNode.type === 'start') return [];

      // Check if there are field mappings
      if (edge.data?.fieldMappings && edge.data.fieldMappings.length > 0) {
        // Create bindings for each field mapping with validation
        return edge.data.fieldMappings.map((mapping) => {
          // VALIDATION: Check if source node has this output field
          const sourceOutputSchema = sourceNode.data.outputSchema;
          if (sourceOutputSchema?.properties) {
            const hasField = Object.keys(sourceOutputSchema.properties).includes(
              mapping.sourceField
            );
            if (!hasField) {
              console.warn(
                `[Compiler] ⚠️  Edge field mapping references non-existent output field '${mapping.sourceField}' ` +
                  `on node '${edge.source}'. Available outputs: ${Object.keys(
                    sourceOutputSchema.properties
                  ).join(', ')}`
              );
            }
          }

          return {
            var: mapping.targetField,
            binding: {
              promise: {
                nodeId: edge.source,
                var: mapping.sourceField,
              },
            },
          };
        });
      }

      // ===== CRITICAL: Create pass-through binding for all node types =====
      // Both branch and task nodes need to receive the upstream output as an input binding
      // Branch conditions will then reference fields from this input binding
      // Format: Pass entire output struct as 'input' parameter

      // Get the actual output variable name from the source task
      let outputVarName = 'o0'; // Default fallback
      if (this.taskInterfaceService && sourceNode.data.taskId) {
        try {
          const taskId: flyteidl.core.IIdentifier = {
            resourceType: flyteidl.core.ResourceType.TASK,
            project: sourceNode.data.taskId.project,
            domain: sourceNode.data.taskId.domain,
            name: sourceNode.data.taskId.name,
            version: sourceNode.data.taskId.version,
          };
          outputVarName = await this.taskInterfaceService.getOutputVariableName(taskId);
        } catch {
          console.warn(
            `[Compiler] Failed to get output variable name for '${sourceNode.data.label}', using default 'o0'`
          );
        }
      }

      console.log(
        `[Compiler] Creating pass-through binding from '${
          sourceNode.data.label || edge.source
        }' (output: '${outputVarName}') to '${node.data.label || node.id}'`
      );

      return [
        {
          var: 'input',
          binding: {
            promise: {
              nodeId: edge.source,
              var: outputVarName, // Actual task output variable name
            },
          },
        },
      ];
    });

    // Wait for all edge bindings to resolve
    const edgeBindingsArrays = await Promise.all(edgeBindingsPromises);
    const edgeBindings = edgeBindingsArrays.flat();

    // Track which fields are bound by edges (these take precedence)
    const edgeBoundFields = new Set(edgeBindings.map((b) => b.var));

    // ===== LAYER 2: Static Literal Bindings (NEW - Form Data) =====
    const inputData = (node.data as any).inputData || {};
    const config = node.data.config || {};
    const { inputSchema } = node.data;

    // Merge inputData and config (inputData takes precedence over config)
    const staticValues = { ...config, ...inputData };

    console.log(`[Compiler] Processing static values for node '${node.id}':`, {
      inputData,
      config,
      staticValues,
      staticValueCount: Object.keys(staticValues).length,
    });

    Object.entries(staticValues).forEach(([fieldName, value]) => {
      // Skip if already bound by edge (edge bindings have priority)
      if (edgeBoundFields.has(fieldName)) {
        return;
      }

      // Skip undefined, null, or empty string (unless explicitly configured)
      if (value === undefined || value === null || value === '') {
        return;
      }

      // ===== CRITICAL: Validate field exists in schema =====
      // If node has input schema, only create bindings for fields that exist in it
      if (inputSchema?.properties) {
        const fieldSchema = inputSchema.properties[fieldName];
        if (!fieldSchema) {
          console.warn(
            `[Compiler] Skipping '${fieldName}' in node '${node.id}' - field not found in input schema. ` +
              `Available fields: ${Object.keys(inputSchema.properties).join(', ')}`
          );
          return;
        }
      }

      // Skip if value is a workflow parameter reference (${param_name})
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        return;
      }

      // Detect node output references in string values
      if (typeof value === 'string' && WorkflowCompilerService.isNodeReferencePattern(value)) {
        try {
          const promiseBinding = WorkflowCompilerService.parseNodeReference(
            value,
            fieldName,
            node.id,
            allNodes
          );
          if (promiseBinding) {
            bindings.push(promiseBinding);
            return;
          }
        } catch (error: any) {
          console.warn(
            `[Compiler] ⚠️ Failed to parse node reference '${value}' for field '${fieldName}':`,
            error.message
          );
        }
      }

      // Handle object-based node references
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const objValue = value as any;
        if (objValue.nodeId && typeof objValue.nodeId === 'string') {
          bindings.push({
            var: fieldName,
            binding: {
              promise: {
                nodeId: objValue.nodeId,
                var: objValue.var || objValue.field || 'output',
              },
            },
          });
          return;
        }
      }

      // Get field schema for type conversion hints
      const fieldSchema = inputSchema?.properties?.[fieldName];

      // Create literal binding for static value
      try {
        const binding = WorkflowCompilerService.createLiteralBinding(fieldName, value, fieldSchema);
        bindings.push(binding);
        console.log(`[Compiler] ✅ Created static binding for '${fieldName}' in node '${node.id}'`);
      } catch (error: any) {
        console.error(
          `[Compiler] ❌ Failed to compile field '${fieldName}' in node '${node.id}':`,
          error.message
        );
      }
    });

    console.log(`[Compiler] Total bindings created for node '${node.id}': ${bindings.length}`, {
      bindingVars: bindings.map((b) => b.var),
      staticBindingCount: bindings.filter((b) => b.binding?.scalar || b.binding?.collection).length,
      promiseBindingCount: bindings.filter((b) => b.binding?.promise).length,
    });

    // Add edge bindings AFTER static bindings (edge bindings override if any conflict)
    bindings.push(...edgeBindings);

    // ===== CRITICAL FIX: Detect if schema has been flattened and needs wrapping =====
    // When a task has a single object parameter (e.g., `def task(config: MyConfig)`),
    // the UI may flatten MyConfig's properties as top-level fields.
    // We need to detect this and wrap the bindings back into the expected structure.
    if (node.type === 'task' && bindings.length > 0 && inputSchema) {
      // Check if the schema structure indicates a wrapper object is needed
      // This happens when the schema has many properties but the task likely expects
      // a single object parameter containing those properties

      // Strategy: Check if there's a common pattern indicating the schema was flattened
      // from a nested object structure (Pydantic model with nested BaseModel)

      // Look for metadata hints or patterns in the schema
      const schemaMetadata = (inputSchema as any).metadata || {};
      // const schemaTitle = (inputSchema as any).title || '';
      // const schemaDescription = (inputSchema as any).description || '';

      // Check if schema has a 'x-flyte-wrapper' hint or similar
      const wrapperFieldName =
        schemaMetadata['x-flyte-wrapper-field'] ||
        schemaMetadata.wrapperField ||
        (inputSchema as any)['x-wrapper-parameter'];

      // ===== INTELLIGENT WRAPPING USING TASK INTERFACE SERVICE =====
      // Use TaskInterfaceService to fetch task definition from Flyte and determine wrapping
      console.log(`[Compiler] Wrapping check for node '${node.id}':`, {
        hasWrapperFieldName: !!wrapperFieldName,
        hasTaskInterfaceService: !!this.taskInterfaceService,
        hasTaskId: !!node.data.taskId,
        taskName: node.data.taskId?.name,
      });

      if (!wrapperFieldName && this.taskInterfaceService && node.data.taskId) {
        // CRITICAL: Only wrap STATIC bindings, never wrap promise bindings (from edges)
        // CRITICAL: Filter out EMPTY scalars/collections that have no actual data
        const staticBindings = bindings.filter((b) => {
          if (b.binding?.scalar) {
            // Check if scalar has actual primitive data
            if (b.binding.scalar.primitive) return true;
            if (
              b.binding.scalar.generic?.fields &&
              Object.keys(b.binding.scalar.generic.fields).length > 0
            )
              return true;
            if (b.binding.scalar.noneType) return true;
            // Empty scalar object - exclude it
            return false;
          }
          if (b.binding?.collection) {
            // Check if collection has actual elements
            return b.binding.collection.bindings && b.binding.collection.bindings.length > 0;
          }
          if (b.binding?.map) {
            // Check if map has actual entries
            return b.binding.map.bindings && Object.keys(b.binding.map.bindings).length > 0;
          }
          return false;
        });
        const promiseBindings = bindings.filter((b) => b.binding?.promise);

        console.log(`[Compiler] Analyzing wrapping for node '${node.id}':`, {
          taskName: node.data.taskId.name,
          totalBindings: bindings.length,
          staticBindings: staticBindings.length,
          promiseBindings: promiseBindings.length,
          staticFields: staticBindings.map((b) => b.var),
          promiseFields: promiseBindings.map((b) => b.var),
        });

        // Only analyze wrapping if we have static bindings
        if (staticBindings.length > 0) {
          // CRITICAL: Only pass STATIC field names to wrapping analysis
          // Promise bindings (like 'input' from pass-through) should NOT influence wrapping
          const staticFields = staticBindings.map((b) => b.var || '').filter((v) => v);

          // Fetch task interface and determine wrapping
          const taskId: flyteidl.core.IIdentifier = {
            resourceType: flyteidl.core.ResourceType.TASK,
            project: node.data.taskId.project,
            domain: node.data.taskId.domain,
            name: node.data.taskId.name,
            version: node.data.taskId.version,
          };

          console.log(
            `[Compiler] Fetching task interface for '${node.data.taskId.name}' with static fields:`,
            staticFields
          );

          try {
            // Pass ONLY static field names for wrapping analysis
            const analysis = await this.taskInterfaceService.analyzeWrappingNeeded(
              taskId,
              staticFields
            );

            console.log(`[Compiler] Wrapping analysis result for '${node.id}':`, analysis);

            if (analysis.wrapperParam) {
              const hasWrapper = bindings.some((b) => b.var === analysis.wrapperParam);
              if (!hasWrapper) {
                console.log(
                  `[Compiler] ✅ Wrapping ${staticBindings.length} static fields into '${
                    analysis.wrapperParam
                  }' for node '${node.id}'${analysis.wrapInCollection ? ' (as collection)' : ''}`
                );

                // Check if we need to wrap into a collection (list)
                if (analysis.wrapInCollection) {
                  return WorkflowCompilerService.wrapBindingsIntoCollection(
                    bindings,
                    analysis.wrapperParam,
                    node.id
                  );
                }
                return WorkflowCompilerService.wrapBindingsIntoObject(
                  bindings,
                  analysis.wrapperParam,
                  node.id
                );
              }
              console.log(
                `[Compiler] Wrapper '${analysis.wrapperParam}' already exists in bindings`
              );
            } else {
              console.log(
                `[Compiler] No wrapping needed for node '${node.id}': ${analysis.reason}`
              );
            }
          } catch (error) {
            console.error(`[Compiler] ⚠️ Task interface analysis failed for '${node.id}':`, error);
            // If task interface analysis fails, don't wrap - let Flyte validation catch the issue
            console.log(`[Compiler] Skipping wrapping due to task interface analysis failure`);
          }
        } else {
          console.log(
            `[Compiler] Skipping wrapping analysis for node '${node.id}' - no static bindings`
          );
        }
      }

      if (wrapperFieldName && typeof wrapperFieldName === 'string') {
        const hasWrapperBinding = bindings.some((b) => b.var === wrapperFieldName);
        if (!hasWrapperBinding) {
          const staticBindings = bindings.filter(
            (b) => b.binding?.scalar || b.binding?.collection || b.binding?.map
          );
          if (staticBindings.length > 0) {
            return WorkflowCompilerService.wrapBindingsIntoObject(
              bindings,
              wrapperFieldName,
              node.id
            );
          }
        }
      }
    }

    // ===== CRITICAL VALIDATION: Check for missing required parameters =====
    if (node.type === 'task' && inputSchema) {
      const requiredFields = inputSchema.required || [];
      const boundFields = new Set(bindings.map((b) => b.var).filter((v) => v));

      // Check each required field
      const missingRequired = requiredFields.filter((field: string) => {
        // Check if this field is bound directly or as part of a wrapper
        if (boundFields.has(field)) {
          return false; // Field is bound directly
        }

        // Check if this field might be inside a wrapped object
        // Look for any binding that could contain this field as a nested property
        const hasNestedBinding = bindings.some((b) => {
          if (b.binding?.scalar?.generic?.fields) {
            return Object.keys(b.binding.scalar.generic.fields).includes(field);
          }
          return false;
        });

        return !hasNestedBinding; // Missing if not found anywhere
      });

      if (missingRequired.length > 0) {
        console.error(
          `[Compiler] ⚠️ Node '${node.id}' missing required parameters: ${missingRequired.join(
            ', '
          )}`
        );
      }
    }

    return bindings;
  }

  /**
   * Compile connections (downstream/upstream maps)
   */
  private static compileConnections(
    nodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): flyteidl.core.IConnectionSet {
    const downstream: { [key: string]: flyteidl.core.ConnectionSet.IIdList } = {};
    const upstream: { [key: string]: flyteidl.core.ConnectionSet.IIdList } = {};

    // Build downstream map
    nodes
      .filter((node) => node.type !== 'start' && node.type !== 'end')
      .forEach((node) => {
        const outgoingEdges = edges.filter((e) => e.source === node.id);
        const targetIds = outgoingEdges
          .map((e) => e.target)
          .filter((id) => {
            const target = nodes.find((n) => n.id === id);
            return target && target.type !== 'end';
          });

        downstream[node.id] = {
          ids: targetIds,
        };
      });

    // Build upstream map
    nodes
      .filter((node) => node.type !== 'start' && node.type !== 'end')
      .forEach((node) => {
        const incomingEdges = edges.filter((e) => e.target === node.id);
        const sourceIds = incomingEdges
          .map((e) => e.source)
          .filter((id) => {
            const source = nodes.find((n) => n.id === id);
            return source && source.type !== 'start';
          });

        upstream[node.id] = {
          ids: sourceIds,
        };
      });

    return {
      downstream,
      upstream,
    };
  }

  /**
   * Extract tasks from workflow nodes
   */
  private extractTasks(nodes: WorkflowBuilderNode[]): flyteidl.core.ICompiledTask[] {
    return nodes
      .filter((node) => node.type === 'task' && node.data.taskId)
      .map((node) => {
        // Build task identifier (taskId guaranteed to exist by filter above)
        const taskId = node.data.taskId!;
        const id: flyteidl.core.IIdentifier = {
          resourceType: flyteidl.core.ResourceType.TASK,
          project: taskId.project,
          domain: taskId.domain,
          name: taskId.name,
          version: taskId.version,
        };

        // Build task interface
        const taskInterface: flyteidl.core.ITypedInterface = {
          inputs: node.data.inputSchema
            ? this.schemaToVariableMap(node.data.inputSchema)
            : undefined,
          outputs: node.data.outputSchema
            ? this.schemaToVariableMap(node.data.outputSchema)
            : undefined,
        };

        // Build task template
        const template: flyteidl.core.ITaskTemplate = {
          id,
          type: 'python-task',
          metadata: {
            runtime: {
              type: flyteidl.core.RuntimeMetadata.RuntimeType.FLYTE_SDK,
              version: '1.0.0',
              flavor: 'python',
            },
            retries: node.data.config?.retries ? { retries: node.data.config.retries } : undefined,
            timeout: node.data.config?.timeout ? { seconds: node.data.config.timeout } : undefined,
          },
          interface: taskInterface,
        };

        return {
          template,
        };
      });
  }

  /**
   * Compile workflow outputs
   * CRITICAL FIX: Workflows ending with branches should reference the branch node, not embedded nodes
   */
  private static compileWorkflowOutputs(
    nodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): flyteidl.core.IBinding[] {
    // CRITICAL: First, identify branch-embedded nodes (same logic as compileNodes)
    const branchTargetIds = new Set<string>();

    nodes
      .filter((n) => n.type === 'branch')
      .forEach((branchNode) => {
        const config = branchNode.data.branchConfig;
        if (config) {
          // Add primary case target
          if (config.primaryCase?.thenNodeId) {
            branchTargetIds.add(config.primaryCase.thenNodeId);
          }

          // Add else-if case targets
          config.elseCases?.forEach((elseCase: any) => {
            if (elseCase.thenNodeId) {
              branchTargetIds.add(elseCase.thenNodeId);
            }
          });

          // Add else default target
          if (config.elseNodeId) {
            branchTargetIds.add(config.elseNodeId);
          }
        }
      });

    // Find last nodes (no outgoing edges or only to 'end' node)
    const lastNodes = nodes.filter((n) => {
      if (n.type === 'end' || n.type === 'start') return false;
      if (branchTargetIds.has(n.id)) return false;

      const outgoing = edges.filter((e) => e.source === n.id);
      if (outgoing.length === 0) return true;

      return outgoing.every((e) => {
        const target = nodes.find((node) => node.id === e.target);
        return target?.type === 'end';
      });
    });

    // Check if workflow ends with a branch node
    const lastBranchNode = lastNodes.find((n) => n.type === 'branch');
    if (lastBranchNode) {
      // For workflows ending with branches, we use a single generic output
      // Flyte will automatically merge the outputs from all branch paths
      return [
        {
          var: 'output',
          binding: {
            promise: {
              nodeId: lastBranchNode.id,
              var: 'output',
            },
          },
        },
      ];
    }

    // Normal case: workflow ends with task nodes
    const taskNodes = lastNodes.filter((node) => node.type === 'task');

    if (taskNodes.length === 0) {
      return [];
    }

    if (taskNodes.length === 1) {
      // Use 'o0' as the default output variable name for Flyte tasks
      // This matches the common Python task output variable naming
      return [
        {
          var: 'output',
          binding: {
            promise: {
              nodeId: taskNodes[0].id,
              var: 'o0', // Changed from 'output' to 'o0'
            },
          },
        },
      ];
    }

    // Multiple outputs - generate unique names
    return taskNodes.map((node) => {
      const nodeName = (node.data.label || node.id)
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/^[0-9]/, 'output_$&');

      const nodeIdSuffix = node.id.replace(/[^a-z0-9_]/g, '_');
      const outputVarName = `${nodeName}_${nodeIdSuffix}_output`;

      return {
        var: outputVarName,
        binding: {
          promise: {
            nodeId: node.id,
            var: 'o0', // Changed from 'output' to 'o0'
          },
        },
      };
    });
  }
}

// Export singleton instance
export const workflowCompilerService = new WorkflowCompilerService();
