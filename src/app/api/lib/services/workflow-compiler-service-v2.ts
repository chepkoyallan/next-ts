/**
 * Workflow Compiler Service V2 (Minimal)
 * Streamlined compiler focused ONLY on tasks and branch nodes using protobuf definitions
 *
 * Key Features:
 * - Direct protobuf usage (no abstractions)
 * - Task node compilation (referenceId based)
 * - Branch node compilation (if/else blocks)
 * - Minimal bindings (promise-based data flow)
 * - No validation, no wrapping, no complexity
 */

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import type {
  WorkflowDraft,
  WorkflowBuilderNode,
  WorkflowBuilderEdge,
} from './workflow-draft-service';

/**
 * Minimal compilation result
 */
export interface MinimalCompilationResult {
  closure: flyteidl.core.ICompiledWorkflowClosure;
  stats: {
    nodeCount: number;
    taskCount: number;
    branchCount: number;
  };
}

/**
 * Minimal Workflow Compiler Service V2
 * Focus: Tasks and Branches ONLY
 */
export class WorkflowCompilerServiceV2 {
  /**
   * Compile a workflow draft to Flyte protobuf format
   */
  compile(draft: WorkflowDraft): MinimalCompilationResult {
    console.log('[CompilerV2] Starting minimal compilation');
    console.log(
      `[CompilerV2] Workflow: ${draft.project}/${draft.domain}/${draft.name}:${draft.version}`
    );

    // Build workflow template
    const template = this.compileWorkflowTemplate(draft);

    // Build connections (upstream/downstream maps)
    const connections = WorkflowCompilerServiceV2.compileConnections(draft.nodes, draft.edges);

    // Build primary workflow
    const primary: flyteidl.core.ICompiledWorkflow = {
      template,
      connections,
    };

    // Create closure (tasks are registered separately in Flyte)
    const closure: flyteidl.core.ICompiledWorkflowClosure = {
      primary,
      tasks: [], // Empty - tasks are pre-registered
      subWorkflows: [], // Not supported in v2
    };

    // Calculate stats (count actual compiled nodes)
    const stats = {
      nodeCount: template.nodes?.length || 0,
      taskCount: template.nodes?.filter((n) => n.taskNode).length || 0,
      branchCount: template.nodes?.filter((n) => n.branchNode).length || 0,
    };

    console.log('[CompilerV2] ✅ Compilation successful:', stats);

    // Debug logging
    console.log(
      '[CompilerV2] Debug: Compiled nodes:',
      template.nodes?.map((n) => ({ id: n.id, type: n.taskNode ? 'task' : 'branch' }))
    );
    console.log('[CompilerV2] Debug: Workflow outputs:', template.outputs);

    return { closure, stats };
  }

  /**
   * Compile workflow template
   */
  private compileWorkflowTemplate(draft: WorkflowDraft): flyteidl.core.IWorkflowTemplate {
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

    // Build nodes (exclude start/end and branch-embedded nodes)
    const nodes = this.compileNodes(draft.nodes, draft.edges);

    // Build workflow interface
    const workflowInterface = this.compileWorkflowInterface(draft);

    // Build output bindings
    const outputs = WorkflowCompilerServiceV2.compileWorkflowOutputs(draft.nodes, draft.edges);

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
   */
  private compileWorkflowInterface(draft: WorkflowDraft): flyteidl.core.ITypedInterface {
    // Find first node (no incoming edges, excluding start)
    const firstNodes = draft.nodes.filter(
      (n) => n.type !== 'start' && !draft.edges.some((e) => e.target === n.id)
    );

    // Find last node (no outgoing edges, excluding end)
    // const lastNodes = draft.nodes.filter((n) => {
    //   if (n.type === 'end' || n.type === 'start') return false;
    //   const outgoing = draft.edges.filter((e) => e.source === n.id);
    //   return (
    //     outgoing.length === 0 ||
    //     outgoing.every((e) => {
    //       const target = draft.nodes.find((node) => node.id === e.target);
    //       return target?.type === 'end';
    //     })
    //   );
    // });

    // Extract inputs from first task node
    let inputs: flyteidl.core.IVariableMap | undefined;
    const firstTaskNode = firstNodes.find((n) => n.type === 'task');
    if (firstTaskNode?.data.inputSchema?.properties) {
      inputs = this.schemaToVariableMap(firstTaskNode.data.inputSchema);
    } else {
      // Default input
      inputs = {
        variables: {
          workflow_input: {
            type: { simple: flyteidl.core.SimpleType.STRUCT },
            description: 'Default workflow input',
          },
        },
      };
    }

    // Use simple STRUCT output (schemas are just for frontend)
    const outputs: flyteidl.core.IVariableMap = {
      variables: {
        o0: {
          type: { simple: flyteidl.core.SimpleType.STRUCT },
          description: 'Workflow output',
        },
      },
    };

    return { inputs, outputs };
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
        return { simple: flyteidl.core.SimpleType.STRING };
      case 'integer':
        return { simple: flyteidl.core.SimpleType.INTEGER };
      case 'number':
        return { simple: flyteidl.core.SimpleType.FLOAT };
      case 'boolean':
        return { simple: flyteidl.core.SimpleType.BOOLEAN };
      case 'array':
        return {
          collectionType: field.items
            ? this.jsonTypeToLiteralType(field.items)
            : { simple: flyteidl.core.SimpleType.STRING },
        };
      case 'object':
        return { simple: flyteidl.core.SimpleType.STRUCT };
      default:
        return { simple: flyteidl.core.SimpleType.STRING };
    }
  }

