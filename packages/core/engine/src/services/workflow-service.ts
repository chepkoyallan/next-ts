/**
 * Workflow Management Service
 * High-level workflow and execution management operations
 */

// import { flyteidl } from '@/dsl/gen/pb-js/flyteidl';
import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { CallOptions } from '../grpc/types';
import { AdminService } from './admin-service';

// Type aliases
type Workflow = flyteidl.admin.Workflow;
type Execution = flyteidl.admin.Execution;
type LaunchPlan = flyteidl.admin.LaunchPlan;
type Identifier = flyteidl.core.Identifier;
type ExecutionSpec = flyteidl.admin.ExecutionSpec;

/**
 * Workflow query options
 */
export interface WorkflowQueryOptions {
  project?: string;
  domain?: string;
  name?: string;
  version?: string;
  limit?: number;
  token?: string;
}

/**
 * Execution query options
 */
export interface ExecutionQueryOptions {
  project?: string;
  domain?: string;
  name?: string;
  limit?: number;
  token?: string;
  filters?: Record<string, string>;
}

/**
 * Simple execution creation options
 */
export interface CreateExecutionOptions {
  project: string;
  domain: string;
  name: string;
  launchPlanId?: Identifier;
  workflowId?: Identifier;
  inputs?: any;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * Execution status summary
 */
export interface ExecutionStatusSummary {
  total: number;
  running: number;
  succeeded: number;
  failed: number;
  aborted: number;
  byPhase: Record<string, number>;
}

export class WorkflowService extends AdminService {
  // ==================== WORKFLOW OPERATIONS ====================

  /**
   * Get workflow by components
   */
  async getWorkflowById(
    project: string,
    domain: string,
    name: string,
    version?: string,
    options?: CallOptions
  ): Promise<Workflow> {
    const request: flyteidl.admin.ObjectGetRequest = {
      id: WorkflowService.createWorkflowIdentifier(project, domain, name, version),
    } as flyteidl.admin.ObjectGetRequest;

    return this.getWorkflow(request, options);
  }

  /**
   * Query workflows
   */
  async queryWorkflows(
    queryOptions: WorkflowQueryOptions,
    callOptions?: CallOptions
  ): Promise<flyteidl.admin.WorkflowList> {
    const request: flyteidl.admin.ResourceListRequest = {
      id: {
        resourceType: flyteidl.core.ResourceType.WORKFLOW,
        project: queryOptions.project || '',
        domain: queryOptions.domain || '',
        name: queryOptions.name || '',
        version: queryOptions.version || '',
      } as Identifier,
      limit: queryOptions.limit || 50,
      token: queryOptions.token || '',
      filters: '',
    } as flyteidl.admin.ResourceListRequest;

    return this.listWorkflows(request, callOptions);
  }

  /**
   * Get all workflows for a project
   */
  async getProjectWorkflows(
    project: string,
    domain?: string,
    options?: CallOptions
  ): Promise<Workflow[]> {
    const result = await this.queryWorkflows(
      {
        project,
        domain,
        limit: 100,
      },
      options
    );

    return (result.workflows || []) as Workflow[];
  }

  // ==================== EXECUTION OPERATIONS ====================

  /**
   * Create execution with simplified options
   */
  async createExecutionSimple(
    options: CreateExecutionOptions,
    callOptions?: CallOptions
  ): Promise<flyteidl.admin.ExecutionCreateResponse> {
    const request: flyteidl.admin.ExecutionCreateRequest = {
      project: options.project,
      domain: options.domain,
      name: options.name,
      spec: {
        launchPlan: options.launchPlanId,
        workflowId: options.workflowId,
        inputs: options.inputs,
        metadata: {
          principal: 'api',
          nesting: 0,
        } as any,
        labels: {
          values: options.labels || {},
        } as any,
        annotations: {
          values: options.annotations || {},
        } as any,
        disableAll: false,
        maxParallelism: 0,
        overwriteCache: false,
      } as ExecutionSpec,
    } as flyteidl.admin.ExecutionCreateRequest;

    return this.createExecution(request, callOptions);
  }

  /**
   * Get execution by name
   */
  async getExecutionByName(
    project: string,
    domain: string,
    name: string,
    options?: CallOptions
  ): Promise<Execution> {
    const request: flyteidl.admin.WorkflowExecutionGetRequest = {
      id: {
        project,
        domain,
        name,
      } as any,
    } as flyteidl.admin.WorkflowExecutionGetRequest;

    return this.getExecution(request, options);
  }

