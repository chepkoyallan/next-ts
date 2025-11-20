/**
 * Flyte Workflow Deployment Service V4
 *
 * Deploys compiled workflows to Flyte via gRPC AdminService
 * Uses WorkflowCompilerServiceV4 for clean, type-aware compilation
 */

import type { AdminService } from '@app/engine';
import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';
import { logger } from 'src/app/api/lib/utils/logger';

import type { WorkflowDraft } from './workflow-draft-service';
import { type CompilationResult, WorkflowCompilerServiceV4 } from './compiler-v4';

/**
 * Workflow deployment request
 */
export interface WorkflowDeploymentRequestV4 {
  draft: WorkflowDraft;
  spec?: {
    description?: string;
    labels?: { [key: string]: string };
    annotations?: { [key: string]: string };
  };
}

/**
 * Workflow deployment result
 */
export interface WorkflowDeploymentResultV4 {
  success: boolean;
  workflowId: flyteidl.core.IIdentifier;
  message: string;

  // Compilation info
  compilationStats?: {
    nodeCount: number;
    taskCount: number;
    branchCount: number;
    compilationTimeMs: number;
    totalBindings: number;
  };

  // Deployment info
  deploymentTimeMs?: number;

  // Errors (if any)
  error?: string;
  errors?: Array<{
    code: string;
    message: string;
    nodeId?: string;
    nodeLabel?: string;
    details?: any;
    suggestion?: string;
  }>;

  // Warnings (if any)
  warnings?: Array<{
    code: string;
    message: string;
    nodeId?: string;
    action?: string;
  }>;
}

/**
 * Flyte Workflow Deployment Service V4
 * Handles workflow compilation (V4) and gRPC deployment to Flyte
 */
export class FlyteWorkflowDeploymentServiceV4 {
  private compiler: WorkflowCompilerServiceV4;
  private adminService: AdminService | null;

  constructor(adminService?: AdminService) {
    // Create compiler instance for server-side
    // Pass adminService for direct gRPC task queries (avoids HTTP calls)
    const serverBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    this.compiler = new WorkflowCompilerServiceV4(serverBaseUrl, adminService);
    this.adminService = adminService || null;
  }

  /**
   * Set the admin service (for lazy initialization)
   */
  setAdminService(adminService: AdminService): void {
    this.adminService = adminService;
  }

  /**
   * Deploy a workflow draft to Flyte
   *
   * Steps:
   * 1. Compile draft using CompilerV4
   * 2. Send via gRPC CreateWorkflow
   */
  async deployWorkflow(request: WorkflowDeploymentRequestV4): Promise<WorkflowDeploymentResultV4> {
    if (!this.adminService) {
      logger.error('[DeploymentV4] Admin service not initialized');
      return {
        success: false,
        workflowId: {
          resourceType: flyteidl.core.ResourceType.WORKFLOW,
          project: request.draft.project,
          domain: request.draft.domain,
          name: request.draft.name,
          version: request.draft.version,
        },
        message: 'Admin service not initialized',
        error: 'Please provide an AdminService instance via constructor or setAdminService()',
      };
    }

    const deployStart = Date.now();

    try {
      logger.info('[DeploymentV4] Starting workflow deployment', {
        workflow: `${request.draft.project}/${request.draft.domain}/${request.draft.name}:${request.draft.version}`,
      });

      // Step 1: Compile the draft
      logger.info('[DeploymentV4] Compiling workflow draft with V4 compiler...');
      const compilationResult: CompilationResult = await this.compiler.compile(request.draft);

      if (!compilationResult.success) {
        const errorCount = compilationResult.errors.length;
        const warningCount = compilationResult.warnings.length;
        const errorMessage = new Error('Compilation failed');
        logger.error('[DeploymentV4] Compilation failed', errorMessage, {
          errors: errorCount,
          warnings: warningCount,
        });

        return {
          success: false,
          workflowId: compilationResult.workflowId,
          message: 'Workflow compilation failed',
          error: FlyteWorkflowDeploymentServiceV4.formatCompilationErrors(compilationResult.errors),
          errors: compilationResult.errors,
          warnings: compilationResult.warnings,
          compilationStats: {
            nodeCount: compilationResult.stats.nodeCount,
            taskCount: compilationResult.stats.taskNodeCount,
            branchCount: compilationResult.stats.branchNodeCount,
            compilationTimeMs: compilationResult.stats.compilationTimeMs,
            totalBindings: compilationResult.stats.totalBindings,
          },
        };
      }

      logger.info('[DeploymentV4] ✅ Compilation successful', {
        stats: compilationResult.stats,
      });

      // Step 2: Send gRPC request to Flyte AdminService
      logger.info('[DeploymentV4] Deploying workflow to Flyte via gRPC...');
      const grpcStart = Date.now();

      await this.sendCreateWorkflowRequest(compilationResult, request.draft);

      const grpcTime = Date.now() - grpcStart;
      logger.info(`[DeploymentV4] ✅ gRPC deployment completed in ${grpcTime}ms`);

      const totalTime = Date.now() - deployStart;

      return {
        success: true,
        workflowId: compilationResult.workflowId,
        message: 'Workflow deployed successfully',
        compilationStats: {
          nodeCount: compilationResult.stats.nodeCount,
          taskCount: compilationResult.stats.taskNodeCount,
          branchCount: compilationResult.stats.branchNodeCount,
          compilationTimeMs: compilationResult.stats.compilationTimeMs,
          totalBindings: compilationResult.stats.totalBindings,
        },
        deploymentTimeMs: totalTime,
        warnings: compilationResult.warnings,
      };
    } catch (error: any) {
      logger.error('[DeploymentV4] Deployment failed', error as Error, {
        workflow: `${request.draft.project}/${request.draft.domain}/${request.draft.name}`,
      });

      // Check if error has enhanced suggestions (from parseAndEnhanceFlyteError)
      const errorResponse: WorkflowDeploymentResultV4 = {
        success: false,
        workflowId: {
          resourceType: flyteidl.core.ResourceType.WORKFLOW,
          project: request.draft.project,
          domain: request.draft.domain,
          name: request.draft.name,
          version: request.draft.version,
        },
        message: 'Workflow deployment failed',
        error: error.message || (error as Error).message,
      };

      // Include enhanced errors and suggestions if available
      if (error.errors) {
        errorResponse.errors = error.errors;
      }

      if (error.suggestions && error.suggestions.length > 0) {
        // Add suggestions to the error array for frontend display
        if (!errorResponse.errors) {
          errorResponse.errors = [];
        }

        // Add a summary error with all suggestions
        errorResponse.errors.unshift({
          code: 'DeploymentGuidance',
          message: 'Deployment failed with suggestions:',
          details: error.suggestions,
        });
      }

      return errorResponse;
    }
  }

