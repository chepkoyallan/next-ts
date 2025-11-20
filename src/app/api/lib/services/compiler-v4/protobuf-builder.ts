/**
 * Protobuf Builder
 *
 * Pure protobuf construction from validated bindings
 * No business logic - just building Flyte protobuf structures
 */

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';
import { logger } from 'src/app/api/lib/utils/logger';

import type {
  WorkflowDraft,
  WorkflowBuilderNode,
  WorkflowBuilderEdge,
} from '../workflow-draft-service';

/**
 * Protobuf Builder
 *
 * Constructs Flyte protobuf structures from workflow draft and bindings
 */
export class ProtobufBuilder {
  /**
   * Build complete workflow closure
   */
  buildWorkflowClosure(
    draft: WorkflowDraft,
    nodeBindings: Map<
      string,
      { inputs: flyteidl.core.IBinding[]; outputs: Map<string, flyteidl.core.IVariable> }
    >
  ): flyteidl.core.ICompiledWorkflowClosure {
    logger.info('[ProtobufBuilder] Building workflow closure');

    const template = this.buildWorkflowTemplate(draft, nodeBindings);
    const connections = ProtobufBuilder.buildConnections(draft.nodes, draft.edges);

    const primary: flyteidl.core.ICompiledWorkflow = {
      template,
      connections,
    };

    const closure: flyteidl.core.ICompiledWorkflowClosure = {
      primary,
      tasks: [], // Tasks are pre-registered in Flyte
      subWorkflows: [],
    };

    logger.info('[ProtobufBuilder] ✓ Workflow closure built');

    return closure;
  }

  /**
   * Build workflow template
   */
  buildWorkflowTemplate(
    draft: WorkflowDraft,
    nodeBindings: Map<
      string,
      { inputs: flyteidl.core.IBinding[]; outputs: Map<string, flyteidl.core.IVariable> }
    >
  ): flyteidl.core.IWorkflowTemplate {
    logger.info('[ProtobufBuilder] Building workflow template');

    // Workflow identifier
    const id: flyteidl.core.IIdentifier = {
      resourceType: flyteidl.core.ResourceType.WORKFLOW,
      project: draft.project,
      domain: draft.domain,
      name: draft.name,
      version: draft.version,
    };

    // Workflow metadata
    const metadata: flyteidl.core.IWorkflowMetadata = {
      onFailure: flyteidl.core.WorkflowMetadata.OnFailurePolicy.FAIL_IMMEDIATELY,
    };

    // Build nodes
    const nodes = this.buildNodes(draft.nodes, draft.edges, nodeBindings);

    // Workflow outputs
    const outputs = ProtobufBuilder.buildWorkflowOutputs(draft.nodes, draft.edges, nodeBindings);

    // Workflow interface (inputs/outputs)
    // Pass outputs so we can build the interface to match
    const workflowInterface = this.buildWorkflowInterface(draft, outputs, nodeBindings);

    return {
      id,
      metadata,
      interface: workflowInterface,
      nodes,
      outputs,
    };
  }

