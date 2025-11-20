/**
 * Workflow Binding Validator
 *
 * Inspired by Flyte's binding validation system (flytekit/core/workflow.py, flytekit/tools/translator.py)
 * Validates that all node inputs are properly bound and all referenced outputs exist.
 */

/* eslint-disable no-restricted-syntax, no-continue, no-await-in-loop */
// These rules are disabled because this file requires sequential async operations
// in validation logic that cannot be easily converted to array methods while
// maintaining the same control flow (continue statements for skipping iterations).

import { prisma } from '@app/database';

export interface ValidationError {
  code:
    | 'ParameterNotBound'
    | 'VariableNameNotFound'
    | 'ValueRequired'
    | 'CircularDependency'
    | 'InvalidBinding';
  nodeId: string;
  description: string;
  field?: string;
}

export interface TaskInterface {
  inputs: Record<
    string,
    {
      type: string;
      description?: string;
      default?: any;
      required?: boolean;
    }
  >;
  outputs: Record<
    string,
    {
      type: string;
      description?: string;
    }
  >;
}

export interface NodeBinding {
  var: string;
  binding: {
    promise?: {
      nodeId: string;
      var: string;
    };
    scalar?: any;
    collection?: any;
    map?: any;
  };
}

/**
 * Build a map of available bindings (outputs) for each node in the workflow
 * Similar to Flyte's construct_input_promises and compilation state tracking
 */
export async function buildBindingContext(
  nodes: any[],
  workflowInputs: Record<string, any>
): Promise<Map<string, Set<string>>> {
  const availableBindings = new Map<string, Set<string>>();

  // Add workflow inputs as available from start-node (GLOBAL_INPUT_NODE equivalent)
  const workflowInputNames = Object.keys(workflowInputs || {});
  availableBindings.set('start-node', new Set(workflowInputNames));

  console.log('[BindingContext] Workflow inputs:', workflowInputNames);

  // Topologically sort nodes to process them in execution order
  const sortedNodes = topologicalSort(nodes);

  // For each node, fetch its task interface and register its outputs
  for (const node of sortedNodes) {
    try {
      // Handle both builder format (node.data.taskId) and compiled format (node.taskId)
      const taskId = (node as any).data?.taskId || node.taskId;

      // Skip non-task nodes (start, end, branch, gate, etc.)
      if (!taskId || (node as any).type !== 'task') {
        availableBindings.set(node.id, new Set());
        console.log(`[BindingContext] Node ${node.id} is not a task node - no outputs`);
        continue;
      }

      // Convert taskId object to string format for database lookup
      const taskIdString =
        typeof taskId === 'string'
          ? taskId
          : `${taskId.project}:${taskId.domain}:${taskId.name}:${taskId.version}`;

      const taskInterface = await getTaskInterface(taskIdString);

      if (taskInterface?.outputs) {
        const outputNames = Object.keys(taskInterface.outputs);
        availableBindings.set(node.id, new Set(outputNames));
        console.log(`[BindingContext] Node ${node.id} provides outputs:`, outputNames);
      } else {
        // Node has no outputs
        availableBindings.set(node.id, new Set());
        console.log(`[BindingContext] Node ${node.id} has no outputs`);
      }
    } catch (error) {
      console.error(`[BindingContext] Error fetching task interface for node ${node.id}:`, error);
      // Set empty outputs if we can't fetch the interface
      availableBindings.set(node.id, new Set());
    }
  }

  return availableBindings;
}

/**
 * Fetch task interface from FormAssignments (input/output schemas)
 * This is the source of truth for what inputs/outputs a task expects
 */