  /**
   * Send CreateWorkflow gRPC request to Flyte
   */
  private async sendCreateWorkflowRequest(
    compilationResult: CompilationResult,
    draft: WorkflowDraft
  ): Promise<any> {
    if (!this.adminService) {
      throw new Error('Admin service not initialized');
    }

    try {
      logger.info('[DeploymentV4] Sending CreateWorkflow gRPC request', {
        workflow: `${compilationResult.workflowId.project}/${compilationResult.workflowId.domain}/${compilationResult.workflowId.name}:${compilationResult.workflowId.version}`,
      });

      // Build the workflow creation request
      const createRequest = {
        id: compilationResult.workflowId,
        spec: {
          template: compilationResult.closure?.primary?.template,
          subWorkflows: [], // Subworkflows are pre-registered separately
        },
      };

      // Log workflow structure details
      const nodes = createRequest.spec.template?.nodes || [];
      console.log(
        '[DeploymentV4] Workflow structure:',
        JSON.stringify(
          {
            nodeCount: nodes.length,
            nodes: nodes.map((n) => {
              let nodeType: string;
              if (n.taskNode) {
                nodeType = 'task';
              } else if (n.branchNode) {
                nodeType = 'branch';
              } else {
                nodeType = 'unknown';
              }

              return {
                id: n.id,
                type: nodeType,
                inputCount: n.inputs?.length || 0,
                branchStructure: n.branchNode
                  ? {
                      hasIfElse: !!n.branchNode.ifElse,
                      hasPrimaryCase: !!n.branchNode.ifElse?.case,
                      hasThenNode: !!n.branchNode.ifElse?.case?.thenNode,
                      thenNodeId: n.branchNode.ifElse?.case?.thenNode?.id,
                      hasElseNode: !!n.branchNode.ifElse?.elseNode,
                      elseNodeId: n.branchNode.ifElse?.elseNode?.id,
                    }
                  : null,
              };
            }),
            outputs: createRequest.spec.template?.outputs?.map((o) => ({
              var: o.var,
              promiseNodeId: o.binding?.promise?.nodeId,
            })),
          },
          null,
          2
        )
      );

      // Log request structure
      console.log(
        '[DeploymentV4] CreateWorkflow request:',
        JSON.stringify(
          {
            id: createRequest.id,
            nodeCount: createRequest.spec.template?.nodes?.length || 0,
            firstNodeInputs:
              createRequest.spec.template?.nodes?.[0]?.inputs?.map((i) => i.var) || [],
          },
          null,
          2
        )
      );

      // Use the AdminService to create the workflow with timeout
      console.log('[DeploymentV4] Calling createWorkflow via gRPC...');
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('gRPC createWorkflow timeout after 30 seconds')), 30000);
      });

      const response = (await Promise.race([
        this.adminService.createWorkflow(createRequest),
        timeoutPromise,
      ])) as any;

      console.log('[DeploymentV4] ✅ CreateWorkflow succeeded');

      return response;
    } catch (error: any) {
      logger.error('[DeploymentV4] CreateWorkflow gRPC call failed', error, {
        workflow: `${compilationResult.workflowId.project}/${compilationResult.workflowId.domain}/${compilationResult.workflowId.name}`,
      });

      // Log detailed error
      console.error('[DeploymentV4] ========== GRPC ERROR ==========');
      console.error('[DeploymentV4] Error message:', error.message);
      if (error.details) {
        console.error('[DeploymentV4] Error details:', error.details);
      }
      console.error('[DeploymentV4] ====================================');

      // Parse and enhance error message for frontend
      const enhancedError = FlyteWorkflowDeploymentServiceV4.parseAndEnhanceFlyteError(
        error,
        draft
      );

      // Throw enhanced error with suggestions
      const enhancedErrorObj = new Error(enhancedError.message) as any;
      enhancedErrorObj.originalMessage = error.message;
      enhancedErrorObj.suggestions = enhancedError.suggestions;
      enhancedErrorObj.errors = enhancedError.errors;
      enhancedErrorObj.code = error.code;
      enhancedErrorObj.details = error.details;

      throw enhancedErrorObj;
    }
  }

  /**
   * Check if a workflow exists in Flyte
   */
  async workflowExists(
    project: string,
    domain: string,
    name: string,
    version: string
  ): Promise<boolean> {
    if (!this.adminService) {
      logger.warn('[DeploymentV4] Admin service not initialized for workflow existence check');
      return false;
    }

    try {
      const workflow = await this.adminService.getWorkflow({
        id: {
          resourceType: flyteidl.core.ResourceType.WORKFLOW,
          project,
          domain,
          name,
          version,
        },
      });
      return workflow !== null && workflow !== undefined;
    } catch (error: any) {
      logger.warn('[DeploymentV4] Error checking workflow existence', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * List workflows from Flyte
   */
  async listWorkflows(project: string, domain: string, limit: number = 100): Promise<any[]> {
    if (!this.adminService) {
      logger.warn('[DeploymentV4] Admin service not initialized for workflow listing');
      return [];
    }

    try {
      const response = await this.adminService.listWorkflows({
        id: {
          project,
          domain,
        },
        limit,
        token: '',
        filters: '',
        sortBy: {
          key: 'created_at',
          direction: flyteidl.admin.Sort.Direction.DESCENDING,
        },
      });

      return response.workflows || [];
    } catch (error) {
      logger.error('[DeploymentV4] Failed to list workflows', error as Error, { project, domain });
      return [];
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Parse Flyte gRPC errors and provide helpful suggestions for common issues
   */
  private static parseAndEnhanceFlyteError(
    error: any,
    draft: WorkflowDraft
  ): {
    message: string;
    suggestions: string[];
    errors: Array<{
      code: string;
      message: string;
      nodeId?: string;
      nodeLabel?: string;
      suggestion?: string;
    }>;
  } {
    const errorMessage = error.message || error.details || 'Unknown deployment error';
    const suggestions: string[] = [];
    const enhancedErrors: Array<{
      code: string;
      message: string;
      nodeId?: string;
      nodeLabel?: string;
      suggestion?: string;
    }> = [];

    // Pattern 1: VariableNameNotFound for nested field access
    // Example: "Variable [node-123.o0.timeout_requests] not found"
    const nestedFieldPattern = /Variable \[([^\]]+)\.o0\.([^\]]+)\] not found/;
    const nestedFieldMatch = errorMessage.match(nestedFieldPattern);

    if (nestedFieldMatch) {
      const nodeId = nestedFieldMatch[1];
      const fieldName = nestedFieldMatch[2];
      const node = draft.nodes.find((n) => n.id === nodeId);
      const nodeLabel = node?.data?.label || nodeId;

      enhancedErrors.push({
        code: 'VariableNameNotFound',
        message: `Cannot access nested field '${fieldName}' directly in branch conditions`,
        nodeId,
        nodeLabel,
        suggestion: `Flyte cannot validate nested field access on STRUCT types at compile time. Use a field extractor task before the branch.`,
      });

      suggestions.push(
        `🔧 Solution: Add a field extractor task between '${nodeLabel}' and your branch node.`,
        `   1. Add task: fieldextractor.field_extractor.extract_integer_field (or extract_string_field, extract_boolean_field, etc.)`,
        `   2. Connect '${nodeLabel}' output to the extractor's 'data' input`,
        `   3. Set extractor's 'field_path' parameter to: "${fieldName}"`,
        `   4. Connect the extractor's output to your branch condition`,
        `   5. Update branch condition to compare the extracted value (simple type) instead of nested field`,
        ``,
        `📖 Learn more: Check /src/tasks/field-extractor/README.md for detailed examples`
      );
    }

    // Pattern 2: VariableNameNotFound (general case)
    const variableNotFoundPattern = /Variable \[([^\]]+)\] not found/;
    const variableMatch = errorMessage.match(variableNotFoundPattern);

    if (variableMatch && !nestedFieldMatch) {
      const variableName = variableMatch[1];

      // Try to identify which node this relates to
      let affectedNode: string | undefined;
      if (variableName.includes('.')) {
        const parts = variableName.split('.');
        affectedNode = parts[0];
      }

      enhancedErrors.push({
        code: 'VariableNameNotFound',
        message: `Variable '${variableName}' not found`,
        nodeId: affectedNode,
        suggestion:
          'Check that the upstream node produces this output and that the binding is correct.',
      });

      suggestions.push(
        `🔧 Variable '${variableName}' is not available.`,
        `   - Check that the upstream node exists and produces output 'o0'`,
        `   - Verify that node inputs are correctly bound to upstream outputs`,
        `   - For branch conditions, ensure the branch node has passthrough bindings`
      );
    }

    // Pattern 3: ParameterNotBound
    const paramNotBoundPattern = /Parameter not bound \[([^\]]+)\]/;
    const paramMatch = errorMessage.match(paramNotBoundPattern);

    if (paramMatch) {
      const paramName = paramMatch[1];

      enhancedErrors.push({
        code: 'ParameterNotBound',
        message: `Parameter '${paramName}' is not bound`,
        suggestion: 'Ensure all task inputs are connected to upstream outputs or workflow inputs.',
      });

      suggestions.push(
        `🔧 Parameter '${paramName}' needs to be connected.`,
        `   - In the workflow builder UI, connect an edge to this node's '${paramName}' input`,
        `   - Or bind it to a workflow input parameter`
      );
    }

    // Pattern 4: NodeReferenceNotFound
    const nodeRefPattern = /Referenced node \[([^\]]+)\] not found/;
    const nodeRefMatch = errorMessage.match(nodeRefPattern);

    if (nodeRefMatch) {
      const missingNodeId = nodeRefMatch[1];
      const node = draft.nodes.find((n) => n.id === missingNodeId);

      enhancedErrors.push({
        code: 'NodeReferenceNotFound',
        message: `Node '${missingNodeId}' is referenced but not found`,
        nodeId: missingNodeId,
        nodeLabel: node?.data?.label,
        suggestion: 'This node may be embedded in a branch. Check branch configuration.',
      });

      suggestions.push(
        `🔧 Node '${missingNodeId}' cannot be found.`,
        `   - This may be a node that should be embedded inside a branch (then/else blocks)`,
        `   - Check your branch configuration to ensure then/else nodes are properly defined`
      );
    }

    // Pattern 5: MismatchingTypes
    const typeMismatchPattern = /MismatchingTypes.*expected.*got/i;
    if (typeMismatchPattern.test(errorMessage)) {
      enhancedErrors.push({
        code: 'MismatchingTypes',
        message: errorMessage,
        suggestion:
          'Type mismatch detected. You may be comparing a complex STRUCT to a simple type.',
      });

      suggestions.push(
        `🔧 Type mismatch in branch condition or binding.`,
        `   - If comparing fields: Use a field extractor to extract simple types before branching`,
        `   - If passing data: Ensure output types match input types`,
        `   - Complex STRUCTs cannot be directly compared to integers, strings, etc.`
      );
    }

    // Build final message
    let finalMessage = errorMessage;
    if (suggestions.length > 0) {
      finalMessage = `Flyte Validation Error\n\n${errorMessage}\n\n${suggestions.join('\n')}`;
    }

    return {
      message: finalMessage,
      suggestions,
      errors:
        enhancedErrors.length > 0 ? enhancedErrors : [{ code: 'Unknown', message: errorMessage }],
    };
  }

  /**
   * Format compilation errors into a readable string
   */
  private static formatCompilationErrors(
    errors: Array<{ code: string; message: string; nodeId?: string }>
  ): string {
    if (errors.length === 0) return 'Unknown compilation error';

    const errorMessages = errors.map((err) => {
      if (err.nodeId) {
        return `[${err.code}] Node ${err.nodeId}: ${err.message}`;
      }
      return `[${err.code}] ${err.message}`;
    });

    return errorMessages.join('\n');
  }
}