  /**
   * Compile nodes (exclude start/end and branch-embedded nodes)
   */
  private compileNodes(
    nodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): flyteidl.core.INode[] {
    // Identify branch target nodes
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

    // Identify nodes that are referenced by other nodes (in conditions, bindings, etc.)
    const referencedNodeIds = new Set<string>();

    // Check branch conditions for node references
    nodes
      .filter((n) => n.type === 'branch')
      .forEach((branchNode) => {
        const config = branchNode.data.branchConfig;
        if (config) {
          // Check if conditions reference any nodes
          const extractNodeReferences = (condition: any) => {
            if (condition?.expression) {
              condition = condition.expression;
            }
            if (condition?.leftValue?.field) {
              const { field } = condition.leftValue;
              if (field.includes('.')) {
                const nodeId = field.split('.')[0];
                if (nodeId.startsWith('node-')) {
                  referencedNodeIds.add(nodeId);
                }
              }
            }
            if (condition?.rightValue?.field) {
              const { field } = condition.rightValue;
              if (field.includes('.')) {
                const nodeId = field.split('.')[0];
                if (nodeId.startsWith('node-')) {
                  referencedNodeIds.add(nodeId);
                }
              }
            }
          };

          if (config.primaryCase?.condition) {
            extractNodeReferences(config.primaryCase.condition);
          }
          config.elseCases?.forEach((c: any) => {
            if (c.condition) {
              extractNodeReferences(c.condition);
            }
          });
        }
      });

    // Check if any node has outgoing edges to non-end nodes
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

    // Branch targets should only be embedded if they are NOT referenced elsewhere
    const embeddedNodeIds = new Set<string>();
    branchTargetIds.forEach((id) => {
      if (!referencedNodeIds.has(id)) {
        embeddedNodeIds.add(id);
      }
    });

    console.log('[CompilerV2] Branch target nodes:', Array.from(branchTargetIds));
    console.log('[CompilerV2] Referenced nodes:', Array.from(referencedNodeIds));
    console.log('[CompilerV2] Embedded nodes:', Array.from(embeddedNodeIds));

    // Filter nodes
    const nodesToCompile = nodes.filter((node) => {
      if (node.type === 'start' || node.type === 'end') return false;
      if (embeddedNodeIds.has(node.id)) return false; // Only exclude truly embedded nodes
      return true;
    });

    // Compile each node
    return nodesToCompile.map((node) => this.compileNode(node, nodes, edges));
  }

  /**
   * Compile a single node
   */
  private compileNode(
    node: WorkflowBuilderNode,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
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

    // Build input bindings
    const inputs = WorkflowCompilerServiceV2.compileNodeInputs(node, allNodes, edges);

    // Build node structure
    const compiledNode: flyteidl.core.INode = {
      id: node.id,
      metadata,
      inputs,
      upstreamNodeIds,
    };

    // Add node type-specific data
    if (node.type === 'task') {
      compiledNode.taskNode = WorkflowCompilerServiceV2.compileTaskNode(node);
    } else if (node.type === 'branch') {
      compiledNode.branchNode = this.compileBranchNode(node, allNodes, edges);
    } else {
      throw new Error(`Unsupported node type: ${node.type}`);
    }

    return compiledNode;
  }