async function getTaskInterface(taskIdString: string): Promise<TaskInterface | null> {
  try {
    // Parse the taskId string format: project:domain:name:version
    const parts = taskIdString.split(':');
    if (parts.length !== 4) {
      console.warn(`[TaskInterface] Invalid taskId format: ${taskIdString}`);
      return null;
    }

    const [project, domain, name, version] = parts;

    // Fetch input and output schemas from FormAssignments
    const [inputAssignment, outputAssignment] = await Promise.all([
      prisma.formAssignment.findFirst({
        where: {
          targetProject: project,
          targetDomain: domain,
          targetName: name,
          targetVersion: version,
          assignmentType: 'input',
          status: 'active',
        },
        include: { schema: true },
      }),
      prisma.formAssignment.findFirst({
        where: {
          targetProject: project,
          targetDomain: domain,
          targetName: name,
          targetVersion: version,
          assignmentType: 'output',
          status: 'active',
        },
        include: { schema: true },
      }),
    ]);

    if (!inputAssignment && !outputAssignment) {
      console.warn(`[TaskInterface] No form assignments found for task ${taskIdString}`);
      return null;
    }

    // Build interface from JSON schemas
    const taskInterface: TaskInterface = {
      inputs: {},
      outputs: {},
    };

    // Convert input schema to TaskInterface format
    if (inputAssignment?.schema?.schema) {
      const inputSchema = inputAssignment.schema.schema as any;
      const properties = inputSchema.properties || {};
      const required = inputSchema.required || [];

      for (const [fieldName, fieldDef] of Object.entries(properties) as [string, any][]) {
        taskInterface.inputs[fieldName] = {
          type: fieldDef.type || 'string',
          description: fieldDef.description,
          required: required.includes(fieldName),
          default: fieldDef.default,
        };
      }
    }

    // Convert output schema to TaskInterface format
    if (outputAssignment?.schema?.schema) {
      const outputSchema = outputAssignment.schema.schema as any;
      const properties = outputSchema.properties || {};

      for (const [fieldName, fieldDef] of Object.entries(properties) as [string, any][]) {
        taskInterface.outputs[fieldName] = {
          type: fieldDef.type || 'string',
          description: fieldDef.description,
        };
      }
    }

    console.log(`[TaskInterface] Successfully loaded interface for ${taskIdString}:`, {
      inputs: Object.keys(taskInterface.inputs),
      outputs: Object.keys(taskInterface.outputs),
    });

    return taskInterface;
  } catch (error) {
    console.error(`[TaskInterface] Error fetching task ${taskIdString}:`, error);
    return null;
  }
}

/**
 * Validate that all inputs for a node are properly bound
 * Similar to Flyte's node binding validation in translator.py
 */
export function validateNodeBindings(
  node: any,
  taskInterface: TaskInterface,
  availableBindings: Map<string, Set<string>>,
  workflowInputs: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeInputs = taskInterface.inputs || {};

  console.log(
    `[ValidateNode] Validating node ${node.id}, task has ${Object.keys(nodeInputs).length} inputs`
  );

  // Build a map of current bindings for this node
  const boundInputs = new Map<string, NodeBinding>();
  for (const binding of node.inputs || []) {
    boundInputs.set(binding.var, binding);
  }

  // Also check for values in node.data.inputData (workflow builder format)
  const inputData = (node as any).data?.inputData || {};
  const hasInputData = Object.keys(inputData).length > 0;

  console.log(
    `[ValidateNode] Node ${node.id} has ${hasInputData ? 'inputData' : 'no inputData'}:`,
    inputData
  );

  // 1. Check that all required task inputs are bound
  for (const [inputName, inputSpec] of Object.entries(nodeInputs)) {
    const binding = boundInputs.get(inputName);
    const hasStaticValue =
      inputData[inputName] !== undefined &&
      inputData[inputName] !== null &&
      inputData[inputName] !== '';

    // Check if input is required (no default value)
    const isRequired = inputSpec.required !== false && inputSpec.default === undefined;

    // Input is satisfied if either:
    // 1. It has a binding (edge connection or workflow input)
    // 2. It has a static value in inputData
    // 3. It's not required
    if (!binding && !hasStaticValue && isRequired) {
      errors.push({
        code: 'ParameterNotBound',
        nodeId: node.id,
        description: `Parameter not bound [${inputName}]`,
        field: inputName,
      });
      console.log(`[ValidateNode] Error: Parameter ${inputName} not bound on node ${node.id}`);
      continue;
    }

    if (!binding && !hasStaticValue) {
      // Optional parameter, not bound - this is OK
      continue;
    }

    // If there's a static value in inputData, we're done validating this parameter
    if (hasStaticValue) {
      console.log(`[ValidateNode] Parameter ${inputName} has static value in inputData`);
      continue;
    }

    // TypeScript: At this point, binding is guaranteed to be defined (checked above)
    if (!binding) {
      continue;
    }

    // 2. Validate the binding source exists
    if (binding.binding?.promise) {
      const { nodeId: sourceNodeId, var: sourceVar } = binding.binding.promise;

      if (sourceNodeId === 'start-node') {
        // Binding to workflow input
        if (!workflowInputs.has(sourceVar)) {
          errors.push({
            code: 'VariableNameNotFound',
            nodeId: node.id,
            description: `Workflow input [${sourceVar}] not found`,
            field: inputName,
          });
          console.log(`[ValidateNode] Error: Workflow input ${sourceVar} not found`);
        }
      } else {
        // Binding to another node's output
        const sourceOutputs = availableBindings.get(sourceNodeId);

        if (!sourceOutputs) {
          errors.push({
            code: 'VariableNameNotFound',
            nodeId: node.id,
            description: `Node [${sourceNodeId}] not found`,
            field: inputName,
          });
          console.log(`[ValidateNode] Error: Source node ${sourceNodeId} not found`);
        } else if (!sourceOutputs.has(sourceVar)) {
          errors.push({
            code: 'VariableNameNotFound',
            nodeId: node.id,
            description: `Variable [${sourceVar}] not found on node [${sourceNodeId}]`,
            field: inputName,
          });
          console.log(
            `[ValidateNode] Error: Variable ${sourceVar} not found on node ${sourceNodeId}`
          );
          console.log(`[ValidateNode] Available outputs:`, Array.from(sourceOutputs));
        }
      }
    } else if (!binding.binding?.scalar && !binding.binding?.collection && !binding.binding?.map) {
      // Binding exists but has no valid source
      errors.push({
        code: 'InvalidBinding',
        nodeId: node.id,
        description: `Invalid binding for parameter [${inputName}]`,
        field: inputName,
      });
    }
  }

  return errors;
}

