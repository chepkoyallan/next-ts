/**
 * Flyte Admin Client
 * Client for interacting with Flyte Admin API for workflow/task registration
 */

import * as grpc from '@grpc/grpc-js';
import * as $protobuf from 'protobufjs';

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { logger } from '../utils/logger';
import type { WorkflowBuilderNode } from './workflow-draft-service';

/**
 * Workflow registration request
 */
export interface WorkflowCreateRequest {
  id: flyteidl.core.IIdentifier;
  closure: flyteidl.core.ICompiledWorkflowClosure;
  description?: string;
}

/**
 * Workflow registration response
 */
export interface WorkflowCreateResponse {
  success: boolean;
  workflowId: string;
  error?: string;
}

/**
 * Task validation result
 */
export interface TaskValidationResult {
  valid: boolean;
  missingTasks: Array<{
    project: string;
    domain: string;
    name: string;
    version: string;
  }>;
  errors: string[];
}

/**
 * Workflow list response
 */
export interface WorkflowListResponse {
  workflows: Array<{
    id: flyteidl.core.IIdentifier;
    closure: flyteidl.admin.IWorkflowClosure;
    shortDescription?: string;
  }>;
  token?: string;
}

/**
 * Flyte Admin Client Configuration
 */
export interface FlyteAdminConfig {
  host: string;
  port: number;
  secure?: boolean;
}

/**
 * Flyte Admin Client Service
 */
export class FlyteAdminClient {
  private host: string;

  private port: number;

  private secure: boolean;

  private client: grpc.Client;

  private adminService: flyteidl.service.AdminService;

  private credentials: grpc.ChannelCredentials;

  constructor(config: FlyteAdminConfig) {
    this.host = config.host;
    this.port = config.port;
    this.secure = config.secure || false;

    // Create credentials
    this.credentials = this.secure
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();

    const address = `${this.host}:${this.port}`;

    // Create gRPC client
    this.client = new grpc.Client(address, this.credentials, {
      'grpc.max_receive_message_length': 100 * 1024 * 1024, // 100MB
      'grpc.max_send_message_length': 100 * 1024 * 1024, // 100MB
    });

    // Create RPC implementation function
    const rpcImpl: $protobuf.RPCImpl = (method, requestData, callback) => {
      const servicePath = `/flyteidl.service.AdminService/${method.name}`;

      logger.debug('gRPC call', {
        service: 'AdminService',
        method: method.name,
        path: servicePath,
      });

      // Make unary gRPC call
      this.client.makeUnaryRequest(
        servicePath,
        (arg: any) => Buffer.from(arg),
        (arg: Buffer) => arg,
        requestData as Buffer,
        (error: grpc.ServiceError | null, response?: Buffer) => {
          if (error) {
            logger.error('gRPC call failed', error);
            callback(error, null);
          } else {
            callback(null, response);
          }
        }
      );
    };

    // Create AdminService with our RPC implementation
    this.adminService = new flyteidl.service.AdminService(rpcImpl);
  }

  /**
   * Initialize the client
   */
  async initialize(): Promise<void> {
    try {
      const address = `${this.host}:${this.port}`;
      logger.info(`Initializing Flyte Admin client at ${address}`);

      // Wait for channel to be ready
      const deadline = Date.now() + 10000; // 10 second timeout
      await new Promise<void>((resolve, reject) => {
        this.client.waitForReady(deadline, (error) => {
          if (error) {
            logger.warn('Flyte Admin client connection timeout', { error: error.message });
            // Don't reject - allow app to start even if Flyte is unavailable
            resolve();
          } else {
            logger.info(`Flyte Admin client connected to ${address}`);
            resolve();
          }
        });
      });
    } catch (error) {
      logger.error('Failed to initialize Flyte Admin client', error as Error);
      throw error;
    }
  }