  /**
   * Compile task node
   */
  private static compileTaskNode(node: WorkflowBuilderNode): flyteidl.core.ITaskNode {
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
   * Compile branch node
   */
  private compileBranchNode(
    node: WorkflowBuilderNode,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): flyteidl.core.IBranchNode {
    if (!node.data.branchConfig) {
      throw new Error(`Branch node '${node.id}' missing branchConfig`);
    }

    const config = node.data.branchConfig;

    // Get upstream node for condition
    const upstreamEdges = edges.filter((e) => e.target === node.id);
    const upstreamNodeId = upstreamEdges.length > 0 ? upstreamEdges[0].source : null;

    // Build primary case
    const primaryCase: flyteidl.core.IIfBlock = {
      condition: this.compileBooleanExpression(config.primaryCase.condition, upstreamNodeId),
      thenNode: this.compileInlineBranchNode(
        config.primaryCase.thenNodeId,
        node.id,
        allNodes,
        edges
      ),
    };

    // Build other cases (else-if)
    const otherCases: flyteidl.core.IIfBlock[] = config.elseCases.map((elseCase: any) => ({
      condition: this.compileBooleanExpression(elseCase.condition, upstreamNodeId),
      thenNode: this.compileInlineBranchNode(elseCase.thenNodeId, node.id, allNodes, edges),
    }));

    // Build else case
    const elseNode = config.elseNodeId
      ? this.compileInlineBranchNode(config.elseNodeId, node.id, allNodes, edges)
      : undefined;

    const ifElse: flyteidl.core.IIfElseBlock = {
      case: primaryCase,
      other: otherCases,
      elseNode,
    };

    return { ifElse };
  }

  /**
   * Compile inline node for branch (embedded in branch definition)
   */
  private compileInlineBranchNode(
    nodeId: string,
    branchNodeId: string,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): flyteidl.core.INode | undefined {
    const targetNode = allNodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      console.warn(
        `[CompilerV2] Branch target node '${nodeId}' not found in nodes:`,
        allNodes.map((n) => n.id)
      );
      return undefined;
    }

    console.log(`[CompilerV2] Compiling inline branch target: ${nodeId} (${targetNode.type})`);

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

    // Build inputs (minimal - inherit from branch input)
    const inputs: flyteidl.core.IBinding[] = [];
    const branchInputEdges = edges.filter((e) => e.target === branchNodeId);
    if (branchInputEdges.length > 0) {
      const sourceNodeId = branchInputEdges[0].source;
      const sourceNode = allNodes.find((n) => n.id === sourceNodeId);
      if (sourceNode && sourceNode.type !== 'start') {
        inputs.push({
          var: 'input',
          binding: {
            promise: {
              nodeId: sourceNodeId,
              var: 'o0', // Default task output variable
            },
          },
        });
      }
    }

    // Build inline node
    const compiledNode: flyteidl.core.INode = {
      id: targetNode.id,
      metadata,
      inputs,
      upstreamNodeIds: [], // Empty for inline nodes
    };

    // Add type-specific data
    if (targetNode.type === 'task') {
      compiledNode.taskNode = WorkflowCompilerServiceV2.compileTaskNode(targetNode);
    } else if (targetNode.type === 'branch') {
      compiledNode.branchNode = this.compileBranchNode(targetNode, allNodes, edges);
    }

    return compiledNode;
  }