/**
 * Validate workflow output bindings
 * Similar to Flyte's workflow output binding validation
 */
export function validateOutputBindings(
  outputBindings: any[],
  availableBindings: Map<string, Set<string>>
): ValidationError[] {
  const errors: ValidationError[] = [];

  console.log(`[ValidateOutputs] Validating ${outputBindings.length} output bindings`);

  for (const binding of outputBindings) {
    const { var: outputName, binding: bindingSpec } = binding;

    if (!bindingSpec) {
      errors.push({
        code: 'ParameterNotBound',
        nodeId: 'end-node',
        description: `Output [${outputName}] has no binding`,
        field: outputName,
      });
      continue;
    }

    if (bindingSpec.promise) {
      const { nodeId: sourceNodeId, var: sourceVar } = bindingSpec.promise;
      const sourceOutputs = availableBindings.get(sourceNodeId);

      if (!sourceOutputs) {
        errors.push({
          code: 'VariableNameNotFound',
          nodeId: 'end-node',
          description: `Output binding [${outputName}] references non-existent node [${sourceNodeId}]`,
          field: outputName,
        });
        console.log(
          `[ValidateOutputs] Error: Node ${sourceNodeId} not found for output ${outputName}`
        );
      } else if (!sourceOutputs.has(sourceVar)) {
        errors.push({
          code: 'ParameterNotBound',
          nodeId: 'end-node',
          description: `Parameter not bound [${outputName}]`,
          field: outputName,
        });
        console.log(
          `[ValidateOutputs] Error: Variable ${sourceVar} not found on node ${sourceNodeId}`
        );
        console.log(`[ValidateOutputs] Available outputs:`, Array.from(sourceOutputs));
      }
    }
  }

  return errors;
}

/**
 * Topological sort of nodes based on dependencies
 * Returns nodes in execution order
 */