  /**
   * Build workflow interface (inputs/outputs)
   */
  buildWorkflowInterface(
    draft: WorkflowDraft,
    outputBindings: flyteidl.core.IBinding[],
    nodeBindings?: Map<
      string,
      { inputs: flyteidl.core.IBinding[]; outputs: Map<string, flyteidl.core.IVariable> }
    >
  ): flyteidl.core.ITypedInterface {
    // Build inputs from draft.workflowInputs
    const inputVariables: { [k: string]: flyteidl.core.IVariable } = {};

    if (draft.workflowInputs) {
      Object.entries(draft.workflowInputs).forEach(([name, variable]) => {
        inputVariables[name] = {
          type: this.convertFlyteType(variable.type),
          description: variable.description,
        };
      });
    }

    const inputs: flyteidl.core.IVariableMap = {
      variables: inputVariables,
    };

    // Build outputs from draft.workflowOutputs OR infer from output bindings
    const outputVariables: { [k: string]: flyteidl.core.IVariable } = {};

    if (draft.workflowOutputs && Object.keys(draft.workflowOutputs).length > 0) {
      // Use explicitly defined workflow outputs
      Object.entries(draft.workflowOutputs).forEach(([name, variable]) => {
        outputVariables[name] = {
          type: this.convertFlyteType(variable.type),
          description: variable.description,
        };
      });
    } else if (outputBindings.length > 0) {
      // Infer output types from the output bindings
      logger.info('[ProtobufBuilder] No explicit workflow outputs, inferring from output bindings');
      outputBindings.forEach((binding) => {
        if (binding.binding?.promise) {
          const sourceNodeId = binding.binding.promise.nodeId;
          const sourceVarName = binding.binding.promise.var;

          // Get the type from the source node's outputs
          const sourceOutputs = nodeBindings?.get(sourceNodeId!)?.outputs;
          const sourceVariable = sourceOutputs?.get(sourceVarName!);

          if (sourceVariable) {
            outputVariables[binding.var!] = {
              type: sourceVariable.type,
              description: sourceVariable.description || `Output from ${sourceNodeId}`,
            };
            logger.info(
              `[ProtobufBuilder] Inferred workflow output ${binding.var} from ${sourceNodeId}.${sourceVarName}`
            );
          } else {
            logger.warn(
              `[ProtobufBuilder] Could not infer type for workflow output ${binding.var}`
            );
          }
        }
      });
    }

    const outputs: flyteidl.core.IVariableMap = {
      variables: outputVariables,
    };

    logger.info(
      `[ProtobufBuilder] Workflow interface: ${Object.keys(inputVariables).length} inputs, ${
        Object.keys(outputVariables).length
      } outputs`
    );

    return { inputs, outputs };
  }

  /**
   * Convert FlyteType from draft format to protobuf format
   */
  private convertFlyteType(type: any): flyteidl.core.ILiteralType {
    switch (type.kind) {
      case 'simple':
        return { simple: type.simple };

      case 'collection':
        return {
          collectionType: this.convertFlyteType(type.collectionType),
        };

      case 'map':
        return {
          mapValueType: this.convertFlyteType(type.mapValueType),
        };

      case 'struct':
        // For struct types, we use generic type
        return {
          simple: 9, // STRUCT
        };

      case 'union':
        return {
          unionType: {
            variants: type.unionTypes?.map((t: any) => this.convertFlyteType(t)) || [],
          },
        };

      case 'blob':
        return {
          blob: type.blobType || {},
        };

      default:
        // Default to string for unknown types
        return { simple: 3 };
    }
  }

