/**
 * Workflow Deployment Service
 * Handles deployment of workflow drafts
 */

import { nanoid } from 'nanoid';

import { prisma } from '@app/database';
import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { workflowDraftService } from './workflow-draft-service';
import { workflowCompilerServiceV2 } from './workflow-compiler-service-v2';

/**
 * Deployment configuration
 */
export interface DeploymentConfig {
  autoVersion?: boolean;
  version?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  notifications?: {
    email?: string;
    slack?: string;
  };
  resourceLimits?: {
    cpu?: string;
    memory?: string;
    timeout?: string;
  };
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  success: boolean;
  workflowId?: string;
  version?: string;
  error?: string;
  details?: {
    compiled: boolean;
    validated: boolean;
    registered: boolean;
    nodeCount?: number;
    taskCount?: number;
  };
}

/**
 * Deployment status
 */
export type DeploymentStatus =
  | 'pending'
  | 'validating'
  | 'compiling'
  | 'registering'
  | 'deployed'
  | 'failed';

/**
 * Workflow Deployment Service
 */
export class WorkflowDeploymentService {
  /**
   * Deploy a workflow draft (compile and register with engine)
   */
  static async deploy(
    draftId: string,
    config: DeploymentConfig = {},
    userId?: string,
    authToken?: string
  ): Promise<DeploymentResult> {
    console.log('='.repeat(80));
    console.log(`[Deployment] ===== STARTING DEPLOYMENT =====`);
    console.log(`[Deployment] Draft ID: ${draftId}`);
    console.log(`[Deployment] Config:`, JSON.stringify(config, null, 2));
    console.log(`[Deployment] User ID: ${userId}`);
    console.log(`[Deployment] Has Auth Token: ${!!authToken}`);
    console.log('='.repeat(80));

    try {
      // Step 1: Fetch draft from database
      console.log(`[Deployment] Step 1: Fetching draft from database...`);
      const draft = await workflowDraftService.getById(draftId);
      console.log(`[Deployment] Draft found:`, !!draft);

      if (!draft) {
        return {
          success: false,
          error: `Workflow draft ${draftId} not found`,
          details: {
            compiled: false,
            validated: false,
            registered: false,
          },
        };
      }

      // Step 2: Basic draft validation
      console.log(`[Deployment] Step 2: Basic draft validation: ${draft.name}`);
      const validation = await workflowDraftService.validate(draft);

      if (!validation.valid) {
        const errorMessages = validation.errors.map((e) => e.message).join('; ');
        return {
          success: false,
          error: `Workflow validation failed: ${errorMessages}`,
          details: {
            compiled: false,
            validated: false,
            registered: false,
          },
        };
      }

      // Step 2.5: Deep binding validation (Flyte-style) - SKIPPED
      // The binding validator is designed for post-compilation validation of Flyte workflows
      // Pre-compilation, nodes are in builder format and don't have Flyte bindings yet
      // Validation will happen during Flyte compilation/registration
      console.log(
        `[Deployment] Step 2.5: Skipping pre-compilation binding validation (Flyte will validate during compilation)...`
      );

      // Step 3: Task dependencies validation skipped
      // Task validation would be done at execution time, not deployment time
      console.log(`[Deployment] Skipping task dependency validation (done at execution time)`);

      // Step 4: Determine version
      let version = config.version || draft.version;

      if (config.autoVersion) {
        console.log(`[Deployment] Auto-generating version...`);
        // Get latest version from database
        const latestDeployment = await prisma.workflowDraft.findFirst({
          where: {
            project: draft.project,
            domain: draft.domain,
            name: draft.name,
            status: 'deployed',
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        // Generate unique version using nanoid to avoid conflicts
        version = `v-${nanoid(10)}`;
        console.log(`[Deployment] Generated unique version: ${version}`);
      } else {
        // Check if version already exists in database
        const existing = await prisma.workflowDraft.findFirst({
          where: {
            project: draft.project,
            domain: draft.domain,
            name: draft.name,
            version,
            status: 'deployed',
          },
        });

        if (existing) {
          return {
            success: false,
            error: `Workflow version ${version} already exists. Use autoVersion or specify a different version.`,
            details: {
              compiled: false,
              validated: true,
              registered: false,
            },
          };
        }
      }

      // Step 5: Compile to protobuf
      console.log(`[Deployment] Compiling workflow to protobuf...`);
      console.log(`[Deployment] Draft contains:`, {
        nodeCount: draft.nodes.length,
        edgeCount: draft.edges.length,
        taskNodes: draft.nodes.filter((n: any) => n.type === 'task').length,
      });

      // Log node input data for debugging
      console.log(`[Deployment] ===== DRAFT STRUCTURE ANALYSIS =====`);
      console.log(
        `[Deployment] Draft nodes:`,
        draft.nodes.map((n: any) => ({
          id: n.id,
          type: n.type,
          label: n.data?.label,
          hasInputData: !!(n.data as any)?.inputData,
          hasInputSchema: !!n.data?.inputSchema,
        }))
      );

      const nodesWithInputData = draft.nodes.filter((n: any) => {
        const inputData = (n.data as any)?.inputData;
        return inputData && Object.keys(inputData).length > 0;
      });
      console.log(
        `[Deployment] Nodes with inputData: ${nodesWithInputData.length}/${draft.nodes.length}`
      );
      nodesWithInputData.forEach((node: any) => {
        const inputData = (node.data as any).inputData || {};
        console.log(`[Deployment] - Node ${node.id}:`, {
          type: node.type,
          label: node.data.label,
          inputDataFields: Object.keys(inputData),
          inputDataValues: inputData, // NEW: Show actual values
          inputSchemaFields: node.data.inputSchema?.properties
            ? Object.keys(node.data.inputSchema.properties)
            : [],
        });
      });

      // Step 5: Compile workflow with V2 compiler (no preprocessing needed)
      console.log(
        `[Deployment] Step 5: Compiling workflow with V2 compiler (minimal, direct protobuf)...`
      );
      console.log(`[Deployment] Input to compiler:`, {
        version,
        nodeCount: draft.nodes.length,
        edgeCount: draft.edges.length,
        nodes: draft.nodes.map((n: any) => ({ id: n.id, type: n.type, label: n.data?.label })),
      });

      const compilationResult = workflowCompilerServiceV2.compile({
        ...draft,
        version,
        nodes: draft.nodes as any,
        edges: draft.edges as any,
      });

      console.log(`[Deployment] Compilation result:`, {
        success: true,
        stats: compilationResult.stats,
        hasTemplate: !!compilationResult.closure.primary?.template,
        templateNodeCount: compilationResult.closure.primary?.template?.nodes?.length || 0,
      });

      console.log(
        `[Deployment] Compilation successful: ${compilationResult.stats.nodeCount} nodes, ${compilationResult.stats.taskCount} tasks`
      );

      // Log compiled workflow structure for verification
      const compiledNodes = compilationResult.closure.primary?.template?.nodes || [];
      console.log(`[Deployment] Compiled ${compiledNodes.length} nodes to protobuf`);
      compiledNodes.forEach((node: any) => {
        const bindingCount = node.inputs?.length || 0;
        if (bindingCount > 0) {
          console.log(`[Deployment] - Node ${node.id}: ${bindingCount} input bindings`);
        }
      });

      // Step 6: Register workflow with engine (REQUIRED for deployment)
      const workflowId = `${draft.project}:${draft.domain}:${draft.name}:${version}`;
      console.log(`[Deployment] Registering workflow: ${workflowId}`);

      try {
        // Use internal HTTP call to /api/v1/engine/workflows (with RBAC)
        // IMPORTANT: Match Flyte's protobuf schema exactly per flyteidl/admin/workflow.proto:
        // - id must be a core.Identifier with resourceType = WORKFLOW
        // - spec.template must be core.WorkflowTemplate (extract from compiled.primary.template)
        // - spec.subWorkflows must be core.WorkflowTemplate[] (extract .template from each ICompiledWorkflow)
        const registrationPayload = {
          id: {
            resourceType: flyteidl.core.ResourceType.WORKFLOW,
            project: draft.project,
            domain: draft.domain,
            name: draft.name,
            version,
          },
          spec: {
            template: compilationResult.closure.primary?.template,
            // CRITICAL FIX: Extract .template from each compiled sub-workflow
            // compilationResult.closure.subWorkflows is ICompiledWorkflow[]
            // but WorkflowSpec.sub_workflows expects IWorkflowTemplate[]
            subWorkflows: (compilationResult.closure.subWorkflows || []).map(
              (compiled: any) => compiled.template
            ),
          },
        };

        // Enhanced logging for debugging
        console.log(`[Deployment] ===== REGISTRATION PAYLOAD ANALYSIS =====`);
        console.log(`[Deployment] ID:`, JSON.stringify(registrationPayload.id, null, 2));
        console.log(`[Deployment] Template exists:`, !!registrationPayload.spec.template);
        console.log(`[Deployment] Template type:`, typeof registrationPayload.spec.template);
        console.log(`[Deployment] Template is null:`, registrationPayload.spec.template === null);
        console.log(
          `[Deployment] Template is undefined:`,
          registrationPayload.spec.template === undefined
        );
        console.log(`[Deployment] Template.id exists:`, !!registrationPayload.spec.template?.id);
        console.log(
          `[Deployment] Template.metadata exists:`,
          !!registrationPayload.spec.template?.metadata
        );
        console.log(
          `[Deployment] Template.interface:`,
          JSON.stringify(registrationPayload.spec.template?.interface, null, 2)
        );
        console.log(
          `[Deployment] Template.nodes count:`,
          registrationPayload.spec.template?.nodes?.length || 0
        );
        console.log(
          `[Deployment] Template.outputs:`,
          JSON.stringify(registrationPayload.spec.template?.outputs, null, 2)
        );
        console.log(
          `[Deployment] SubWorkflows count:`,
          registrationPayload.spec.subWorkflows?.length || 0
        );

        // Log each node structure
        if (registrationPayload.spec.template?.nodes) {
          console.log(`[Deployment] ===== NODES STRUCTURE =====`);
          registrationPayload.spec.template.nodes.forEach((node: any, index: number) => {
            console.log(`[Deployment] Node ${index + 1}:`, JSON.stringify(node, null, 2));
          });
        }

        console.log(`[Deployment] ===== FULL PAYLOAD =====`);
        console.log(`[Deployment]`, JSON.stringify(registrationPayload, null, 2));

        // Make internal API call with auth token
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082/api';
        const response = await fetch(`${baseUrl}/v1/engine/workflows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authToken || '',
            'x-user-id': userId || 'system',
          },
          body: JSON.stringify(registrationPayload),
        });

        console.log(`[Deployment] Registration response status: ${response.status}`);
        const result = await response.json();
        console.log(`[Deployment] Registration response body:`, JSON.stringify(result, null, 2));

        if (!result.success) {
          console.error('[Deployment] Workflow registration failed:', result.error);

          // Parse Flyte compilation errors for better user feedback
          const errorMessage =
            result.error?.message || result.error || 'Failed to register workflow with engine';
          let userFriendlyError = errorMessage;

          // Check if this is a Flyte compilation error with specific issues
          if (
            typeof errorMessage === 'string' &&
            errorMessage.includes('failed to compile workflow')
          ) {
            const errorLines = errorMessage.split('\n');
            const errorCount = errorLines.filter((line) => line.trim().startsWith('Error')).length;

            if (errorCount > 0) {
              userFriendlyError = `Workflow validation failed with ${errorCount} error(s). Common issues:\n\n`;
              userFriendlyError +=
                '• Parameter not bound: Workflow input parameters are not connected to any nodes\n';
              userFriendlyError +=
                '• Value required: Node configuration fields are missing required values\n';
              userFriendlyError +=
                "• Variable not found: Nodes reference outputs that don't exist\n\n";
              userFriendlyError += 'Please review your workflow in the builder to:\n';
              userFriendlyError += '1. Connect workflow parameters to node inputs\n';
              userFriendlyError += '2. Fill in all required node configuration fields\n';
              userFriendlyError += '3. Ensure node output references are correct\n\n';
              userFriendlyError += `Full error details:\n${errorMessage}`;
            }
          }

          return {
            success: false,
            error: userFriendlyError,
            details: {
              compiled: true,
              validated: true,
              registered: false,
              ...compilationResult.stats,
            },
          };
        }

        console.log('[Deployment] Workflow registered successfully with engine:', result.data);
      } catch (regError: any) {
        console.error('[Deployment] Workflow registration failed:', regError);
        return {
          success: false,
          error: `Failed to register workflow with engine: ${regError.message}`,
          details: {
            compiled: true,
            validated: true,
            registered: false,
            ...compilationResult.stats,
          },
        };
      }

      // Step 7: Update database status
      const deploymentMetadata = {
        workflowId,
        deployedAt: new Date().toISOString(),
        version,
        compiledClosure: compilationResult.closure, // Store compiled protobuf
        ...config,
        ...compilationResult.stats,
      };

      await prisma.workflowDraft.update({
        where: { id: draftId },
        data: {
          status: 'deployed',
          version,
          metadata: draft.metadata
            ? { ...draft.metadata, deployment: deploymentMetadata }
            : { deployment: deploymentMetadata },
        },
      });

      console.log(`[Deployment] Database updated successfully`);

      return {
        success: true,
        workflowId,
        version,
        details: {
          compiled: true,
          validated: true,
          registered: true, // "Registered" in database, not Flyte
          ...compilationResult.stats,
        },
      };
    } catch (error: any) {
      console.error('[Deployment] Deployment failed:', error);

      let errorMessage = error?.message || 'Unknown error';
      let details = {
        compiled: false,
        validated: false,
        registered: false,
      };

      if (error?.name === 'CompilationError') {
        errorMessage = `Compilation error: ${error.message}`;
        if (error.nodeId) {
          errorMessage += ` (node: ${error.nodeId})`;
        }
        details = {
          compiled: false,
          validated: true,
          registered: false,
        };
      }

      return {
        success: false,
        error: errorMessage,
        details,
      };
    }
  }

  /**
   * Undeploy a workflow (mark as archived)
   */
  static async undeploy(draftId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const draft = await workflowDraftService.getById(draftId);

      if (!draft) {
        return {
          success: false,
          error: `Workflow draft ${draftId} not found`,
        };
      }

      // Update status to archived
      await prisma.workflowDraft.update({
        where: { id: draftId },
        data: {
          status: 'archived',
          metadata: draft.metadata
            ? { ...draft.metadata, archivedAt: new Date().toISOString() }
            : { archivedAt: new Date().toISOString() },
        },
      });

      return {
        success: true,
      };
    } catch (error: any) {
      console.error('[Deployment] Undeploy failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Redeploy a workflow with a new version
   */
  static async redeploy(draftId: string, config: DeploymentConfig = {}): Promise<DeploymentResult> {
    // Force auto-versioning for redeployment
    return WorkflowDeploymentService.deploy(draftId, {
      ...config,
      autoVersion: true,
    });
  }

  /**
   * Get deployment status for a draft
   */
  static async getDeploymentStatus(draftId: string): Promise<{
    status: DeploymentStatus;
    version?: string;
    workflowId?: string;
    deployedAt?: string;
    error?: string;
  }> {
    try {
      const draft = await workflowDraftService.getById(draftId);

      if (!draft) {
        return {
          status: 'failed',
          error: 'Draft not found',
        };
      }

      const metadata = draft.metadata as any;
      const deployment = metadata?.deployment;

      if (draft.status === 'deployed' && deployment) {
        return {
          status: 'deployed',
          version: deployment.version || draft.version,
          workflowId: deployment.workflowId,
          deployedAt: deployment.deployedAt,
        };
      }

      if (draft.status === 'archived') {
        return {
          status: 'failed',
          error: 'Workflow is archived',
        };
      }

      return {
        status: 'pending',
      };
    } catch (error: any) {
      return {
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Clone a deployed workflow to create a new draft
   */
  static async cloneToDraft(
    draftId: string,
    newName: string,
    userId: string
  ): Promise<{ success: boolean; draftId?: string; error?: string }> {
    try {
      const originalDraft = await workflowDraftService.getById(draftId);

      if (!originalDraft) {
        return {
          success: false,
          error: `Workflow draft ${draftId} not found`,
        };
      }

      // Create new draft
      const newDraft = await workflowDraftService.create(
        {
          name: newName,
          description: `Cloned from ${originalDraft.name}`,
          project: originalDraft.project,
          domain: originalDraft.domain,
          version: 'v1',
          nodes: originalDraft.nodes as any,
          edges: originalDraft.edges as any,
          metadata: {
            ...originalDraft.metadata,
            clonedFrom: draftId,
            clonedAt: new Date().toISOString(),
          },
        },
        userId,
        originalDraft.organizationId
      );

      return {
        success: true,
        draftId: newDraft.id,
      };
    } catch (error: any) {
      console.error('[Deployment] Clone failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * List all deployed workflows
   */
  static async listDeployed(filters?: {
    project?: string;
    domain?: string;
    organizationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const where: any = {
        status: 'deployed',
      };

      if (filters?.project) where.project = filters.project;
      if (filters?.domain) where.domain = filters.domain;
      if (filters?.organizationId) where.organizationId = filters.organizationId;

      const drafts = await prisma.workflowDraft.findMany({
        where,
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
        orderBy: { updatedAt: 'desc' },
      });

      // Enrich with execution statistics
      const enriched = await Promise.all(
        drafts.map(async (draft) => {
          const metadata = draft.metadata as any;
          const workflowId = metadata?.deployment?.workflowId || '';

          // Get execution counts
          const executionCount = await prisma.workflowExecution.count({
            where: { workflowId },
          });

          const lastExecution = await prisma.workflowExecution.findFirst({
            where: { workflowId },
            orderBy: { createdAt: 'desc' },
            select: {
              createdAt: true,
              phase: true,
            },
          });

          return {
            ...draft,
            executionCount,
            lastExecutionAt: lastExecution?.createdAt || null,
            lastExecutionStatus: lastExecution?.phase || null,
          };
        })
      );

      return enriched;
    } catch (error: any) {
      console.error('[Deployment] List deployed failed:', error);
      return [];
    }
  }
}

// All methods are static, no need for singleton
// Keep export for backward compatibility but methods should be called as WorkflowDeploymentService.methodName()
export const workflowDeploymentService = WorkflowDeploymentService;