function topologicalSort(nodes: any[]): any[] {
  const sorted: any[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  // Build adjacency list
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const dependencies = new Map<string, Set<string>>();

  for (const node of nodes) {
    const deps = new Set<string>();

    // Extract dependencies from bindings
    for (const binding of node.inputs || []) {
      if (binding.binding?.promise?.nodeId && binding.binding.promise.nodeId !== 'start-node') {
        deps.add(binding.binding.promise.nodeId);
      }
    }

    dependencies.set(node.id, deps);
  }

  function visit(nodeId: string): boolean {
    if (visiting.has(nodeId)) {
      // Cycle detected
      return false;
    }

    if (visited.has(nodeId)) {
      return true;
    }

    visiting.add(nodeId);

    const deps = dependencies.get(nodeId) || new Set();
    for (const depId of Array.from(deps)) {
      if (!visit(depId)) {
        return false;
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      sorted.push(node);
    }

    return true;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (!visit(node.id)) {
        console.error('[TopologicalSort] Cycle detected in workflow');
        // Return original order if cycle detected
        return nodes;
      }
    }
  }

  return sorted;
}

/**
 * Detect circular dependencies in the workflow
 */
export function detectCycles(nodes: any[]): ValidationError | null {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  function hasCycle(nodeId: string, path: string[]): string[] | null {
    if (visiting.has(nodeId)) {
      // Cycle found
      return [...path, nodeId];
    }

    if (visited.has(nodeId)) {
      return null;
    }

    visiting.add(nodeId);
    path.push(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      for (const binding of node.inputs || []) {
        if (binding.binding?.promise?.nodeId && binding.binding.promise.nodeId !== 'start-node') {
          const cycle = hasCycle(binding.binding.promise.nodeId, [...path]);
          if (cycle) {
            return cycle;
          }
        }
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);

    return null;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const cycle = hasCycle(node.id, []);
      if (cycle) {
        return {
          code: 'CircularDependency',
          nodeId: node.id,
          description: `Circular dependency detected: ${cycle.join(' -> ')}`,
        };
      }
    }
  }

  return null;
}

/**
 * Main validation function - validates entire workflow
 * Similar to Flyte's get_serializable_workflow validation
 */
export async function validateWorkflowBindings(workflow: {
  nodes: any[];
  interface?: { inputs?: Record<string, any>; outputs?: Record<string, any> };
  outputs?: any[];
}): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  console.log('[ValidateWorkflow] Starting workflow validation');
  console.log('[ValidateWorkflow] Nodes:', workflow.nodes.length);
  console.log(
    '[ValidateWorkflow] Workflow inputs:',
    Object.keys(workflow.interface?.inputs || {}).length
  );
  console.log('[ValidateWorkflow] Workflow outputs:', workflow.outputs?.length || 0);

  // Handle empty workflow
  if (workflow.nodes.length === 0) {
    errors.push({
      code: 'ValueRequired',
      nodeId: 'workflow',
      description: 'Workflow must contain at least one node',
    });
    return errors;
  }

  // Single-node workflows are valid - no need to check connectivity
  // Just validate the node's inputs are properly bound
  console.log('[ValidateWorkflow] Single-node workflow detected - skipping connectivity checks');

  // 1. Check for circular dependencies first (only relevant for multi-node workflows)
  if (workflow.nodes.length > 1) {
    const cycleError = detectCycles(workflow.nodes);
    if (cycleError) {
      errors.push(cycleError);
      // Don't continue if there's a cycle
      return errors;
    }
  }

  // 2. Build binding context (available outputs from each node)
  const availableBindings = await buildBindingContext(
    workflow.nodes,
    workflow.interface?.inputs || {}
  );

  const workflowInputs = new Set(Object.keys(workflow.interface?.inputs || {}));

  // 3. Validate each node's bindings
  for (const node of workflow.nodes) {
    // Handle both builder format (node.data.taskId) and compiled format (node.taskId)
    const taskId = (node as any).data?.taskId || node.taskId;

    // Skip non-task nodes (start, end, branch, gate, etc.)
    if (!taskId || (node as any).type !== 'task') {
      continue;
    }

    // Convert taskId object to string format for database lookup
    const taskIdString =
      typeof taskId === 'string'
        ? taskId
        : `${taskId.project}:${taskId.domain}:${taskId.name}:${taskId.version}`;

    const taskInterface = await getTaskInterface(taskIdString);

    if (!taskInterface) {
      errors.push({
        code: 'ValueRequired',
        nodeId: node.id,
        description: `Task interface not found for task [${taskIdString}]`,
      });
      continue;
    }

    const nodeErrors = validateNodeBindings(node, taskInterface, availableBindings, workflowInputs);

    errors.push(...nodeErrors);
  }

  // For single-node workflows with no outputs defined, this is still valid
  // The node can produce outputs that aren't captured at workflow level
  if (workflow.nodes.length === 1 && (!workflow.outputs || workflow.outputs.length === 0)) {
    console.log('[ValidateWorkflow] Single-node workflow with no outputs - this is valid');
  }

  // 4. Validate output bindings
  if (workflow.outputs && workflow.outputs.length > 0) {
    const outputErrors = validateOutputBindings(workflow.outputs, availableBindings);

    errors.push(...outputErrors);
  }

  console.log(`[ValidateWorkflow] Validation complete. Found ${errors.length} error(s)`);

  return errors;
}

/**
 * Format validation errors into a user-friendly message
 * Similar to Flyte's error reporting
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return 'Workflow validation passed';
  }

  const header = `Workflow validation failed with ${errors.length} error(s).\n\n`;
  const commonIssues = `Common issues:
• Parameter not bound: Workflow input parameters are not connected to any nodes
• Value required: Node configuration fields are missing required values
• Variable not found: Nodes reference outputs that don't exist

Please review your workflow in the builder to:
1. Connect workflow parameters to node inputs
2. Fill in all required node configuration fields
3. Ensure node output references are correct

Full error details:\n`;

  const errorDetails = errors
    .map(
      (err, idx) =>
        `Error ${idx}: Code: ${err.code}, Node Id: ${err.nodeId}, Description: ${err.description}`
    )
    .join('\n');

  return header + commonIssues + errorDetails;
}