  /**
   * Build workflow outputs
   */
  static buildWorkflowOutputs(
    nodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[],
    nodeBindings?: Map<
      string,
      { inputs: flyteidl.core.IBinding[]; outputs: Map<string, flyteidl.core.IVariable> }
    >
  ): flyteidl.core.IBinding[] {
    // First, identify nodes that are embedded in branches (should not be considered as last nodes)
    const branchTargetIds = new Set<string>();
    nodes
      .filter((n) => n.type === 'branch')
      .forEach((branchNode) => {
        const config = branchNode.data.branchConfig;
        if (config) {
          if (config.primaryCase?.thenNodeId) branchTargetIds.add(config.primaryCase.thenNodeId);
          config.elseCases?.forEach((c: any) => {
            if (c.thenNodeId) branchTargetIds.add(c.thenNodeId);
          });
          if (config.elseNodeId) branchTargetIds.add(config.elseNodeId);
        }
      });

    // Embed all branch target nodes (inline in branch definition)
    // They should NOT be top-level nodes
    const embeddedNodeIds = new Set<string>(branchTargetIds);

    logger.info(
      `[ProtobufBuilder] Branch target nodes (embedded): ${Array.from(embeddedNodeIds).join(', ')}`
    );

    // Find last nodes (no outgoing edges or only to 'end')
    // Exclude embedded branch target nodes
    const lastNodes = nodes.filter((n) => {
      if (n.type === 'end' || n.type === 'start') return false;
      if (embeddedNodeIds.has(n.id)) return false; // Exclude embedded nodes

      const outgoing = edges.filter((e) => e.source === n.id);
      return (
        outgoing.length === 0 ||
        outgoing.every((e) => {
          const target = nodes.find((node) => node.id === e.target);
          return target?.type === 'end';
        })
      );
    });

    if (lastNodes.length === 0) {
      logger.warn('[ProtobufBuilder] No last nodes found for workflow output');
      return [];
    }

    const lastNode = lastNodes[0];

    logger.info(
      `[ProtobufBuilder] Last nodes found: ${lastNodes
        .map((n) => `${n.id} (${n.type})`)
        .join(', ')}`
    );
    logger.info(`[ProtobufBuilder] Last node type: ${lastNode.type}`);
    logger.info(
      `[ProtobufBuilder] Embedded nodes: ${Array.from(embeddedNodeIds).join(', ') || 'none'}`
    );

    // Handle branch-terminated workflows
    if (lastNode.type === 'branch') {
      logger.info('[ProtobufBuilder] Last node is branch - binding to first branch target');

      const { branchConfig } = lastNode.data;
      if (!branchConfig || !branchConfig.primaryCase?.thenNodeId) {
        logger.warn('[ProtobufBuilder] Branch node has no targets, skipping output binding');
        return [];
      }

      // Bind to the primary case target output
      const targetNodeId = branchConfig.primaryCase.thenNodeId;
      logger.info(`[ProtobufBuilder] Workflow output bound to branch target: ${targetNodeId}`);

      return [
        {
          var: 'o0',
          binding: {
            promise: {
              nodeId: targetNodeId,
              var: 'o0',
            },
          },
        },
      ];
    }

    logger.info(`[ProtobufBuilder] Workflow output bound to: ${lastNode.id}`);

    // Get the actual output variable names from the last node
    const lastNodeOutputs = nodeBindings?.get(lastNode.id)?.outputs;
    const outputBindings: flyteidl.core.IBinding[] = [];

    logger.info(`[ProtobufBuilder] Last node ${lastNode.id} outputs:`, {
      hasNodeBindings: !!nodeBindings,
      hasLastNodeBinding: !!nodeBindings?.get(lastNode.id),
      hasOutputs: !!lastNodeOutputs,
      outputsSize: lastNodeOutputs?.size,
      outputKeys: lastNodeOutputs ? Array.from(lastNodeOutputs.keys()) : [],
    });

    if (lastNodeOutputs && lastNodeOutputs.size > 0) {
      // Use the actual output variable names from the task
      Array.from(lastNodeOutputs.keys()).forEach((outputVarName, index) => {
        outputBindings.push({
          var: `o${index}`, // Workflow output variable name
          binding: {
            promise: {
              nodeId: lastNode.id,
              var: outputVarName, // Actual task output variable name
            },
          },
        });
        logger.info(
          `[ProtobufBuilder] Binding workflow output o${index} to ${lastNode.id}.${outputVarName}`
        );
      });
    } else {
      // Fallback to o0 if we don't have output information
      logger.warn(
        `[ProtobufBuilder] No output information for last node ${lastNode.id}, using default o0`
      );
      outputBindings.push({
        var: 'o0',
        binding: {
          promise: {
            nodeId: lastNode.id,
            var: 'o0',
          },
        },
      });
    }

    return outputBindings;
  }

