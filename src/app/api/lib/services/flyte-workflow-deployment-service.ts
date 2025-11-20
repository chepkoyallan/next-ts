/**
 * Flyte Workflow Deployment Service
 *
 * Deploys compiled workflows to Flyte via gRPC AdminService
 * Uses WorkflowCompilerServiceV3 for compilation
 */

import type { AdminService } from '@app/engine';
import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { logger } from '../utils/logger';
import type { WorkflowDraft } from './workflow-draft-service';
import { CompilationResultV3, WorkflowCompilerServiceV3 } from './workflow-compiler-service-v3';

/**
 * Workflow deployment request
 */
export interface WorkflowDeploymentRequest {
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
export interface WorkflowDeploymentResult {
  success: boolean;
  workflowId: flyteidl.core.IIdentifier;
  message: string;
  compilationStats?: {
    nodeCount: number;
    taskCount: number;
    branchCount: number;
  };
  error?: string;
}

/**
 * Flyte Workflow Deployment Service
 * Handles workflow compilation and gRPC deployment to Flyte
 */
export class FlyteWorkflowDeploymentService {
  private compiler: WorkflowCompilerServiceV3;

  private adminService: AdminService | null;

  constructor(adminService?: AdminService) {
    // Create compiler instance for server-side
    // Pass adminService for direct gRPC task queries (avoids HTTP calls)
    const serverBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    this.compiler = new WorkflowCompilerServiceV3(serverBaseUrl, adminService);
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
   * 1. Compile draft using CompilerV3
   * 2. Send via gRPC CreateWorkflow
   */
  async deployWorkflow(request: WorkflowDeploymentRequest): Promise<WorkflowDeploymentResult> {
    if (!this.adminService) {
      logger.error('Admin service not initialized');
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

    try {
      // logger.info('Starting workflow deployment', {
      //   workflow: `${request.draft.project}/${request.draft.domain}/${request.draft.name}:${request.draft.version}`,
      // });

      // Step 1: Compile the draft
      // logger.info('Compiling workflow draft...');
      const compilationResult = await this.compiler.compile(request.draft);

      // logger.info('Workflow compiled successfully', {
      //   stats: compilationResult.stats,
      // });

      // Step 2: Send gRPC request to Flyte AdminService
      // logger.info('Deploying workflow to Flyte via gRPC...');
      await this.sendCreateWorkflowRequest(compilationResult);

      // logger.info('Workflow deployed successfully to Flyte', {
      //   workflowId: compilationResult.id,
      // });

      return {
        success: true,
        workflowId: compilationResult.id,
        message: 'Workflow deployed successfully',
        compilationStats: compilationResult.stats,
      };
    } catch (error) {
      logger.error('Workflow deployment failed', error as Error, {
        workflow: `${request.draft.project}/${request.draft.domain}/${request.draft.name}`,
      });

      return {
        success: false,
        workflowId: {
          resourceType: flyteidl.core.ResourceType.WORKFLOW,
          project: request.draft.project,
          domain: request.draft.domain,
          name: request.draft.name,
          version: request.draft.version,
        },
        message: 'Workflow deployment failed',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Send CreateWorkflow gRPC request to Flyte
   */
  private async sendCreateWorkflowRequest(compilationResult: CompilationResultV3): Promise<any> {
    if (!this.adminService) {
      throw new Error('Admin service not initialized');
    }

    try {
      // logger.info('Sending CreateWorkflow gRPC request', {
      //   workflow: `${compilationResult.id.project}/${compilationResult.id.domain}/${compilationResult.id.name}:${compilationResult.id.version}`,
      // });

      // Build the workflow creation request
      const createRequest = {
        id: compilationResult.id,
        spec: {
          template: compilationResult.closure.primary?.template,
          subWorkflows: [], // Subworkflows are pre-registered separately
        },
      };

      // Log the nodes and their inputs being sent to Flyte
      // console.log('[DEPLOYMENT] CreateWorkflow request nodes:', JSON.stringify({
      //   nodeCount: createRequest.spec.template?.nodes?.length || 0,
      //   nodes: createRequest.spec.template?.nodes?.map(node => ({
      //     id: node.id,
      //     inputCount: node.inputs?.length || 0,
      //     inputVars: node.inputs?.map(i => i.var) || [],
      //   })),
      // }, null, 2));

      // Check AdminService connection status
      console.log('[DEPLOYMENT] AdminService status:', {
        exists: !!this.adminService,
        hasClient: !!(this.adminService as any)?.client,
        isConnected: !!(this.adminService as any)?.isConnected?.(),
      });

      // Log the request structure being sent
      console.log(
        '[DEPLOYMENT] CreateWorkflow request:',
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
      console.log('[DEPLOYMENT] Calling createWorkflow via gRPC...');
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('gRPC createWorkflow timeout after 30 seconds')), 30000);
      });

      const response = (await Promise.race([
        this.adminService.createWorkflow(createRequest),
        timeoutPromise,
      ])) as any;

      console.log('[DEPLOYMENT] CreateWorkflow succeeded');

      // logger.info('CreateWorkflow response received', {
      //   success: true,
      // });

      return response;
    } catch (error: any) {
      // logger.error('CreateWorkflow gRPC call failed', error, {
      //   workflow: `${compilationResult.id.project}/${compilationResult.id.domain}/${compilationResult.id.name}`,
      // });

      // // Log the full error details
      // console.error('[DEPLOYMENT] ========== GRPC ERROR ==========');
      // console.error('[DEPLOYMENT] Error message:', error.message);
      if (error.details) {
        // console.error('[DEPLOYMENT] Error details:', error.details);
      }
      // console.error('[DEPLOYMENT] ====================================');

      throw error;
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
      logger.warn('Admin service not initialized for workflow existence check');
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
      logger.warn('Error checking workflow existence', {
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Delete a workflow from Flyte
   * Note: Flyte Admin API typically doesn't support deleting specific versions
   */
  static async deleteWorkflow(
    project: string,
    domain: string,
    name: string,
    version: string
  ): Promise<boolean> {
    logger.warn('Delete workflow is not supported by Flyte Admin API', {
      project,
      domain,
      name,
      version,
    });
    return false;
  }

  /**
   * List workflows from Flyte
   */
  async listWorkflows(project: string, domain: string, limit: number = 100): Promise<any[]> {
    if (!this.adminService) {
      logger.warn('Admin service not initialized for workflow listing');
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
      logger.error('Failed to list workflows', error as Error, { project, domain });
      return [];
    }
  }
}

// Note: No longer exporting singleton - create instances with AdminService as needed
// Example: new FlyteWorkflowDeploymentService(adminService)
