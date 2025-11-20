/**
 * Workflow Compiler Service V3 - gRPC-Ready
 *
 * Compiles workflow drafts into Flyte protobuf format for gRPC deployment.
 * Focuses on task and branch nodes with proper inputData to Literal mapping.
 *
 * Key Features:
 * - Task nodes: Maps inputData to Flyte Literals for execution
 * - Branch nodes: Compiles if/else with condition evaluation
 * - gRPC ready: Direct protobuf output for CreateWorkflow calls
 * - Minimal overhead: No abstractions, pure protobuf
 * - Smart binding: Fetches task interface to filter inputData fields
 */

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import type {
  WorkflowDraft,
  WorkflowBuilderNode,
  WorkflowBuilderEdge,
} from './workflow-draft-service';

/**
 * Compilation result for gRPC deployment
 */
export interface CompilationResultV3 {
  // Compiled workflow closure (ready for gRPC)
  closure: flyteidl.core.ICompiledWorkflowClosure;

  // Workflow identifier
  id: flyteidl.core.IIdentifier;

  // Compilation statistics
  stats: {
    nodeCount: number;
    taskCount: number;
    branchCount: number;
  };
}

/**
 * Task interface information fetched from API
 */
interface TaskInterfaceInfo {
  inputVariables: Set<string>;
  outputVariables: Set<string>;
  requestsIsSimpleStruct?: boolean;
  requestsIsCollection?: boolean;
}

/**
 * Workflow Compiler Service V3
 * gRPC-ready compiler for task and branch nodes with smart binding
 */
export class WorkflowCompilerServiceV3 {
  private taskInterfaceCache = new Map<string, TaskInterfaceInfo>();
  private baseUrl: string;
  private adminService: any; // AdminService for direct gRPC queries

  constructor(baseUrl: string = '', adminService?: any) {
    // For server-side compilation, baseUrl can be empty (internal API calls)
    // For client-side, it would be the full URL
    this.baseUrl = baseUrl;
    this.adminService = adminService;
  }

