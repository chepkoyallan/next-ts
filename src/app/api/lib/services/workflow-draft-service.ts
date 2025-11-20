import { prisma } from '@app/database';

import type { JsonSchema } from '../utils/schema-extraction';
import { SchemaTypeChecker, schemaTypeChecker } from '../utils/schema-type-checker';

/**
 * Workflow node types
 */
export type WorkflowNodeType =
  | 'task'
  | 'branch'
  | 'start'
  | 'end'
  | 'subworkflow'
  | 'gate'
  | 'array_map';

/**
 * Workflow node definition
 */
export interface WorkflowBuilderNode {
  id: string;
  type: WorkflowNodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;

    // For task nodes
    taskId?: {
      project: string;
      domain: string;
      name: string;
      version: string;
    };
    inputSchema?: JsonSchema;
    outputSchema?: JsonSchema;

    // For branch nodes - legacy format (backward compatibility)
    conditions?: Array<{
      id: string;
      field: string;
      operator: string;
      value: any;
      targetNodeId: string;
    }>;
    // Enhanced branch configuration
    branchConfig?: {
      primaryCase: {
        id: string;
        label?: string;
        condition: any; // BooleanExpression
        thenNodeId: string;
      };
      elseCases: Array<{
        id: string;
        label?: string;
        condition: any; // BooleanExpression
        thenNodeId: string;
      }>;
      elseNodeId?: string;
      errorNodeId?: string;
    };
    inputTaskNodeId?: string;

    // For gate nodes
    gateConfig?: {
      type: 'approve' | 'signal' | 'sleep';
      signalId?: string;
      description?: string;
      approvers?: string[];
      signalType?: string;
      outputVariableName?: string;
      timeoutSeconds?: number;
      duration?: { seconds: number };
    };

    // For array map configuration on task nodes
    arrayMapConfig?: {
      enabled: boolean;
      arrayInputField: string;
      parallelism: number;
      successCriteria: 'all' | 'count' | 'ratio';
      minSuccesses?: number;
      minSuccessRatio?: number;
    };

    // For subworkflow nodes
    workflowId?: {
      project: string;
      domain: string;
      name: string;
      version: string;
    };

    // Configuration
    config?: Record<string, any>;
    inputData?: Record<string, any>; // Form data from task configuration dialog
    metadata?: Record<string, any>;
  };
}

/**
 * Workflow edge definition
 */
export interface WorkflowBuilderEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: 'default' | 'conditional' | 'data' | 'execution-path';
  data?: {
    condition?: any;
    transform?: any;
    edgeType?: 'data-flow' | 'execution-path';
    fieldMappings?: Array<{
      sourceField: string;
      targetField: string;
      transform?: string;
    }>;
    conditionLabel?: string;
    isDefaultPath?: boolean;
    conditionIndex?: number;
    valid?: boolean;
    errors?: string[];
    warnings?: string[];
  };
}

/**
 * Flyte variable definition for workflow interface
 */
export interface FlyteVariable {
  type: FlyteType;
  description?: string;
  optional?: boolean;
  default?: any;
}

/**
 * Flyte type definition
 */
export interface FlyteType {
  kind: 'simple' | 'collection' | 'map' | 'struct' | 'union' | 'blob' | 'enum';
  simple?: number; // SimpleType enum value
  collectionType?: FlyteType;
  mapValueType?: FlyteType;
  structFields?: Record<string, FlyteType>;
  unionTypes?: FlyteType[];
  blobType?: { format?: string; dimensionality?: number };
  enumValues?: string[];
}

/**
 * Workflow draft
 */
export interface WorkflowDraft {
  id?: string;
  name: string;
  description?: string;
  project: string;
  domain: string;
  version: string;
  nodes: WorkflowBuilderNode[];
  edges: WorkflowBuilderEdge[];

  // Workflow interface (NEW)
  workflowInputs?: Record<string, FlyteVariable>;
  workflowOutputs?: Record<string, FlyteVariable>;