  /**
   * Query executions
   */
  async queryExecutions(
    queryOptions: ExecutionQueryOptions,
    callOptions?: CallOptions
  ): Promise<flyteidl.admin.ExecutionList> {
    const request: flyteidl.admin.ResourceListRequest = {
      id: {
        project: queryOptions.project || '',
        domain: queryOptions.domain || '',
        name: queryOptions.name || '',
      } as flyteidl.admin.INamedEntityIdentifier,
      limit: queryOptions.limit || 50,
      token: queryOptions.token || '',
      filters: queryOptions.filters
        ? Object.entries(queryOptions.filters)
            .map(([k, v]) => `${k}=${v}`)
            .join(',')
        : '',
    } as flyteidl.admin.ResourceListRequest;

    return this.listExecutions(request, callOptions);
  }

  /**
   * Get execution status summary
   */
  async getExecutionStatusSummary(
    project: string,
    domain?: string,
    options?: CallOptions
  ): Promise<ExecutionStatusSummary> {
    const result = await this.queryExecutions(
      {
        project,
        domain,
        limit: 1000,
      },
      options
    );

    const executions = (result.executions || []) as Execution[];

    const summary: ExecutionStatusSummary = {
      total: executions.length,
      running: 0,
      succeeded: 0,
      failed: 0,
      aborted: 0,
      byPhase: {},
    };

    executions.forEach((exec) => {
      const phase = (exec.closure as any)?.phase || 'UNDEFINED';
      summary.byPhase[phase] = (summary.byPhase[phase] || 0) + 1;

      // Aggregate common statuses
      if (phase === 'RUNNING') summary.running += 1;
      else if (phase === 'SUCCEEDED') summary.succeeded += 1;
      else if (phase === 'FAILED') summary.failed += 1;
      else if (phase === 'ABORTED') summary.aborted += 1;
    });

    return summary;
  }

  /**
   * Terminate an execution
   */
  async terminateExecutionByName(
    project: string,
    domain: string,
    name: string,
    reason: string,
    options?: CallOptions
  ): Promise<void> {
    const request: flyteidl.admin.ExecutionTerminateRequest = {
      id: {
        project,
        domain,
        name,
      } as any,
      cause: reason,
    } as flyteidl.admin.ExecutionTerminateRequest;

    await this.terminateExecution(request, options);
  }

  /**
   * Get execution inputs and outputs
   */
  async getExecutionIO(
    project: string,
    domain: string,
    name: string,
    options?: CallOptions
  ): Promise<flyteidl.admin.WorkflowExecutionGetDataResponse> {
    const request: flyteidl.admin.WorkflowExecutionGetDataRequest = {
      id: {
        project,
        domain,
        name,
      } as any,
    } as flyteidl.admin.WorkflowExecutionGetDataRequest;

    return this.getExecutionData(request, options);
  }

  /**
   * Get node executions for a workflow execution
   */
  async getNodeExecutions(
    project: string,
    domain: string,
    name: string,
    options?: CallOptions
  ): Promise<flyteidl.admin.NodeExecutionList> {
    const request: flyteidl.admin.NodeExecutionListRequest = {
      workflowExecutionId: {
        project,
        domain,
        name,
      } as any,
      limit: 100,
      token: '',
      filters: '',
    } as flyteidl.admin.NodeExecutionListRequest;

    return this.listNodeExecutions(request, options);
  }

  // ==================== LAUNCH PLAN OPERATIONS ====================

  /**
   * Get launch plan by components
   */
  async getLaunchPlanById(
    project: string,
    domain: string,
    name: string,
    version?: string,
    options?: CallOptions
  ): Promise<LaunchPlan> {
    const request: flyteidl.admin.ObjectGetRequest = {
      id: WorkflowService.createLaunchPlanIdentifier(project, domain, name, version),
    } as flyteidl.admin.ObjectGetRequest;

    return this.getLaunchPlan(request, options);
  }

  /**
   * List launch plans for a workflow
   */
  async getWorkflowLaunchPlans(
    project: string,
    domain: string,
    workflowName: string,
    options?: CallOptions
  ): Promise<LaunchPlan[]> {
    const request: flyteidl.admin.ResourceListRequest = {
      id: {
        resourceType: flyteidl.core.ResourceType.LAUNCH_PLAN,
        project,
        domain,
        name: workflowName,
      } as Identifier,
      limit: 100,
      token: '',
      filters: '',
    } as flyteidl.admin.ResourceListRequest;

    const result = await this.listLaunchPlans(request, options);
    return (result.launchPlans || []) as LaunchPlan[];
  }

  // ==================== HELPER METHODS ====================

  private static createWorkflowIdentifier(
    project: string,
    domain: string,
    name: string,
    version?: string
  ): Identifier {
    return {
      resourceType: flyteidl.core.ResourceType.WORKFLOW,
      project,
      domain,
      name,
      version: version || '',
    } as Identifier;
  }

  private static createLaunchPlanIdentifier(
    project: string,
    domain: string,
    name: string,
    version?: string
  ): Identifier {
    return {
      resourceType: flyteidl.core.ResourceType.LAUNCH_PLAN,
      project,
      domain,
      name,
      version: version || '',
    } as Identifier;
  }
}