  /**
   * Fetch task interface from AdminService (gRPC) or API endpoint
   */
  private async fetchTaskInterface(taskId: {
    project: string;
    domain: string;
    name: string;
    version: string;
  }): Promise<TaskInterfaceInfo | null> {
    const cacheKey = `${taskId.project}:${taskId.domain}:${taskId.name}:${taskId.version}`;

    // Check cache
    if (this.taskInterfaceCache.has(cacheKey)) {
      console.log(`[CompilerV3] Cache hit for task interface: ${cacheKey}`);
      return this.taskInterfaceCache.get(cacheKey)!;
    }

    // Try AdminService first (server-side, no HTTP call needed)
    if (this.adminService) {
      try {
        console.log(`[CompilerV3] Fetching task interface via gRPC: ${cacheKey}`);
        const task = await this.adminService.getTask({
          id: {
            resourceType: 1, // TASK
            project: taskId.project,
            domain: taskId.domain,
            name: taskId.name,
            version: taskId.version,
          },
        });

        if (task && task.closure?.compiledTask?.template?.interface) {
          const taskInterface = task.closure.compiledTask.template.interface;
          const inputVariables = new Set(Object.keys(taskInterface.inputs?.variables || {}));
          const outputVariables = new Set(Object.keys(taskInterface.outputs?.variables || {}));

          const interfaceInfo: TaskInterfaceInfo = {
            inputVariables,
            outputVariables,
          };

          console.log(`[CompilerV3] Task ${cacheKey} interface (gRPC):`, {
            inputs: Array.from(inputVariables),
            outputs: Array.from(outputVariables),
          });

          // Log the actual type of the 'requests' parameter and cache it for binding logic
          if (task.closure?.compiledTask?.template?.interface?.inputs?.variables?.requests) {
            const requestsVar =
              task.closure.compiledTask.template.interface.inputs.variables.requests;
            console.log(
              `[CompilerV3] 'requests' parameter type:`,
              JSON.stringify(requestsVar.type, null, 2)
            );

            // Store the type information for use in binding
            interfaceInfo.requestsIsSimpleStruct = requestsVar.type?.simple === 9; // STRUCT
            interfaceInfo.requestsIsCollection = !!requestsVar.type?.collectionType;

            console.log(`[CompilerV3] *** REQUESTS TYPE FLAGS SET ***:`, {
              requestsIsSimpleStruct: interfaceInfo.requestsIsSimpleStruct,
              requestsIsCollection: interfaceInfo.requestsIsCollection,
              simpleValue: requestsVar.type?.simple,
            });
          }

          this.taskInterfaceCache.set(cacheKey, interfaceInfo);
          return interfaceInfo;
        }
      } catch (grpcError) {
        console.warn(`[CompilerV3] gRPC fetch failed, falling back to HTTP: ${grpcError}`);
      }
    }

    // Fallback to HTTP API
    try {
      console.log(`[CompilerV3] Fetching task interface from API: ${cacheKey}`);

      // Build query params for GET /api/v1/engine/tasks
      const params = new URLSearchParams({
        domain: taskId.domain,
        name: taskId.name,
        version: taskId.version,
        limit: '1',
      });

      const url = `${this.baseUrl}/api/v1/engine/tasks?${params}`;
      console.log(`[CompilerV3] API URL: ${url}`);

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(
            `[CompilerV3] API request failed: ${response.status} ${response.statusText}`
          );
          return null;
        }

        const result = await response.json();

        if (!result.success || !result.data?.tasks || result.data.tasks.length === 0) {
          console.warn(`[CompilerV3] No task found for ${cacheKey}`);
          return null;
        }

        const task = result.data.tasks[0];
        const taskInterface = task.closure?.compiledTask?.template?.interface;

        if (!taskInterface) {
          console.warn(`[CompilerV3] No interface found in task response for ${cacheKey}`);
          return null;
        }

        // Extract input and output variable names
        const inputVariables = new Set(Object.keys(taskInterface.inputs?.variables || {}));
        const outputVariables = new Set(Object.keys(taskInterface.outputs?.variables || {}));

        const interfaceInfo: TaskInterfaceInfo = {
          inputVariables,
          outputVariables,
        };

        console.log(`[CompilerV3] Task ${cacheKey} interface:`, {
          inputs: Array.from(inputVariables),
          outputs: Array.from(outputVariables),
        });
        console.log(
          `[CompilerV3] Full task interface structure:`,
          JSON.stringify(taskInterface, null, 2)
        );

        // Cache the result
        this.taskInterfaceCache.set(cacheKey, interfaceInfo);
        return interfaceInfo;
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error(`[CompilerV3] Task interface fetch timeout for ${cacheKey}`);
        } else {
          console.error(
            `[CompilerV3] Task interface fetch error for ${cacheKey}:`,
            fetchError.message
          );
        }
        return null;
      }
    } catch (error) {
      console.error(`[CompilerV3] Failed to fetch task interface for ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Compile a workflow draft to Flyte protobuf format
   */
  async compile(draft: WorkflowDraft): Promise<CompilationResultV3> {
    console.log('='.repeat(80));
    console.log(
      '[CompilerV3] *** UPDATED COMPILER V3 WITH FIELD FILTERING - TIMESTAMP:',
      new Date().toISOString(),
      ' ***'
    );
    console.log('='.repeat(80));
    console.log('[CompilerV3] Starting gRPC-ready compilation');
    console.log(
      `[CompilerV3] Workflow: ${draft.project}/${draft.domain}/${draft.name}:${draft.version}`
    );
    console.log(`[CompilerV3] Number of nodes: ${draft.nodes.length}`);

    // Log first task node's inputData
    const firstTaskNode = draft.nodes.find((n) => n.type === 'task');
    if (firstTaskNode && firstTaskNode.data.inputData) {
      console.log(
        `[CompilerV3] First task node ${firstTaskNode.id} inputData keys:`,
        Object.keys(firstTaskNode.data.inputData)
      );
      if (firstTaskNode.data.inputData.requests) {
        console.log(
          `[CompilerV3] First task node 'requests' field is array:`,
          Array.isArray(firstTaskNode.data.inputData.requests),
          ', length:',
          Array.isArray(firstTaskNode.data.inputData.requests)
            ? firstTaskNode.data.inputData.requests.length
            : 'N/A'
        );
      }
    }

    // Build workflow identifier
    const id: flyteidl.core.IIdentifier = {
      resourceType: flyteidl.core.ResourceType.WORKFLOW,
      project: draft.project,
      domain: draft.domain,
      name: draft.name,
      version: draft.version,
    };

    // Build workflow template (now async due to task interface fetching)
    const template = await this.compileWorkflowTemplate(draft);

    // Build connections (upstream/downstream maps)
    const connections = WorkflowCompilerServiceV3.compileConnections(draft.nodes, draft.edges);

    // Build primary workflow
    const primary: flyteidl.core.ICompiledWorkflow = {
      template,
      connections,
    };

    // Create closure (tasks are registered separately in Flyte)
    const closure: flyteidl.core.ICompiledWorkflowClosure = {
      primary,
      tasks: [], // Empty - tasks are pre-registered in Flyte
      subWorkflows: [], // Not supported yet
    };

    // Calculate stats
    const stats = {
      nodeCount: template.nodes?.length || 0,
      taskCount: template.nodes?.filter((n) => n.taskNode).length || 0,
      branchCount: template.nodes?.filter((n) => n.branchNode).length || 0,
    };

    console.log('[CompilerV3] ✅ Compilation successful:', stats);

    return { closure, id, stats };
  }

  /**
   * Compile workflow template
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

    // Build nodes (exclude start/end) - now async
    const nodes = await this.compileNodes(draft.nodes, draft.edges);

    // Build workflow interface
    const workflowInterface = WorkflowCompilerServiceV3.compileWorkflowInterface(draft);

    // Build output bindings
    const outputs = WorkflowCompilerServiceV3.compileWorkflowOutputs(draft.nodes, draft.edges);

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
   * For headless workflows, we use empty inputs since inputData is bound directly
   */
  private static compileWorkflowInterface(draft: WorkflowDraft): flyteidl.core.ITypedInterface {
    // Empty inputs for headless workflows
    const inputs: flyteidl.core.IVariableMap = {
      variables: {},
    };

    // Simple STRUCT output
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
  private async compileNodes(
    nodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): Promise<flyteidl.core.INode[]> {
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

    // Check if branch targets have outgoing edges to non-end nodes
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

    console.log('[CompilerV3] Branch target nodes:', Array.from(branchTargetIds));
    console.log('[CompilerV3] Embedded nodes:', Array.from(embeddedNodeIds));

    // Filter nodes to compile
    const nodesToCompile = nodes.filter((node) => {
      if (node.type === 'start' || node.type === 'end') return false;
      if (embeddedNodeIds.has(node.id)) return false;
      return true;
    });

    // Compile each node - now async
    const compiledNodes = await Promise.all(
      nodesToCompile.map((node) => this.compileNode(node, nodes, edges))
    );
    return compiledNodes;
  }

  /**
   * Compile a single node
   */
  private async compileNode(
    node: WorkflowBuilderNode,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): Promise<flyteidl.core.INode> {
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

    // Build input bindings - now async with task interface lookup
    const inputs = await this.compileNodeInputs(node, allNodes, edges);

    // Build node structure
    const compiledNode: flyteidl.core.INode = {
      id: node.id,
      metadata,
      inputs,
      upstreamNodeIds,
    };

    // Add node type-specific data
    if (node.type === 'task') {
      compiledNode.taskNode = WorkflowCompilerServiceV3.compileTaskNode(node);
    } else if (node.type === 'branch') {
      compiledNode.branchNode = await this.compileBranchNode(node, allNodes, edges);
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
  private async compileBranchNode(
    node: WorkflowBuilderNode,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): Promise<flyteidl.core.IBranchNode> {
    if (!node.data.branchConfig) {
      throw new Error(`Branch node '${node.id}' missing branchConfig`);
    }

    const config = node.data.branchConfig;

    // Get upstream node for condition evaluation
    const upstreamEdges = edges.filter((e) => e.target === node.id);
    const upstreamNodeId = upstreamEdges.length > 0 ? upstreamEdges[0].source : null;

    // Build primary case (if)
    const primaryCase: flyteidl.core.IIfBlock = {
      condition: this.compileBooleanExpression(config.primaryCase.condition, upstreamNodeId),
      thenNode: await this.compileInlineBranchNode(
        config.primaryCase.thenNodeId,
        node.id,
        allNodes,
        edges
      ),
    };

    // Build other cases (else-if)
    const otherCases: flyteidl.core.IIfBlock[] = await Promise.all(
      (config.elseCases || []).map(async (elseCase: any) => ({
        condition: this.compileBooleanExpression(elseCase.condition, upstreamNodeId),
        thenNode: await this.compileInlineBranchNode(elseCase.thenNodeId, node.id, allNodes, edges),
      }))
    );

    // Build else case
    const elseNode = config.elseNodeId
      ? await this.compileInlineBranchNode(config.elseNodeId, node.id, allNodes, edges)
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
  private async compileInlineBranchNode(
    nodeId: string,
    branchNodeId: string,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): Promise<flyteidl.core.INode | undefined> {
    const targetNode = allNodes.find((n) => n.id === nodeId);
    if (!targetNode) {
      console.warn(`[CompilerV3] Branch target node '${nodeId}' not found`);
      return undefined;
    }

    console.log(`[CompilerV3] Compiling inline branch target: ${nodeId} (${targetNode.type})`);

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

    // Build inputs - use inputData if available, otherwise inherit from branch input
    const inputs: flyteidl.core.IBinding[] = [];

    if (targetNode.data.inputData && Object.keys(targetNode.data.inputData).length > 0) {
      // Node has static inputData - use smart binding with task interface
      console.log(
        `[CompilerV3] >>> INLINE BRANCH NODE PATH: Binding node ${targetNode.id} inputData fields`
      );

      // Get task input variables from task interface
      let taskInterface: TaskInterfaceInfo | null = null;
      if (targetNode.data.taskId) {
        taskInterface = await this.fetchTaskInterface(targetNode.data.taskId);
      }

      // Determine which fields to bind
      const inputDataKeys = Object.keys(targetNode.data.inputData);
      const fieldsToBinding = taskInterface
        ? inputDataKeys.filter((key) => taskInterface!.inputVariables.has(key))
        : inputDataKeys.filter((key) => ['requests', 'pipeline_config'].includes(key));

      console.log(`[CompilerV3] Inline: Input data keys: ${inputDataKeys.join(', ')}`);
      console.log(
        `[CompilerV3] Inline: Task interface vars: ${
          taskInterface
            ? Array.from(taskInterface.inputVariables).join(', ')
            : 'not available (using fallback)'
        }`
      );
      console.log(`[CompilerV3] Inline: Fields to bind: ${fieldsToBinding.join(', ')}`);

      // Bind matching fields
      fieldsToBinding.forEach((fieldName) => {
        let value = targetNode.data.inputData![fieldName];
        console.log(
          `[CompilerV3] Inline: Binding field: ${fieldName}, type: ${
            Array.isArray(value) ? 'array' : typeof value
          }`
        );

        // Debug: Log workaround check
        if (fieldName === 'requests') {
          console.log(`[CompilerV3] Inline DEBUG requests field:`, {
            isArray: Array.isArray(value),
            hasTaskInterface: !!taskInterface,
            requestsIsSimpleStruct: taskInterface?.requestsIsSimpleStruct,
            requestsIsCollection: taskInterface?.requestsIsCollection,
          });
        }

        // WORKAROUND: If task expects single STRUCT but we have an array, bind just the first element
        if (
          fieldName === 'requests' &&
          Array.isArray(value) &&
          taskInterface?.requestsIsSimpleStruct
        ) {
          console.log(
            `[CompilerV3] Inline: ⚠️  WORKAROUND: Task expects single STRUCT for 'requests', binding first element only.`
          );
          value = value[0];
        }

        const bindingData = this.valueToBindingData(value);
        inputs.push({
          var: fieldName,
          binding: bindingData,
        });
      });

      // Log skipped fields (frontend metadata)
      const skippedFields = inputDataKeys.filter((key) => !fieldsToBinding.includes(key));
      if (skippedFields.length > 0) {
        console.log(`[CompilerV3] Inline: Skipped UI metadata fields: ${skippedFields.join(', ')}`);
      }
    } else {
      // No inputData - inherit from branch input
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
                var: 'o0',
              },
            },
          });
        }
      }
    }

    // Build inline node
    const compiledNode: flyteidl.core.INode = {
      id: targetNode.id,
      metadata,
      inputs,
      upstreamNodeIds: [],
    };

    // Add type-specific data
    if (targetNode.type === 'task') {
      compiledNode.taskNode = WorkflowCompilerServiceV3.compileTaskNode(targetNode);
    } else if (targetNode.type === 'branch') {
      compiledNode.branchNode = await this.compileBranchNode(targetNode, allNodes, edges);
    }

    return compiledNode;
  }

  /**
   * Compile boolean expression for branch conditions
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
          operator: WorkflowCompilerServiceV3.mapComparisonOperator(condition.operator),
          leftValue: WorkflowCompilerServiceV3.compileOperand(condition.leftValue, upstreamNodeId),
          rightValue: WorkflowCompilerServiceV3.compileOperand(
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

      // Extract field name if it contains node reference
      if (fieldName.includes('.')) {
        const parts = fieldName.split('.');
        fieldName = parts[parts.length - 1];
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
      return { primitive: WorkflowCompilerServiceV3.compileScalar(value).primitive };
    }

    // Direct value
    if (operand.value !== undefined) {
      return { primitive: WorkflowCompilerServiceV3.compileScalar(operand.value).primitive };
    }

    // Primitive value
    if (
      typeof operand === 'string' ||
      typeof operand === 'number' ||
      typeof operand === 'boolean'
    ) {
      return { primitive: WorkflowCompilerServiceV3.compileScalar(operand).primitive };
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
   * Compile node inputs
   *
   * CRITICAL: Maps node.data.inputData to Flyte Literal format
   * This is where task input data gets converted for Flyte execution
   * Now uses task interface to intelligently filter fields
   */
  private async compileNodeInputs(
    node: WorkflowBuilderNode,
    allNodes: WorkflowBuilderNode[],
    edges: WorkflowBuilderEdge[]
  ): Promise<flyteidl.core.IBinding[]> {
    const bindings: flyteidl.core.IBinding[] = [];

    // Get incoming edges
    const incomingEdges = edges.filter((e) => e.target === node.id);

    if (incomingEdges.length > 0) {
      // Build edge bindings (data flow from previous nodes)
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
                var: 'o0',
              },
            },
          });
        }
      });
    } else if (node.data.inputData) {
      // No incoming edges - bind inputData fields directly using task interface
      console.log(
        `[CompilerV3] >>> STANDALONE NODE PATH: Binding node ${node.id} inputData fields`
      );

      // Get task input variables from task interface
      let taskInterface: TaskInterfaceInfo | null = null;
      if (node.data.taskId) {
        taskInterface = await this.fetchTaskInterface(node.data.taskId);
      }

      // Determine which fields to bind
      const inputDataKeys = Object.keys(node.data.inputData);
      const fieldsToBinding = taskInterface
        ? inputDataKeys.filter((key) => taskInterface!.inputVariables.has(key))
        : inputDataKeys.filter((key) => ['requests', 'pipeline_config'].includes(key));

      console.log(`[CompilerV3] Input data keys: ${inputDataKeys.join(', ')}`);
      console.log(
        `[CompilerV3] Task interface vars: ${
          taskInterface
            ? Array.from(taskInterface.inputVariables).join(', ')
            : 'not available (using fallback)'
        }`
      );
      console.log(`[CompilerV3] Fields to bind: ${fieldsToBinding.join(', ')}`);

      // Bind matching fields
      fieldsToBinding.forEach((fieldName) => {
        let value = node.data.inputData![fieldName];
        console.log(
          `[CompilerV3] Binding field: ${fieldName}, type: ${
            Array.isArray(value) ? 'array' : typeof value
          }, length: ${Array.isArray(value) ? value.length : 'N/A'}`
        );

        // Debug: Log workaround check
        if (fieldName === 'requests') {
          console.log(`[CompilerV3] DEBUG requests field:`, {
            isArray: Array.isArray(value),
            hasTaskInterface: !!taskInterface,
            requestsIsSimpleStruct: taskInterface?.requestsIsSimpleStruct,
            requestsIsCollection: taskInterface?.requestsIsCollection,
          });
        }

        // WORKAROUND: If task expects single STRUCT but we have an array, bind just the first element
        if (
          fieldName === 'requests' &&
          Array.isArray(value) &&
          taskInterface?.requestsIsSimpleStruct
        ) {
          console.log(
            `[CompilerV3] ⚠️  WORKAROUND: Task expects single STRUCT for 'requests', but we have an array. Binding first element only.`
          );
          value = value[0];
        }

        // Log the actual value structure for debugging
        if (Array.isArray(value) && value.length > 0) {
          console.log(
            `[CompilerV3] First array element structure:`,
            JSON.stringify(value[0], null, 2)
          );
        }

        const bindingData = this.valueToBindingData(value);
        console.log(
          `[CompilerV3] BindingData structure for ${fieldName}:`,
          JSON.stringify(bindingData, null, 2).substring(0, 500)
        );

        bindings.push({
          var: fieldName,
          binding: bindingData,
        });
        console.log(`[CompilerV3] Successfully bound field: ${fieldName}`);
      });

      // Log skipped fields (frontend metadata)
      const skippedFields = inputDataKeys.filter((key) => !fieldsToBinding.includes(key));
      if (skippedFields.length > 0) {
        console.log(`[CompilerV3] Skipped UI metadata fields: ${skippedFields.join(', ')}`);
      }

      console.log(
        `[CompilerV3] Created ${bindings.length} bindings:`,
        bindings.map((b) => b.var)
      );

      // Log the full bindings structure to a file for debugging
      console.log(`[CompilerV3] FULL BINDINGS STRUCTURE:`);
      bindings.forEach((b, idx) => {
        console.log(`[CompilerV3]   Binding ${idx}: var="${b.var}"`);
        console.log(
          `[CompilerV3]   Binding ${idx} data:`,
          JSON.stringify(b.binding, null, 2).substring(0, 500)
        );
      });
    }

    return bindings;
  }

  /**
   * Convert inputData (JSON object) to Flyte LiteralMap
   *
   * This is the key function that maps task inputData to Flyte's Literal format
   */
  private inputDataToLiteralMap(inputData: any): flyteidl.core.ILiteralMap {
    const literals: { [key: string]: flyteidl.core.ILiteral } = {};

    Object.entries(inputData).forEach(([key, value]) => {
      literals[key] = this.valueToLiteral(value);
    });

    return { literals };
  }

  /**
   * Convert a JavaScript value to Flyte Literal
   */
  private valueToLiteral(value: any): flyteidl.core.ILiteral {
    // Null/undefined
    if (value === null || value === undefined) {
      return { scalar: { primitive: { stringValue: '' } } };
    }

    // String
    if (typeof value === 'string') {
      return { scalar: { primitive: { stringValue: value } } };
    }

    // Number
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { scalar: { primitive: { integer: value as any } } };
      }
      return { scalar: { primitive: { floatValue: value } } };
    }

    // Boolean
    if (typeof value === 'boolean') {
      return { scalar: { primitive: { boolean: value } } };
    }

    // Array
    if (Array.isArray(value)) {
      return {
        collection: {
          literals: value.map((v) => this.valueToLiteral(v)),
        },
      };
    }

    // Object
    if (typeof value === 'object') {
      const nestedLiterals: { [key: string]: flyteidl.core.ILiteral } = {};
      Object.entries(value).forEach(([k, v]) => {
        nestedLiterals[k] = this.valueToLiteral(v);
      });
      return { map: { literals: nestedLiterals } };
    }

    // Fallback to string
    return { scalar: { primitive: { stringValue: String(value) } } };
  }

  /**
   * Convert a JavaScript value to Flyte BindingData
   * Used for direct literal bindings in task inputs
   *
   * Handles collections of structs properly for Pydantic compatibility
   */
  private valueToBindingData(value: any): flyteidl.core.IBindingData {
    // Null/undefined
    if (value === null || value === undefined) {
      return { scalar: { primitive: { stringValue: '' } } };
    }

    // String
    if (typeof value === 'string') {
      return { scalar: { primitive: { stringValue: value } } };
    }

    // Number
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { scalar: { primitive: { integer: value as any } } };
      }
      return { scalar: { primitive: { floatValue: value } } };
    }

    // Boolean
    if (typeof value === 'boolean') {
      return { scalar: { primitive: { boolean: value } } };
    }

    // Array - collection of items (each item can be a struct)
    if (Array.isArray(value)) {
      return {
        collection: {
          bindings: value.map((item) => {
            // Each item in the array should be converted to BindingData
            // If it's an object, it becomes a struct (map of bindings)
            if (typeof item === 'object' && item !== null) {
              const fields: { [key: string]: flyteidl.core.IBindingData } = {};
              Object.entries(item).forEach(([k, v]) => {
                fields[k] = this.valueToBindingData(v);
              });
              return { map: { bindings: fields } };
            }
            // Otherwise convert as normal
            return this.valueToBindingData(item);
          }),
        },
      };
    }

    // Object - convert to map of bindings (struct)
    if (typeof value === 'object') {
      const fields: { [key: string]: flyteidl.core.IBindingData } = {};
      Object.entries(value).forEach(([k, v]) => {
        fields[k] = this.valueToBindingData(v);
      });
      return { map: { bindings: fields } };
    }

    // Fallback to string
    return { scalar: { primitive: { stringValue: String(value) } } };
  }

  /**
   * Convert JavaScript value to Protobuf Struct format
   */
  private toProtobufStruct(value: any): any {
    if (value === null || value === undefined) {
      return { nullValue: 0 };
    }
    if (typeof value === 'string') {
      return { stringValue: value };
    }
    if (typeof value === 'number') {
      return { numberValue: value };
    }
    if (typeof value === 'boolean') {
      return { boolValue: value };
    }
    if (Array.isArray(value)) {
      return {
        listValue: {
          values: value.map((v) => this.toProtobufStruct(v)),
        },
      };
    }
    if (typeof value === 'object') {
      const fields: any = {};
      Object.entries(value).forEach(([k, v]) => {
        fields[k] = this.toProtobufStruct(v);
      });
      return { structValue: { fields } };
    }
    return { stringValue: String(value) };
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

    const lastNode = lastNodes[0];

    // Use simple o0 binding
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

// Note: No longer exporting singleton - create instances with baseUrl as needed
// Server-side: new WorkflowCompilerServiceV3('')
// Client-side: new WorkflowCompilerServiceV3(window.location.origin)