  /**
   * Build nodes (exclude start/end and branch-embedded nodes)
   */
  buildNodes(
    nodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[],
    nodeBindings: Map<
      string,
      { inputs: flyteidl.core.IBinding[]; outputs: Map<string, flyteidl.core.IVariable> }
    >
  ): flyteidl.core.INode[] {
    logger.info('[ProtobufBuilder] Building nodes');

    // Identify branch target nodes (nodes embedded in branch conditions)
    const branchTargetIds = new Set<string>();
    nodes
      .filter((n) => n.type === 'branch')
      .forEach((branchNode) => {
        const config = branchNode.data.branchConfig;
        if (config) {
          if (config.primaryCase?.thenNodeId) branchTargetIds.add(config.primaryCase.thenNodeId);
          config.elseCases?.forEach((c: any) => {
            if (c.thenNodeId) branchTargetIds.add(c.thenNodeId);
          });
          if (config.elseNodeId) branchTargetIds.add(config.elseNodeId);
        }
      });

    // Check which branch targets are referenced by other nodes
    const referencedNodeIds = new Set<string>();
    branchTargetIds.forEach((targetId) => {
      const outgoing = edges.filter((e) => e.source === targetId);
      const hasNonEndTargets = outgoing.some((e) => {
        const target = nodes.find((n) => n.id === e.target);
        return target && target.type !== 'end';
      });
      if (hasNonEndTargets) {
        referencedNodeIds.add(targetId);
      }
    });

    // Only embed nodes that are NOT referenced elsewhere
    const embeddedNodeIds = new Set<string>();
    branchTargetIds.forEach((id) => {
      if (!referencedNodeIds.has(id)) {
        embeddedNodeIds.add(id);
      }
    });

    logger.info(`[ProtobufBuilder] Branch target nodes: ${Array.from(branchTargetIds).join(', ')}`);
    logger.info(`[ProtobufBuilder] Embedded nodes: ${Array.from(embeddedNodeIds).join(', ')}`);

    // Filter nodes to compile
    const nodesToCompile = nodes.filter((node) => {
      if (node.type === 'start' || node.type === 'end') return false;
      if (embeddedNodeIds.has(node.id)) return false;
      return true;
    });

    // Build each node
    const compiledNodes = nodesToCompile.map((node) =>
      this.buildNode(node, nodeBindings.get(node.id)?.inputs || [], edges, nodes, nodeBindings)
    );

    logger.info(`[ProtobufBuilder] Built ${compiledNodes.length} nodes`);

    return compiledNodes;
  }

  /**
   * Build a single node
   */
  buildNode(
    node: WorkflowBuilderNode,
    bindings: flyteidl.core.IBinding[],
    edges: WorkflowBuilderEdge[],
    allNodes: WorkflowBuilderNode[],
    nodeBindings: Map<
      string,
      { inputs: flyteidl.core.IBinding[]; outputs: Map<string, flyteidl.core.IVariable> }
    >
  ): flyteidl.core.INode {
    // Build metadata
    const metadata: flyteidl.core.INodeMetadata = {
      name: node.data.label || node.id,
      timeout: node.data.config?.timeout ? { seconds: node.data.config.timeout } : undefined,
      retries: node.data.config?.retries ? { retries: node.data.config.retries } : undefined,
    };

    // Get upstream node IDs
    const upstreamNodeIds = edges
      .filter((e) => e.target === node.id)
      .map((e) => e.source)
      .filter((id) => {
        const sourceNode = allNodes.find((n) => n.id === id);
        return sourceNode && sourceNode.type !== 'start';
      });

    // Build node structure
    const compiledNode: flyteidl.core.INode = {
      id: node.id,
      metadata,
      inputs: bindings,
      upstreamNodeIds,
    };

    // Add node type-specific data
    if (node.type === 'task' || node.type === 'array_map') {
      // Both task and array_map nodes compile to taskNode
      // Array map configuration is handled at the Python task level (e.g., @map_task decorator)
      compiledNode.taskNode = ProtobufBuilder.buildTaskNode(node);
    } else if (node.type === 'branch') {
      compiledNode.branchNode = this.buildBranchNode(node, allNodes, edges, nodeBindings);
    } else if (node.type === 'subworkflow') {
      compiledNode.workflowNode = ProtobufBuilder.buildSubworkflowNode(node);
    } else if (node.type === 'gate') {
      compiledNode.gateNode = ProtobufBuilder.buildGateNode(node);
    } else {
      throw new Error(`Unsupported node type: ${node.type}`);
    }

    return compiledNode;
  }