  metadata?: Record<string, any>;
  status?: string;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Workflow validation result
 */
export interface WorkflowValidationResult {
  valid: boolean;
  errors: Array<{
    nodeId?: string;
    edgeId?: string;
    type: string;
    message: string;
  }>;
  warnings: Array<{
    nodeId?: string;
    edgeId?: string;
    type: string;
    message: string;
  }>;
}

/**
 * Workflow Draft Service
 */
export class WorkflowDraftService {
  /**
   * Create a new workflow draft
   */
  static async create(draft: WorkflowDraft, userId: string, organizationId: string): Promise<any> {
    // Skip validation on creation - drafts are works-in-progress
    // Validation happens explicitly when user validates or deploys

    if (!organizationId) {
      throw new Error('organizationId is required for multi-tenancy');
    }

    // Create draft
    const created = await prisma.workflowDraft.create({
      data: {
        name: draft.name,
        description: draft.description,
        project: draft.project,
        domain: draft.domain,
        version: draft.version,
        nodes: draft.nodes as any,
        edges: draft.edges as any,
        workflowInputs: draft.workflowInputs as any,
        workflowOutputs: draft.workflowOutputs as any,
        metadata: draft.metadata as any,
        status: 'draft',
        createdBy: userId,
        organizationId, // Store organization ID for multi-tenancy
      },
    });

    return created;
  }

  /**
   * Update an existing workflow draft
   */
  static async update(
    id: string,
    draft: Partial<WorkflowDraft>,
    userId: string,
    organizationId: string
  ): Promise<any> {
    // Get existing draft
    const existing = await prisma.workflowDraft.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Workflow draft ${id} not found`);
    }

    // Check organization ownership
    if (existing.organizationId !== organizationId) {
      throw new Error('Draft does not belong to your organization');
    }

    // Check permissions (user must be owner)
    if (existing.createdBy !== userId) {
      throw new Error('Only the draft owner can update it');
    }

    // Skip validation on update - drafts are works-in-progress
    // Validation happens explicitly when user validates or deploys

    // Update draft
    const updated = await prisma.workflowDraft.update({
      where: { id },
      data: {
        name: draft.name,
        description: draft.description,
        project: draft.project,
        domain: draft.domain,
        version: draft.version,
        nodes: draft.nodes as any,
        edges: draft.edges as any,
        workflowInputs: draft.workflowInputs as any,
        workflowOutputs: draft.workflowOutputs as any,
        metadata: draft.metadata as any,
      },
    });

    return updated;
  }

  /**
   * Get a workflow draft by ID
   */
  static async getById(id: string, organizationId?: string): Promise<any> {
    const draft = await prisma.workflowDraft.findUnique({
      where: { id },
    });

    if (!draft) {
      throw new Error(`Workflow draft ${id} not found`);
    }

    // Check organization ownership if provided
    if (organizationId && draft.organizationId !== organizationId) {
      throw new Error('Draft does not belong to your organization');
    }

    return draft;
  }

  /**
   * List workflow drafts with filtering
   */
  static async list(filters: {
    project?: string;
    domain?: string;
    status?: string;
    createdBy?: string;
    organizationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ drafts: any[]; total: number }> {
    const where: any = {};

    if (filters.project) where.project = filters.project;
    if (filters.domain) where.domain = filters.domain;
    if (filters.status) where.status = filters.status;
    if (filters.createdBy) where.createdBy = filters.createdBy;
    if (filters.organizationId) where.organizationId = filters.organizationId;

    const [drafts, total] = await Promise.all([
      prisma.workflowDraft.findMany({
        where,
        take: filters.limit || 50,
        skip: filters.offset || 0,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workflowDraft.count({ where }),
    ]);

    return { drafts, total };
  }

  /**
   * Delete a workflow draft
   */
  static async delete(id: string, userId: string, organizationId: string): Promise<void> {
    const existing = await prisma.workflowDraft.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Workflow draft ${id} not found`);
    }

    // Check organization ownership
    if (existing.organizationId !== organizationId) {
      throw new Error('Draft does not belong to your organization');
    }

    // Check permissions
    if (existing.createdBy !== userId) {
      throw new Error('Only the draft owner can delete it');
    }