  /**
   * Compile boolean expression
   */
  private compileBooleanExpression(
    condition: any,
    upstreamNodeId?: string | null
  ): flyteidl.core.IBooleanExpression {
    // Unwrap condition type wrapper
    if (condition.type === 'comparison' && condition.expression) {
      condition = condition.expression;
    }

    // Handle simple comparison
    if (condition.operator && condition.leftValue && condition.rightValue) {
      return {
        comparison: {
          operator: WorkflowCompilerServiceV2.mapComparisonOperator(condition.operator),
          leftValue: WorkflowCompilerServiceV2.compileOperand(condition.leftValue, upstreamNodeId),
          rightValue: WorkflowCompilerServiceV2.compileOperand(
            condition.rightValue,
            upstreamNodeId
          ),
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

    throw new Error('Invalid boolean expression');
  }

  /**
   * Map comparison operator
   */
  private static mapComparisonOperator(op: string): flyteidl.core.ComparisonExpression.Operator {
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
   * Compile operand (field reference or constant)
   */
  private static compileOperand(
    operand: any,
    upstreamNodeId?: string | null
  ): flyteidl.core.IOperand {
    // Field reference
    if (operand.type === 'field' && operand.field) {
      let fieldName = operand.field;

      // Handle case where field already contains node reference (e.g., "node-123.field_name")
      // Extract just the field name part
      if (fieldName.includes('.')) {
        const parts = fieldName.split('.');
        fieldName = parts[parts.length - 1]; // Get the last part (field name)
      }

      if (upstreamNodeId) {
        return { var: `${upstreamNodeId}.${fieldName}` };
      }
      return { var: `input.${fieldName}` };
    }

    // Constant value
    if (operand.type === 'constant' && operand.constant) {
      const value =
        operand.constant.value !== undefined ? operand.constant.value : operand.constant;
      return { primitive: WorkflowCompilerServiceV2.compileScalar(value).primitive };
    }

    // Direct value
    if (operand.value !== undefined) {
      return { primitive: WorkflowCompilerServiceV2.compileScalar(operand.value).primitive };
    }

    // Primitive value
    if (
      typeof operand === 'string' ||
      typeof operand === 'number' ||
      typeof operand === 'boolean'
    ) {
      return { primitive: WorkflowCompilerServiceV2.compileScalar(operand).primitive };
    }

    throw new Error('Unsupported operand type');
  }

  /**
   * Compile scalar value
   */
  private static compileScalar(value: any): flyteidl.core.IScalar {
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
   * Compile node inputs (minimal - promise bindings only)
   */
  private static compileNodeInputs(
    node: WorkflowBuilderNode,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): flyteidl.core.IBinding[] {
    const bindings: flyteidl.core.IBinding[] = [];

    // Get incoming edges
    const incomingEdges = edges.filter((e) => e.target === node.id);

    // Build edge bindings
    incomingEdges.forEach((edge) => {
      const sourceNode = allNodes.find((n) => n.id === edge.source);
      if (!sourceNode || sourceNode.type === 'start') return;

      // Check for field mappings
      if (edge.data?.fieldMappings && edge.data.fieldMappings.length > 0) {
        edge.data.fieldMappings.forEach((mapping) => {
          bindings.push({
            var: mapping.targetField,
            binding: {
              promise: {
                nodeId: edge.source,
                var: mapping.sourceField,
              },
            },
          });
        });
      } else {
        // Default pass-through binding
        bindings.push({
          var: 'input',
          binding: {
            promise: {
              nodeId: edge.source,
              var: 'o0', // Default task output variable
            },
          },
        });
      }
    });

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

  /**
   * Compile workflow outputs
   */
  private static compileWorkflowOutputs(
    nodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): flyteidl.core.IBinding[] {
    // Find last nodes (no outgoing edges or only to 'end')
    const lastNodes = nodes.filter((n) => {
      if (n.type === 'end' || n.type === 'start') return false;
      const outgoing = edges.filter((e) => e.source === n.id);
      return (
        outgoing.length === 0 ||
        outgoing.every((e) => {
          const target = nodes.find((node) => node.id === e.target);
          return target?.type === 'end';
        })
      );
    });

    if (lastNodes.length === 0) return [];

    // Check if last node is a branch
    const lastNode = lastNodes[0];
    if (lastNode.type === 'branch') {
      return [
        {
          var: 'output',
          binding: {
            promise: {
              nodeId: lastNode.id,
              var: 'output',
            },
          },
        },
      ];
    }

    // Task node output - Use simple o0 binding (schemas are just for frontend)
    return [
      {
        var: 'o0',
        binding: {
          promise: {
            nodeId: lastNode.id,
            var: 'o0',
          },
        },
      },
    ];
  }
}

// Export singleton instance
export const workflowCompilerServiceV2 = new WorkflowCompilerServiceV2();