  /**
   * Build task node
   */
  static buildTaskNode(node: WorkflowBuilderNode): flyteidl.core.ITaskNode {
    if (!node.data.taskId) {
      throw new Error(`Task node '${node.id}' missing taskId`);
    }

    const referenceId: flyteidl.core.IIdentifier = {
      resourceType: flyteidl.core.ResourceType.TASK,
      project: node.data.taskId.project,
      domain: node.data.taskId.domain,
      name: node.data.taskId.name,
      version: node.data.taskId.version,
    };

    return { referenceId };
  }

  /**
   * Build branch node
   */
  buildBranchNode(
    node: WorkflowBuilderNode,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[],
    nodeBindings: Map<
      string,
      { inputs: flyteidl.core.IBinding[]; outputs: Map<string, flyteidl.core.IVariable> }
    >
  ): flyteidl.core.IBranchNode {
    if (!node.data.branchConfig) {
      throw new Error(`Branch node '${node.id}' missing branchConfig`);
    }

    const config = node.data.branchConfig;

    // Get upstream node for condition evaluation
    const upstreamEdges = edges.filter((e) => e.target === node.id);
    const upstreamNodeId = upstreamEdges.length > 0 ? upstreamEdges[0].source : null;

    logger.info(`[ProtobufBuilder] Building branch node ${node.id}`);
    logger.info(`[ProtobufBuilder] Upstream node: ${upstreamNodeId}`);
    logger.info(
      `[ProtobufBuilder] Branch node bindings count: ${
        nodeBindings.get(node.id)?.inputs?.length || 0
      }`
    );

    // Build primary case (if)
    let primaryCase: flyteidl.core.IIfBlock;
    try {
      primaryCase = {
        condition: this.buildBooleanExpression(config.primaryCase.condition, upstreamNodeId),
        thenNode: this.buildInlineBranchNode(
          config.primaryCase.thenNodeId,
          node.id,
          allNodes,
          edges,
          nodeBindings
        ),
      };
    } catch (error) {
      throw new Error(`Branch node '${node.id}' - IF condition error: ${(error as Error).message}`);
    }

    // Build other cases (else-if)
    const otherCases: flyteidl.core.IIfBlock[] = (config.elseCases || []).map(
      (elseCase: any, index: number) => {
        try {
          return {
            condition: this.buildBooleanExpression(elseCase.condition, upstreamNodeId),
            thenNode: this.buildInlineBranchNode(
              elseCase.thenNodeId,
              node.id,
              allNodes,
              edges,
              nodeBindings
            ),
          };
        } catch (error) {
          throw new Error(
            `Branch node '${node.id}' - ELSE IF ${index + 1} condition error: ${
              (error as Error).message
            }`
          );
        }
      }
    );

    // Build else case
    const elseNode = config.elseNodeId
      ? this.buildInlineBranchNode(config.elseNodeId, node.id, allNodes, edges, nodeBindings)
      : undefined;

    const ifElse: flyteidl.core.IIfElseBlock = {
      case: primaryCase,
      other: otherCases,
      elseNode,
    };

    return { ifElse };
  }

  /**
   * Build inline node for branch (embedded in branch definition)
   */
  buildInlineBranchNode(
    nodeId: string,
    branchNodeId: string,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[],
    nodeBindings: Map<
      string,
      { inputs: flyteidl.core.IBinding[]; outputs: Map<string, flyteidl.core.IVariable> }
    >
  ): flyteidl.core.INode | undefined {
    const targetNode = allNodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      logger.error(`[ProtobufBuilder] ❌ Branch target node '${nodeId}' not found in allNodes`);
      logger.error(`[ProtobufBuilder] Available nodes: ${allNodes.map((n) => n.id).join(', ')}`);
      return undefined;
    }

    logger.info(`[ProtobufBuilder] Building inline branch target: ${nodeId} (${targetNode.type})`);
    logger.info(`[ProtobufBuilder] Target node has bindings: ${nodeBindings.has(targetNode.id)}`);
    logger.info(
      `[ProtobufBuilder] Bindings count: ${nodeBindings.get(targetNode.id)?.inputs.length || 0}`
    );