    await prisma.workflowDraft.delete({
      where: { id },
    });
  }

  /**
   * Validate a workflow draft
   */
  static async validate(draft: WorkflowDraft): Promise<WorkflowValidationResult> {
    const errors: WorkflowValidationResult['errors'] = [];
    const warnings: WorkflowValidationResult['warnings'] = [];

    // Check if workflow has nodes
    if (!draft.nodes || draft.nodes.length === 0) {
      errors.push({
        type: 'workflow',
        message: 'Workflow must have at least one node',
      });
      return { valid: false, errors, warnings };
    }

    // Note: Start/end nodes are optional - orchestrator can add them automatically

    // STRICT VALIDATION: Extract workflow parameters from metadata
    const workflowParameters = (draft.metadata?.parameters || []) as Array<{
      name: string;
      type: string;
      required: boolean;
      default?: any;
    }>;

    // Track which parameters are bound to nodes
    const boundParameters = new Set<string>();

    // STRICT VALIDATION: Build a map of node outputs for variable reference checking
    const nodeOutputs = new Map<string, Set<string>>();

    // Validate each node using Promise.all to avoid await in loop
    await Promise.all(
      draft.nodes.map(async (node) => {
        // Check for task schemas
        if (node.type === 'task' && node.data.taskId) {
          const { project, domain, name, version } = node.data.taskId;

          // Fetch task schemas in parallel
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

          if (!inputAssignment) {
            warnings.push({
              nodeId: node.id,
              type: 'schema',
              message: `Task ${name} does not have an input schema registered`,
            });
          } else {
            // Store schemas in node data for connection validation
            node.data.inputSchema = inputAssignment.schema.schema as unknown as JsonSchema;
          }

          if (!outputAssignment) {
            warnings.push({
              nodeId: node.id,
              type: 'schema',
              message: `Task ${name} does not have an output schema registered`,
            });
          } else {
            node.data.outputSchema = outputAssignment.schema.schema as unknown as JsonSchema;

            // STRICT VALIDATION: Track node outputs for variable reference validation
            if (node.data.outputSchema && node.data.outputSchema.properties) {
              const outputFields = new Set(Object.keys(node.data.outputSchema.properties));
              nodeOutputs.set(node.id, outputFields);
            }
          }

          // STRICT VALIDATION: Check for required input fields
          if (node.data.inputSchema && node.data.inputSchema.required) {
            const requiredFields = node.data.inputSchema.required;
            // Check both config and inputData (config is legacy, inputData is from form)
            const config = node.data.config || {};
            const inputData = (node.data as any).inputData || {};

            requiredFields.forEach((field) => {
              // Check if field is provided in config, inputData, or connected via edge
              const hasValueInConfig =
                config[field] !== undefined && config[field] !== null && config[field] !== '';
              const hasValueInInputData =
                inputData[field] !== undefined &&
                inputData[field] !== null &&
                inputData[field] !== '';
              const hasIncomingConnection = draft.edges.some(
                (e) =>
                  e.target === node.id &&
                  e.data?.fieldMappings?.some((m) => m.targetField === field)
              );

              if (!hasValueInConfig && !hasValueInInputData && !hasIncomingConnection) {
                errors.push({
                  nodeId: node.id,
                  type: 'missing-value',
                  message: `Required field '${field}' is missing a value in node '${
                    node.data.label || node.id
                  }'`,
                });
              }

              // STRICT VALIDATION: Check if value references a workflow parameter
              const fieldValue = config[field] || inputData[field];
              if (
                typeof fieldValue === 'string' &&
                fieldValue.startsWith('${') &&
                fieldValue.endsWith('}')
              ) {
                const paramName = fieldValue.slice(2, -1).trim();
                boundParameters.add(paramName);
              }
            });
          }

          // STRICT VALIDATION: Check all node config values for variable references
          if (node.data.config) {
            Object.entries(node.data.config).forEach(([fieldName, fieldValue]) => {
              if (typeof fieldValue === 'string' && fieldValue.includes('${')) {
                // Extract variable references like ${node-123.output} or ${paramName}
                const varMatches = fieldValue.match(/\$\{([^}]+)\}/g);
                if (varMatches) {
                  varMatches.forEach((match) => {
                    const varRef = match.slice(2, -1).trim();

                    // Check if it's a node output reference (contains a dot)
                    if (varRef.includes('.')) {
                      const [refNodeId, refField] = varRef.split('.');

                      // Verify the referenced node exists
                      const refNode = draft.nodes.find((n) => n.id === refNodeId);
                      if (!refNode) {
                        errors.push({
                          nodeId: node.id,
                          type: 'variable-not-found',
                          message: `Variable reference '${varRef}' in field '${fieldName}' references non-existent node '${refNodeId}'`,
                        });
                      } else {
                        // Verify the field exists in the node's output schema
                        const outputFields = nodeOutputs.get(refNodeId);
                        if (outputFields && !outputFields.has(refField)) {
                          errors.push({
                            nodeId: node.id,
                            type: 'variable-not-found',
                            message: `Variable '${refField}' not found on node '${refNodeId}'. Available outputs: ${Array.from(
                              outputFields
                            ).join(', ')}`,
                          });
                        }
                      }
                    } else {
                      // It's a workflow parameter reference
                      boundParameters.add(varRef);
                    }
                  });
                }
              }
            });
          }
        }

        // STRICT VALIDATION: Validate end node has all required inputs (if end node exists)
        if (node.type === 'end') {
          // Note: End node incoming connection validation is optional
          // const incomingEdges = draft.edges.filter(e => e.target === node.id);
          // if (incomingEdges.length === 0) {
          //   errors.push({
          //     nodeId: node.id,
          //     type: 'missing-connection',
          //     message: 'End node must have at least one incoming connection',
          //   });
          // }

          // STRICT VALIDATION: Check if end node references workflow outputs
          if (node.data.config) {
            Object.entries(node.data.config).forEach(([outputName, outputValue]) => {
              if (typeof outputValue === 'string' && outputValue.includes('${')) {
                const varMatches = outputValue.match(/\$\{([^}]+)\}/g);
                if (varMatches) {
                  varMatches.forEach((match) => {
                    const varRef = match.slice(2, -1).trim();

                    if (varRef.includes('.')) {
                      const [refNodeId, refField] = varRef.split('.');
                      const outputFields = nodeOutputs.get(refNodeId);

                      if (outputFields && !outputFields.has(refField)) {
                        errors.push({
                          nodeId: node.id,
                          type: 'variable-not-found',
                          message: `End node output '${outputName}' references non-existent variable '${refField}' from node '${refNodeId}'`,
                        });
                      }
                    }
                  });
                }
              }
            });
          }
        }

        // Validate branch conditions (legacy format)
        if (node.type === 'branch' && node.data.conditions) {
          // Find incoming edges to get input schema
          const incomingEdges = draft.edges.filter((e) => e.target === node.id);

          if (incomingEdges.length > 0) {
            const sourceNode = draft.nodes.find((n) => n.id === incomingEdges[0].source);

            if (sourceNode?.data?.outputSchema) {
              node.data.conditions.forEach((condition) => {
                const conditionCheck = SchemaTypeChecker.checkBranchCondition(
                  condition,
                  sourceNode.data.outputSchema!
                );

                if (!conditionCheck.valid) {
                  errors.push({
                    nodeId: node.id,
                    type: 'condition',
                    message: `Branch condition invalid: ${conditionCheck.errors.join(', ')}`,
                  });
                }
              });
            }
          }
        }

        // Validate enhanced branch configuration
        if (node.type === 'branch') {
          const branchValidation = WorkflowDraftService.validateBranchNode(node, draft);
          errors.push(...branchValidation.errors);
          warnings.push(...branchValidation.warnings);
        }

        // Validate gate configuration
        if (node.type === 'gate') {
          const gateValidation = WorkflowDraftService.validateGateNode(node, draft);
          errors.push(...gateValidation.errors);
          warnings.push(...gateValidation.warnings);
        }

        // Validate array map configuration
        if (node.type === 'task' && node.data.arrayMapConfig?.enabled) {
          const arrayMapValidation = WorkflowDraftService.validateArrayMapConfig(node);
          errors.push(...arrayMapValidation.errors);
          warnings.push(...arrayMapValidation.warnings);
        }
      })
    );

    // STRICT VALIDATION: Check for unbound workflow parameters
    const unboundParameters = workflowParameters.filter(
      (param) => param.required && !param.default && !boundParameters.has(param.name)
    );

    if (unboundParameters.length > 0) {
      unboundParameters.forEach((param) => {
        errors.push({
          type: 'parameter-not-bound',
          message: `Required workflow parameter '${param.name}' is not bound to any node. Please connect this parameter to a node input.`,
        });
      });
    }

    // Validate edges (connections)
    draft.edges.forEach((edge) => {
      const sourceNode = draft.nodes.find((n) => n.id === edge.source);
      const targetNode = draft.nodes.find((n) => n.id === edge.target);

      if (!sourceNode) {
        errors.push({
          edgeId: edge.id,
          type: 'connection',
          message: `Source node ${edge.source} not found`,
        });
        return;
      }

      if (!targetNode) {
        errors.push({
          edgeId: edge.id,
          type: 'connection',
          message: `Target node ${edge.target} not found`,
        });
        return;
      }

      // Check schema compatibility
      if (sourceNode.data.outputSchema && targetNode.data.inputSchema) {
        // Pass field mappings to the checker so it knows which target fields are satisfied
        const fieldMappings = edge.data?.fieldMappings || [];

        const compatibility = schemaTypeChecker.checkConnection(
          sourceNode.data.outputSchema,
          targetNode.data.inputSchema,
          undefined, // sourceOutputName
          undefined, // targetInputName
          fieldMappings
        );

        if (!compatibility.valid) {
          errors.push({
            edgeId: edge.id,
            type: 'type_mismatch',
            message: `Connection invalid: ${compatibility.errors.join(', ')}`,
          });
        }

        if (compatibility.warnings.length > 0) {
          warnings.push({
            edgeId: edge.id,
            type: 'type_warning',
            message: `Connection warning: ${compatibility.warnings.join(', ')}`,
          });
        }
      }

      // Validate field mappings if present
      if (edge.data?.fieldMappings && edge.data.fieldMappings.length > 0) {
        const mappingValidation = WorkflowDraftService.validateFieldMappings(
          edge,
          sourceNode,
          targetNode
        );
        errors.push(...mappingValidation.errors);
        warnings.push(...mappingValidation.warnings);
      }
    });

    // Check for cycles (optional - Flyte supports DAGs only)
    const hasCycle = WorkflowDraftService.detectCycle(draft.nodes, draft.edges);
    if (hasCycle) {
      errors.push({
        type: 'workflow',
        message: 'Workflow contains a cycle - DAGs only',
      });
    }

    // STRICT VALIDATION: Check for disconnected nodes (nodes without incoming or outgoing edges)
    const connectedNodes = new Set<string>();
    draft.edges.forEach((edge) => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    draft.nodes.forEach((node) => {
      // Skip start and end nodes in connectivity check
      if (node.type === 'start' || node.type === 'end') {
        return;
      }

      if (!connectedNodes.has(node.id)) {
        errors.push({
          nodeId: node.id,
          type: 'disconnected-node',
          message: `Node '${
            node.data.label || node.id
          }' is not connected to the workflow. Please connect it to other nodes.`,
        });
      }
    });

    // STRICT VALIDATION: Ensure start node has outgoing edges (if it exists)
    // Note: Start node validation is optional - orchestrator can handle missing start nodes
    // if (startNode) {
    //   const startOutgoing = draft.edges.filter(e => e.source === startNode.id);
    //   if (startOutgoing.length === 0) {
    //     errors.push({
    //       nodeId: startNode.id,
    //       type: 'missing-connection',
    //       message: 'Start node must have at least one outgoing connection',
    //     });
    //   }
    // }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect cycles in workflow graph
   */
  private static detectCycle(nodes: WorkflowBuilderNode[], edges: WorkflowBuilderEdge[]): boolean {
    const adjacencyList = new Map<string, string[]>();
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Build adjacency list
    nodes.forEach((node) => adjacencyList.set(node.id, []));
    edges.forEach((edge) => {
      const neighbors = adjacencyList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacencyList.set(edge.source, neighbors);
    });

    // DFS to detect cycle
    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      const hasCycleInNeighbor = neighbors.some((neighbor) => {
        if (!visited.has(neighbor)) {
          return dfs(neighbor);
        }
        return recursionStack.has(neighbor);
      });

      if (hasCycleInNeighbor) {
        return true;
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check each node
    return nodes.some((node) => {
      if (!visited.has(node.id)) {
        return dfs(node.id);
      }
      return false;
    });
  }

  /**
   * Validate gate node configuration
   */
  private static validateGateNode(
    node: WorkflowBuilderNode,
    draft: WorkflowDraft
  ): {
    errors: WorkflowValidationResult['errors'];
    warnings: WorkflowValidationResult['warnings'];
  } {
    const errors: WorkflowValidationResult['errors'] = [];
    const warnings: WorkflowValidationResult['warnings'] = [];

    if (!node.data.gateConfig) {
      errors.push({
        nodeId: node.id,
        type: 'gate',
        message: 'Gate node must have gate configuration',
      });
      return { errors, warnings };
    }

    const config = node.data.gateConfig;

    // Validate based on gate type
    switch (config.type) {
      case 'approve': {
        if (!config.signalId || config.signalId.trim() === '') {
          errors.push({
            nodeId: node.id,
            type: 'gate',
            message: 'Approval gate must have a signal ID',
          });
        } else if (!/^[a-zA-Z0-9_-]+$/.test(config.signalId)) {
          errors.push({
            nodeId: node.id,
            type: 'gate',
            message: 'Signal ID must contain only letters, numbers, hyphens, and underscores',
          });
        }

        // Check for duplicate signal IDs
        const duplicateApprove = draft.nodes.find(
          (n) =>
            n.id !== node.id && n.type === 'gate' && n.data.gateConfig?.signalId === config.signalId
        );
        if (duplicateApprove) {
          errors.push({
            nodeId: node.id,
            type: 'gate',
            message: `Signal ID "${config.signalId}" is already used by another gate`,
          });
        }

        if (!config.approvers || config.approvers.length === 0) {
          warnings.push({
            nodeId: node.id,
            type: 'gate',
            message: 'No approvers specified - any user can approve',
          });
        }
        break;
      }

      case 'signal': {
        if (!config.signalId || config.signalId.trim() === '') {
          errors.push({
            nodeId: node.id,
            type: 'gate',
            message: 'Signal gate must have a signal ID',
          });
        } else if (!/^[a-zA-Z0-9_-]+$/.test(config.signalId)) {
          errors.push({
            nodeId: node.id,
            type: 'gate',
            message: 'Signal ID must contain only letters, numbers, hyphens, and underscores',
          });
        }

        // Check for duplicate signal IDs
        const duplicateSignal = draft.nodes.find(
          (n) =>
            n.id !== node.id && n.type === 'gate' && n.data.gateConfig?.signalId === config.signalId
        );
        if (duplicateSignal) {
          errors.push({
            nodeId: node.id,
            type: 'gate',
            message: `Signal ID "${config.signalId}" is already used by another gate`,
          });
        }

        if (config.timeoutSeconds && config.timeoutSeconds <= 0) {
          errors.push({
            nodeId: node.id,
            type: 'gate',
            message: 'Timeout must be greater than 0',
          });
        }
        break;
      }

      case 'sleep':
        if (!config.duration || config.duration.seconds <= 0) {
          errors.push({
            nodeId: node.id,
            type: 'gate',
            message: 'Sleep gate must have a duration greater than 0',
          });
        } else if (config.duration.seconds > 2592000) {
          // 30 days
          warnings.push({
            nodeId: node.id,
            type: 'gate',
            message: 'Sleep duration exceeds 30 days',
          });
        }
        break;

      default:
        errors.push({
          nodeId: node.id,
          type: 'gate',
          message: `Invalid gate type: ${config.type}`,
        });
    }

    return { errors, warnings };
  }

  /**
   * Validate enhanced branch node configuration
   */
  private static validateBranchNode(
    node: WorkflowBuilderNode,
    draft: WorkflowDraft
  ): {
    errors: WorkflowValidationResult['errors'];
    warnings: WorkflowValidationResult['warnings'];
  } {
    const errors: WorkflowValidationResult['errors'] = [];
    const warnings: WorkflowValidationResult['warnings'] = [];

    if (!node.data.branchConfig) {
      // Only warn if no legacy conditions either
      if (!node.data.conditions || node.data.conditions.length === 0) {
        warnings.push({
          nodeId: node.id,
          type: 'branch',
          message: 'Branch node has no conditions configured',
        });
      }
      return { errors, warnings };
    }

    const config = node.data.branchConfig;

    // Validate primary case
    if (!config.primaryCase || !config.primaryCase.thenNodeId) {
      errors.push({
        nodeId: node.id,
        type: 'branch',
        message: 'Branch must have a primary IF case with target node',
      });
      return { errors, warnings };
    }

    // Check if target nodes exist
    const targetNodes = [
      config.primaryCase.thenNodeId,
      ...config.elseCases.map((c) => c.thenNodeId),
      config.elseNodeId,
    ].filter(Boolean);

    targetNodes.forEach((targetId) => {
      const targetExists = draft.nodes.some((n) => n.id === targetId);
      if (!targetExists) {
        errors.push({
          nodeId: node.id,
          type: 'branch',
          message: `Branch references non-existent target node: ${targetId}`,
        });
      }
    });

    // Warn if no default ELSE path
    if (!config.elseNodeId) {
      warnings.push({
        nodeId: node.id,
        type: 'branch',
        message: 'Branch has no ELSE default path - workflow will fail if no conditions match',
      });
    }

    // Check for duplicate target nodes
    const uniqueTargets = new Set(targetNodes);
    if (uniqueTargets.size < targetNodes.length) {
      warnings.push({
        nodeId: node.id,
        type: 'branch',
        message: 'Multiple conditions lead to the same task',
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate array map configuration
   */
  private static validateArrayMapConfig(node: WorkflowBuilderNode): {
    errors: WorkflowValidationResult['errors'];
    warnings: WorkflowValidationResult['warnings'];
  } {
    const errors: WorkflowValidationResult['errors'] = [];
    const warnings: WorkflowValidationResult['warnings'] = [];

    const config = node.data.arrayMapConfig;
    if (!config) return { errors, warnings };

    // Validate array input field
    if (!config.arrayInputField) {
      errors.push({
        nodeId: node.id,
        type: 'array_map',
        message: 'Array map must specify an array input field',
      });
    } else if (node.data.inputSchema) {
      // Check if field exists and is actually an array
      const properties = node.data.inputSchema.properties || {};
      const field = properties[config.arrayInputField];

      if (!field) {
        errors.push({
          nodeId: node.id,
          type: 'array_map',
          message: `Array input field "${config.arrayInputField}" does not exist in task schema`,
        });
      } else if (field.type !== 'array' && !field.items) {
        errors.push({
          nodeId: node.id,
          type: 'array_map',
          message: `Field "${config.arrayInputField}" is not an array type`,
        });
      }
    }

    // Validate parallelism
    if (config.parallelism <= 0) {
      errors.push({
        nodeId: node.id,
        type: 'array_map',
        message: 'Parallelism must be greater than 0',
      });
    } else if (config.parallelism > 100) {
      warnings.push({
        nodeId: node.id,
        type: 'array_map',
        message: 'High parallelism (>100) may overwhelm system resources',
      });
    } else if (config.parallelism > 50) {
      warnings.push({
        nodeId: node.id,
        type: 'array_map',
        message: 'Parallelism >50 may cause performance issues',
      });
    }

    // Validate success criteria
    switch (config.successCriteria) {
      case 'count':
        if (!config.minSuccesses || config.minSuccesses <= 0) {
          errors.push({
            nodeId: node.id,
            type: 'array_map',
            message: 'Minimum success count must be greater than 0',
          });
        }
        break;

      case 'ratio':
        if (
          config.minSuccessRatio === undefined ||
          config.minSuccessRatio < 0 ||
          config.minSuccessRatio > 1
        ) {
          errors.push({
            nodeId: node.id,
            type: 'array_map',
            message: 'Minimum success ratio must be between 0 and 1',
          });
        } else if (config.minSuccessRatio < 0.5) {
          warnings.push({
            nodeId: node.id,
            type: 'array_map',
            message: 'Success ratio <50% means workflow continues even if majority fails',
          });
        }
        break;

      case 'all':
        // No additional validation needed
        break;

      default:
        errors.push({
          nodeId: node.id,
          type: 'array_map',
          message: `Invalid success criteria: ${config.successCriteria}`,
        });
    }

    return { errors, warnings };
  }

  /**
   * Validate field mappings
   */
  /**
   * Resolve $ref in a field schema to get actual type and title
   */
  private static resolveFieldType(
    fieldSchema: any,
    parentSchema: any
  ): { type: string; title?: string } {
    // Check if field has $ref
    if (fieldSchema.$ref) {
      const refPath = fieldSchema.$ref.split('/').pop();
      if (refPath) {
        // Check $defs (modern JSON Schema)
        if (parentSchema.$defs && parentSchema.$defs[refPath]) {
          const refDef = parentSchema.$defs[refPath];
          return {
            type: refDef.type || 'object',
            title: refDef.title || refPath,
          };
        }
        // Check definitions (legacy JSON Schema)
        if (parentSchema.definitions && parentSchema.definitions[refPath]) {
          const refDef = parentSchema.definitions[refPath];
          return {
            type: refDef.type || 'object',
            title: refDef.title || refPath,
          };
        }
        // Fallback: use ref name as title
        return { type: 'object', title: refPath };
      }
    }

    // No $ref, return direct type info
    return {
      type: fieldSchema.type || 'any',
      title: fieldSchema.title,
    };
  }

  private static validateFieldMappings(
    edge: WorkflowBuilderEdge,
    sourceNode: WorkflowBuilderNode,
    targetNode: WorkflowBuilderNode
  ): {
    errors: WorkflowValidationResult['errors'];
    warnings: WorkflowValidationResult['warnings'];
  } {
    const errors: WorkflowValidationResult['errors'] = [];
    const warnings: WorkflowValidationResult['warnings'] = [];

    if (!edge.data?.fieldMappings) return { errors, warnings };

    const sourceSchema = sourceNode.data.outputSchema;
    const targetSchema = targetNode.data.inputSchema;

    if (!sourceSchema || !targetSchema) {
      warnings.push({
        edgeId: edge.id,
        type: 'field_mapping',
        message: 'Cannot validate field mappings - schemas not loaded',
      });
      return { errors, warnings };
    }

    const sourceFields = sourceSchema.properties || {};
    const targetFields = targetSchema.properties || {};
    const requiredFields = targetSchema.required || [];

    // Validate each mapping
    edge.data.fieldMappings.forEach((mapping) => {
      // Check source field exists
      if (!sourceFields[mapping.sourceField]) {
        errors.push({
          edgeId: edge.id,
          type: 'field_mapping',
          message: `Source field "${mapping.sourceField}" does not exist`,
        });
      }

      // Check target field exists
      if (!targetFields[mapping.targetField]) {
        errors.push({
          edgeId: edge.id,
          type: 'field_mapping',
          message: `Target field "${mapping.targetField}" does not exist`,
        });
      }

      // Check type compatibility (relaxed for complex types)
      if (sourceFields[mapping.sourceField] && targetFields[mapping.targetField]) {
        const sourceFieldSchema = sourceFields[mapping.sourceField];
        const targetFieldSchema = targetFields[mapping.targetField];

        // Resolve $ref to get actual types
        const sourceResolved = WorkflowDraftService.resolveFieldType(
          sourceFieldSchema,
          sourceSchema
        );
        const targetResolved = WorkflowDraftService.resolveFieldType(
          targetFieldSchema,
          targetSchema
        );

        const sourceType = sourceResolved.type;
        const targetType = targetResolved.type;
        const sourceTitle = sourceResolved.title || sourceType;
        const targetTitle = targetResolved.title || targetType;

        // Skip type checking for 'any' types
        if (sourceType === 'any' || targetType === 'any') {
          // Allow any type mappings
          return;
        }

        // Allow exact type matches
        if (sourceType === targetType) {
          return;
        }

        // Allow schema-based matches (same title/reference type)
        // This handles: result: BatchResult → batch_result: BatchResult
        if (sourceTitle === targetTitle) {
          return; // Same schema type!
        }

        // Allow object-to-object mappings (structural compatibility)
        if (sourceType === 'object' && targetType === 'object') {
          return; // Assume structural compatibility
        }

        // Only warn for genuinely incompatible types
        warnings.push({
          edgeId: edge.id,
          type: 'field_mapping',
          message: `Type mismatch: ${mapping.sourceField} (${sourceTitle}) → ${mapping.targetField} (${targetTitle})`,
        });
      }
    });

    // Check for unmapped required fields (only warn if field is NOT already filled in inputData)
    const mappedTargetFields = new Set(edge.data.fieldMappings.map((m) => m.targetField));
    const targetInputData = (targetNode.data as any).inputData || {};
    const targetConfig = targetNode.data.config || {};

    requiredFields.forEach((requiredField) => {
      if (!mappedTargetFields.has(requiredField)) {
        // Only warn if field is not already filled in config or inputData
        const hasValueInConfig =
          targetConfig[requiredField] !== undefined &&
          targetConfig[requiredField] !== null &&
          targetConfig[requiredField] !== '';
        const hasValueInInputData =
          targetInputData[requiredField] !== undefined &&
          targetInputData[requiredField] !== null &&
          targetInputData[requiredField] !== '';

        if (!hasValueInConfig && !hasValueInInputData) {
          warnings.push({
            edgeId: edge.id,
            type: 'field_mapping',
            message: `Required field "${requiredField}" is not mapped`,
          });
        }
      }
    });

    return { errors, warnings };
  }
}

// Export class for static method access
export const workflowDraftService = WorkflowDraftService;