  /**
   * Create/Register a workflow with Flyte Admin
   */
  async createWorkflow(request: WorkflowCreateRequest): Promise<WorkflowCreateResponse> {
    try {
      logger.info('Creating workflow in Flyte Admin', {
        project: request.id.project,
        domain: request.id.domain,
        name: request.id.name,
        version: request.id.version,
      });

      // Build the gRPC request using the generated types
      const grpcRequest: flyteidl.admin.IWorkflowCreateRequest = {
        id: request.id as flyteidl.core.IIdentifier,
        spec: {
          template: request.closure.primary?.template,
          subWorkflows: (request.closure.subWorkflows || []) as any,
        },
      };

      // Call Flyte Admin API
      await this.adminService.createWorkflow(grpcRequest);

      // Format workflow ID
      const workflowId = `${request.id.project}:${request.id.domain}:${request.id.name}:${request.id.version}`;

      logger.info('Workflow registered successfully', { workflowId });

      return {
        success: true,
        workflowId,
      };
    } catch (error: any) {
      logger.error('Failed to create workflow', error);

      // Handle specific gRPC errors
      let errorMessage = error.message;

      if (error.code === grpc.status.ALREADY_EXISTS) {
        errorMessage = `Workflow version ${request.id.version} already exists. Please use a different version.`;
      } else if (error.code === grpc.status.INVALID_ARGUMENT) {
        errorMessage = `Invalid workflow definition: ${error.details || error.message}`;
      } else if (error.code === grpc.status.NOT_FOUND) {
        errorMessage = `Referenced task or workflow not found: ${error.details || error.message}`;
      } else if (error.code === grpc.status.PERMISSION_DENIED) {
        errorMessage = `Permission denied. Check your authentication credentials.`;
      } else if (error.code === grpc.status.UNAVAILABLE) {
        errorMessage = `Flyte Admin server unavailable at ${this.host}:${this.port}. Please ensure the server is running.`;
      }

      return {
        success: false,
        workflowId: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Get a workflow by ID
   */
  async getWorkflow(
    project: string,
    domain: string,
    name: string,
    version: string
  ): Promise<flyteidl.admin.Workflow | null> {
    try {
      logger.info('Getting workflow', { project, domain, name, version });

      const request: flyteidl.admin.IObjectGetRequest = {
        id: {
          resourceType: flyteidl.core.ResourceType.WORKFLOW,
          project,
          domain,
          name,
          version,
        },
      };

      const response = await this.adminService.getWorkflow(request);
      return response as flyteidl.admin.Workflow;
    } catch (error: any) {
      if (error.code === grpc.status.NOT_FOUND) {
        return null;
      }
      logger.error('Failed to get workflow', error);
      throw error;
    }
  }

  /**
   * List workflows in a project/domain
   */
  async listWorkflows(
    project: string,
    domain: string,
    options?: {
      limit?: number;
      token?: string;
      filters?: string;
      sortBy?: any;
    }
  ): Promise<WorkflowListResponse> {
    try {
      logger.info('Listing workflows', { project, domain, options });

      const request: flyteidl.admin.IResourceListRequest = {
        id: {
          project,
          domain,
        },
        limit: options?.limit || 50,
        token: options?.token || '',
        filters: options?.filters || '',
        sortBy: options?.sortBy,
      };

      const response = await this.adminService.listWorkflows(request);

      return {
        workflows: (response.workflows || []) as any[],
        token: response.token,
      };
    } catch (error: any) {
      logger.error('Failed to list workflows', error);
      return {
        workflows: [],
      };
    }
  }

  /**
   * Get the latest version of a workflow
   */
  async getLatestWorkflowVersion(project: string, domain: string, name: string): Promise<string> {
    try {
      const response = await this.listWorkflows(project, domain, {
        filters: `eq(workflow.name,${name})`,
        sortBy: {
          key: 'created_at',
          direction: 'DESCENDING',
        },
        limit: 1,
      });

      if (response.workflows.length > 0) {
        return response.workflows[0].id?.version || 'v1';
      }

      return 'v1';
    } catch (error) {
      logger.error('Failed to get latest version', error);
      return 'v1';
    }
  }

  /**
   * Generate next workflow version
   */
  async generateNextVersion(project: string, domain: string, name: string): Promise<string> {
    try {
      const latestVersion = await this.getLatestWorkflowVersion(project, domain, name);

      // Parse version number (assumes format like 'v1', 'v2', etc.)
      const match = latestVersion.match(/v(\d+)/);
      if (match) {
        const versionNum = parseInt(match[1], 10);
        return `v${versionNum + 1}`;
      }

      // If no version found or can't parse, start with v1
      return 'v1';
    } catch (error) {
      logger.error('Failed to generate next version', error);
      return 'v1';
    }
  }

  /**
   * Validate that all task dependencies exist in Flyte
   */
  async validateTaskDependencies(nodes: WorkflowBuilderNode[]): Promise<TaskValidationResult> {
    const missingTasks: TaskValidationResult['missingTasks'] = [];
    const errors: string[] = [];

    // Extract all task references
    const taskNodes = nodes.filter((n) => n.type === 'task' && n.data.taskId);

    // Validate tasks in parallel using Promise.all
    await Promise.all(
      taskNodes.map(async (node) => {
        if (!node.data.taskId) return;

        const { project, domain, name, version } = node.data.taskId;

        try {
          // Check if task exists
          const exists = await this.taskExists(project, domain, name, version);

          if (!exists) {
            missingTasks.push({ project, domain, name, version });
            errors.push(
              `Task not found: ${project}/${domain}/${name}/${version} (referenced by node "${
                node.data.label || node.id
              }")`
            );
          }
        } catch (error: any) {
          errors.push(`Failed to validate task ${name}: ${error.message}`);
        }
      })
    );

    return {
      valid: missingTasks.length === 0 && errors.length === 0,
      missingTasks,
      errors,
    };
  }

  /**
   * Check if a task exists in Flyte
   */
  async taskExists(
    project: string,
    domain: string,
    name: string,
    version: string
  ): Promise<boolean> {
    try {
      logger.info('Checking if task exists', { project, domain, name, version });

      const request: flyteidl.admin.IObjectGetRequest = {
        id: {
          resourceType: flyteidl.core.ResourceType.TASK,
          project,
          domain,
          name,
          version,
        },
      };

      await this.adminService.getTask(request);
      return true;
    } catch (error: any) {
      if (error.code === grpc.status.NOT_FOUND) {
        return false;
      }
      // For other errors, log warning and assume task exists (fail open)
      logger.warn(`Error checking task ${name}`, { error: error.message });
      return true;
    }
  }

  /**
   * Get task details
   */
  async getTask(
    project: string,
    domain: string,
    name: string,
    version: string
  ): Promise<flyteidl.admin.Task | null> {
    try {
      logger.info('Getting task', { project, domain, name, version });

      const request: flyteidl.admin.IObjectGetRequest = {
        id: {
          resourceType: flyteidl.core.ResourceType.TASK,
          project,
          domain,
          name,
          version,
        },
      };

      const response = await this.adminService.getTask(request);
      return response as flyteidl.admin.Task;
    } catch (error: any) {
      if (error.code === grpc.status.NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List tasks in a project/domain
   */
  async listTasks(
    project: string,
    domain: string,
    options?: {
      limit?: number;
      token?: string;
      filters?: string;
    }
  ): Promise<flyteidl.admin.TaskList> {
    try {
      logger.info('Listing tasks', { project, domain, options });

      const request: flyteidl.admin.IResourceListRequest = {
        id: {
          project,
          domain,
        },
        limit: options?.limit || 50,
        token: options?.token || '',
        filters: options?.filters || '',
      };

      const response = await this.adminService.listTasks(request);
      return response as flyteidl.admin.TaskList;
    } catch (error: any) {
      logger.error('Failed to list tasks', error);
      return { tasks: [], token: '' } as flyteidl.admin.TaskList;
    }
  }

  /**
   * Update workflow (actually creates a new version)
   */
  async updateWorkflow(request: WorkflowCreateRequest): Promise<WorkflowCreateResponse> {
    // In Flyte, updating means creating a new version
    // Generate new version
    const newVersion = await this.generateNextVersion(
      request.id.project || '',
      request.id.domain || '',
      request.id.name || ''
    );

    // Create with new version
    return this.createWorkflow({
      ...request,
      id: {
        ...request.id,
        version: newVersion,
      },
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: true, // We allow the app to start even if not connected
      address: `${this.host}:${this.port}`,
      secure: this.secure,
    };
  }

  /**
   * Close the client
   */
  async close(): Promise<void> {
    logger.info('Closing Flyte Admin client');
    this.client.close();
  }
}

// Singleton instance (will be initialized by service initializer)
let flyteAdminClient: FlyteAdminClient | null = null;

/**
 * Get the Flyte Admin client instance
 */
export function getFlyteAdminClient(): FlyteAdminClient | null {
  return flyteAdminClient;
}

/**
 * Set the Flyte Admin client instance
 */
export function setFlyteAdminClient(client: FlyteAdminClient): void {
  flyteAdminClient = client;
}

/**
 * Initialize Flyte Admin client
 */
export async function initializeFlyteAdminClient(config: FlyteAdminConfig): Promise<void> {
  try {
    logger.info('Initializing Flyte Admin client', config);
    const client = new FlyteAdminClient(config);
    await client.initialize();
    setFlyteAdminClient(client);
    logger.info('Flyte Admin client initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize Flyte Admin client', error as Error);
    throw error;
  }
}