    // Build metadata
    const metadata: flyteidl.core.INodeMetadata = {
      name: targetNode.data.label || targetNode.id,
      timeout: targetNode.data.config?.timeout
        ? { seconds: targetNode.data.config.timeout }
        : undefined,
      retries: targetNode.data.config?.retries
        ? { retries: targetNode.data.config.retries }
        : undefined,
    };

    // Get bindings for this node
    const inputs = nodeBindings.get(targetNode.id)?.inputs || [];

    // Build inline node
    const compiledNode: flyteidl.core.INode = {
      id: targetNode.id,
      metadata,
      inputs,
      upstreamNodeIds: [],
    };

    // Add type-specific data
    if (targetNode.type === 'task') {
      compiledNode.taskNode = ProtobufBuilder.buildTaskNode(targetNode);
      logger.info(`[ProtobufBuilder] ✓ Built inline task node: ${nodeId}`);
    } else if (targetNode.type === 'branch') {
      compiledNode.branchNode = this.buildBranchNode(targetNode, allNodes, edges, nodeBindings);
      logger.info(`[ProtobufBuilder] ✓ Built inline branch node: ${nodeId}`);
    } else {
      logger.error(`[ProtobufBuilder] ❌ Unsupported inline node type: ${targetNode.type}`);
    }

    return compiledNode;
  }

  /**
   * Build boolean expression for branch conditions
   */
  buildBooleanExpression(
    condition: any,
    upstreamNodeId?: string | null
  ): flyteidl.core.IBooleanExpression {
    // Unwrap condition type wrapper
    if (condition.type === 'comparison' && condition.expression) {
      condition = condition.expression;
    }

    // Handle simple comparison
    if (condition.operator && condition.leftValue && condition.rightValue) {
      // Validate that field values are not empty
      if (condition.leftValue.type === 'field' && !condition.leftValue.field) {
        throw new Error(
          'Branch condition has empty field reference. Please configure the condition properly in the branch node dialog.'
        );
      }

      return {
        comparison: {
          operator: ProtobufBuilder.mapComparisonOperator(condition.operator),
          leftValue: ProtobufBuilder.buildOperand(condition.leftValue, upstreamNodeId),
          rightValue: ProtobufBuilder.buildOperand(condition.rightValue, upstreamNodeId),
        },
      };
    }

    // Handle conjunction (AND)
    if (condition.conjunction) {
      return {
        conjunction: {
          operator: flyteidl.core.ConjunctionExpression.LogicalOperator.AND,
          leftExpression: this.buildBooleanExpression(condition.conjunction.left, upstreamNodeId),
          rightExpression: this.buildBooleanExpression(condition.conjunction.right, upstreamNodeId),
        },
      };
    }

    throw new Error(
      'Invalid boolean expression structure. Branch conditions must have either a comparison or conjunction.'
    );
  }

  /**
   * Map comparison operator
   */
  static mapComparisonOperator(op: string): flyteidl.core.ComparisonExpression.Operator {
    const mapping: Record<string, flyteidl.core.ComparisonExpression.Operator> = {
      '==': flyteidl.core.ComparisonExpression.Operator.EQ,
      '!=': flyteidl.core.ComparisonExpression.Operator.NEQ,
      '>': flyteidl.core.ComparisonExpression.Operator.GT,
      '>=': flyteidl.core.ComparisonExpression.Operator.GTE,
      '<': flyteidl.core.ComparisonExpression.Operator.LT,
      '<=': flyteidl.core.ComparisonExpression.Operator.LTE,
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
   * Build operand (field reference or constant)
   *
   * IMPORTANT: Flyte task outputs are accessed via output variable names (typically 'o0')
   * To access nested fields in the output struct: node.o0.field_name
   * To access the entire output: node.o0
   */
  static buildOperand(operand: any, upstreamNodeId?: string | null): flyteidl.core.IOperand {
    // Field reference
    if (operand.type === 'field') {
      // Check that field is not empty or undefined
      if (!operand.field || operand.field === '') {
        throw new Error(
          'Branch condition has empty field reference. Please configure the condition with a valid field.'
        );
      }

      let fieldName = operand.field;

      // Extract field name if it contains node reference
      if (fieldName.includes('.')) {
        const parts = fieldName.split('.');
        fieldName = parts[parts.length - 1];
      }

      if (upstreamNodeId) {
        // Reference upstream node's output variable
        // IMPORTANT: For STRUCT outputs, Flyte doesn't support nested field access in branch conditions
        // at compile time. We reference the whole output (node-id.o0) and let Flyte resolve fields at runtime.
        // Format: node-id.o0 (not node-id.o0.field_name)
        logger.info(
          `[ProtobufBuilder] Branch condition referencing whole output: ${upstreamNodeId}.o0 (field '${fieldName}' will be resolved at runtime)`
        );
        return { var: `${upstreamNodeId}.o0` };
      }
      return { var: `input.${fieldName}` };
    }

    // Constant value
    if (operand.type === 'constant' && operand.constant) {
      const value =
        operand.constant.value !== undefined ? operand.constant.value : operand.constant;
      return { primitive: ProtobufBuilder.buildScalar(value).primitive };
    }

    // Direct value
    if (operand.value !== undefined) {
      return { primitive: ProtobufBuilder.buildScalar(operand.value).primitive };
    }

    // Primitive value
    if (
      typeof operand === 'string' ||
      typeof operand === 'number' ||
      typeof operand === 'boolean'
    ) {
      return { primitive: ProtobufBuilder.buildScalar(operand).primitive };
    }

    throw new Error('Unsupported operand type');
  }

  /**
   * Build scalar value
   */
  static buildScalar(value: any): flyteidl.core.IScalar {
    if (typeof value === 'string') {
      return { primitive: { stringValue: value } };
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { primitive: { integer: value as any } };
      }
      return { primitive: { floatValue: value } };
    }
    if (typeof value === 'boolean') {
      return { primitive: { boolean: value } };
    }
    throw new Error(`Unsupported scalar type: ${typeof value}`);
  }

  /**
   * Build subworkflow node
   */
  static buildSubworkflowNode(node: WorkflowBuilderNode): flyteidl.core.IWorkflowNode {
    if (!node.data.workflowId) {
      throw new Error(`Subworkflow node '${node.id}' missing workflowId`);
    }

    const subWorkflowRef: flyteidl.core.IIdentifier = {
      resourceType: flyteidl.core.ResourceType.WORKFLOW,
      project: node.data.workflowId.project,
      domain: node.data.workflowId.domain,
      name: node.data.workflowId.name,
      version: node.data.workflowId.version,
    };

    return { subWorkflowRef };
  }

  /**
   * Build gate node
   */
  static buildGateNode(node: WorkflowBuilderNode): flyteidl.core.IGateNode {
    if (!node.data.gateConfig) {
      throw new Error(`Gate node '${node.id}' missing gateConfig`);
    }

    const config = node.data.gateConfig;
    const gateNode: flyteidl.core.IGateNode = {};

    // Build gate condition based on type
    switch (config.type) {
      case 'approve': {
        gateNode.approve = {
          signalId: config.signalId,
        };
        break;
      }

      case 'signal': {
        gateNode.signal = {
          signalId: config.signalId,
          outputVariableName: config.outputVariableName || 'signal_output',
          // Note: type conversion from signalType string to LiteralType would go here
          // For now, we'll omit type field if not provided
        };
        break;
      }

      case 'sleep': {
        if (!config.duration?.seconds) {
          throw new Error(`Sleep gate node '${node.id}' missing duration.seconds`);
        }
        gateNode.sleep = {
          duration: {
            seconds: config.duration.seconds as any, // Cast to Long type for protobuf
            nanos: 0,
          },
        };
        break;
      }

      default:
        throw new Error(`Unsupported gate type: ${(config as any).type}`);
    }

    logger.info(`[ProtobufBuilder] Built gate node ${node.id} with type ${config.type}`);

    return gateNode;
  }

  /**
   * Build connections (downstream/upstream maps)
   */
  static buildConnections(
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

        downstream[node.id] = { ids: targetIds };
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

        upstream[node.id] = { ids: sourceIds };
      });

    return { downstream, upstream };
  }
}
