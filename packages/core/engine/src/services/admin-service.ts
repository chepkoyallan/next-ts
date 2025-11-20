/**
 * Flyte Admin Service
 * Type-safe gRPC client for Flyte Admin API
 */

import * as grpc from '@grpc/grpc-js';

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { EngineGrpcClient } from '../grpc/client';
import { CallOptions, EngineGrpcError } from '../grpc/types';

// Type aliases for cleaner code
type Task = flyteidl.admin.Task;
type TaskCreateRequest = flyteidl.admin.TaskCreateRequest;
type TaskCreateResponse = flyteidl.admin.TaskCreateResponse;
type TaskList = flyteidl.admin.TaskList;
type Workflow = flyteidl.admin.Workflow;
type WorkflowCreateRequest = flyteidl.admin.WorkflowCreateRequest;
type WorkflowList = flyteidl.admin.WorkflowList;
type Execution = flyteidl.admin.Execution;
type ExecutionCreateRequest = flyteidl.admin.ExecutionCreateRequest;
type ExecutionCreateResponse = flyteidl.admin.ExecutionCreateResponse;
type LaunchPlan = flyteidl.admin.LaunchPlan;
type LaunchPlanCreateRequest = flyteidl.admin.LaunchPlanCreateRequest;
type ObjectGetRequest = flyteidl.admin.ObjectGetRequest;
type ResourceListRequest = flyteidl.admin.ResourceListRequest;
type Identifier = flyteidl.core.Identifier;

export class AdminService extends EngineGrpcClient {
  /**
   * Create the gRPC service client using makeGenericClientConstructor
   * This avoids needing to load proto files with missing google/api dependencies
   */
  protected async createServiceClient(): Promise<any> {
    // Serialization helper that uses protobuf encoding
    const createSerializer = (MessageType: any) => (obj: any) => {
      if (Buffer.isBuffer(obj)) return obj;

      try {
        // Log what we're about to serialize for CreateWorkflow
        if (MessageType.name === 'WorkflowCreateRequest' || obj.spec) {
          // console.log('[AdminService] ===== SERIALIZING WORKFLOW CREATE REQUEST =====');
          // console.log('[AdminService] MessageType:', MessageType.name);
          // console.log('[AdminService] Has ID:', !!obj.id);
          // console.log('[AdminService] Has spec:', !!obj.spec);
          // console.log('[AdminService] Spec has template:', !!obj.spec?.template);
          // console.log('[AdminService] Template has nodes:', !!obj.spec?.template?.nodes);
          // console.log('[AdminService] Nodes count:', obj.spec?.template?.nodes?.length || 0);
          // console.log('[AdminService] Request structure:', JSON.stringify(obj, null, 2));
        }

        // Verify and encode the message
        const errMsg = MessageType.verify(obj);
        if (errMsg) {
          // console.error('[AdminService] ❌ Protobuf verification failed:', errMsg);
          // console.error('[AdminService] Failed object structure:', JSON.stringify(obj, null, 2));
          throw new Error(`Protobuf verification failed: ${errMsg}`);
        }

        // console.log('[AdminService] ✅ Protobuf verification passed');

        // Encode to protobuf wire format
        const message = MessageType.create(obj);
        const encoded = Buffer.from(MessageType.encode(message).finish());

        // console.log('[AdminService] ✅ Encoded to protobuf, size:', encoded.length, 'bytes');
        // console.log('[AdminService] First 50 bytes (hex):', encoded.slice(0, 50).toString('hex'));

        return encoded;
      } catch (error) {
        // console.error('[AdminService] Serialization error:', error);
        // console.error('[AdminService] Failed to serialize:', JSON.stringify(obj, null, 2));
        throw new Error(
          `Serialization error: ${error instanceof Error ? error.message : 'Unknown'}`
        );
      }
    };

    const createDeserializer = (MessageType: any) => (buffer: Buffer) => {
      if (!Buffer.isBuffer(buffer)) return buffer;

      try {
        console.log(
          '[AdminService] Deserializing response, MessageType:',
          MessageType?.name || 'unknown',
          'buffer size:',
          buffer.length
        );

        // Handle empty responses (like WorkflowCreateResponse which is an empty message)
        if (buffer.length === 0) {
          // console.log('[AdminService] ✅ Empty response (success)');
          return MessageType.create({});
        }

        // Decode from protobuf wire format
        const decoded = MessageType.decode(buffer);
        // console.log('[AdminService] ✅ Deserialized successfully');
        return decoded;
      } catch (error) {
        // console.error('[AdminService] Deserialization error:', error);
        // console.error('[AdminService] Buffer size:', buffer.length);
        // console.error('[AdminService] Message type:', MessageType?.name);
        // console.error('[AdminService] Buffer hex:', buffer.toString('hex'));
        throw new Error(
          `Deserialization error: ${error instanceof Error ? error.message : 'Unknown'}`
        );
      }
    };

    // Define the service methods we support
    const serviceMethods = {
      // Tasks
      CreateTask: {
        path: '/flyteidl.service.AdminService/CreateTask',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.TaskCreateRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.TaskCreateResponse),
      },
      GetTask: {
        path: '/flyteidl.service.AdminService/GetTask',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ObjectGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.Task),
      },
      ListTasks: {
        path: '/flyteidl.service.AdminService/ListTasks',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ResourceListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.TaskList),
      },
      ListTaskIds: {
        path: '/flyteidl.service.AdminService/ListTaskIds',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.NamedEntityIdentifierListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.NamedEntityIdentifierList),
      },
      // Workflows
      CreateWorkflow: {
        path: '/flyteidl.service.AdminService/CreateWorkflow',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.WorkflowCreateRequest),
        // WorkflowCreateResponse is an empty message (interface IWorkflowCreateResponse {})
        responseDeserialize: createDeserializer(flyteidl.admin.WorkflowCreateResponse),
      },
      GetWorkflow: {
        path: '/flyteidl.service.AdminService/GetWorkflow',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ObjectGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.Workflow),
      },
      ListWorkflows: {
        path: '/flyteidl.service.AdminService/ListWorkflows',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ResourceListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.WorkflowList),
      },
      // Executions
      CreateExecution: {
        path: '/flyteidl.service.AdminService/CreateExecution',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ExecutionCreateRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ExecutionCreateResponse),
      },
      GetExecution: {
        path: '/flyteidl.service.AdminService/GetExecution',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.WorkflowExecutionGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.Execution),
      },
      ListExecutions: {
        path: '/flyteidl.service.AdminService/ListExecutions',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ResourceListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ExecutionList),
      },
      TerminateExecution: {
        path: '/flyteidl.service.AdminService/TerminateExecution',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ExecutionTerminateRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ExecutionTerminateResponse),
      },
      RecoverExecution: {
        path: '/flyteidl.service.AdminService/RecoverExecution',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ExecutionRecoverRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ExecutionCreateResponse),
      },
      GetExecutionData: {
        path: '/flyteidl.service.AdminService/GetExecutionData',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.WorkflowExecutionGetDataRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.WorkflowExecutionGetDataResponse),
      },
      // Launch Plans
      CreateLaunchPlan: {
        path: '/flyteidl.service.AdminService/CreateLaunchPlan',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.LaunchPlanCreateRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.LaunchPlanCreateResponse),
      },
      GetLaunchPlan: {
        path: '/flyteidl.service.AdminService/GetLaunchPlan',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ObjectGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.LaunchPlan),
      },
      ListLaunchPlans: {
        path: '/flyteidl.service.AdminService/ListLaunchPlans',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ResourceListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.LaunchPlanList),
      },
      UpdateLaunchPlan: {
        path: '/flyteidl.service.AdminService/UpdateLaunchPlan',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.LaunchPlanUpdateRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.LaunchPlanUpdateResponse),
      },
      // Projects
      RegisterProject: {
        path: '/flyteidl.service.AdminService/RegisterProject',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ProjectRegisterRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ProjectRegisterResponse),
      },
      ListProjects: {
        path: '/flyteidl.service.AdminService/ListProjects',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ProjectListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.Projects),
      },
      UpdateProject: {
        path: '/flyteidl.service.AdminService/UpdateProject',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.Project),
        responseDeserialize: createDeserializer(flyteidl.admin.ProjectUpdateResponse),
      },
      // Node Executions
      GetNodeExecution: {
        path: '/flyteidl.service.AdminService/GetNodeExecution',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.NodeExecutionGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.NodeExecution),
      },
      ListNodeExecutions: {
        path: '/flyteidl.service.AdminService/ListNodeExecutions',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.NodeExecutionListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.NodeExecutionList),
      },
      ListNodeExecutionsForTask: {
        path: '/flyteidl.service.AdminService/ListNodeExecutionsForTask',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.NodeExecutionForTaskListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.NodeExecutionList),
      },
      GetNodeExecutionData: {
        path: '/flyteidl.service.AdminService/GetNodeExecutionData',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.NodeExecutionGetDataRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.NodeExecutionGetDataResponse),
      },
      // Task Executions
      GetTaskExecution: {
        path: '/flyteidl.service.AdminService/GetTaskExecution',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.TaskExecutionGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.TaskExecution),
      },
      ListTaskExecutions: {
        path: '/flyteidl.service.AdminService/ListTaskExecutions',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.TaskExecutionListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.TaskExecutionList),
      },
      GetTaskExecutionData: {
        path: '/flyteidl.service.AdminService/GetTaskExecutionData',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.TaskExecutionGetDataRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.TaskExecutionGetDataResponse),
      },
      // Events
      CreateNodeEvent: {
        path: '/flyteidl.service.AdminService/CreateNodeEvent',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.NodeExecutionEventRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.NodeExecutionEventResponse),
      },
      CreateTaskEvent: {
        path: '/flyteidl.service.AdminService/CreateTaskEvent',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.TaskExecutionEventRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.TaskExecutionEventResponse),
      },
      CreateWorkflowEvent: {
        path: '/flyteidl.service.AdminService/CreateWorkflowEvent',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.WorkflowExecutionEventRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.WorkflowExecutionEventResponse),
      },
      // Execution operations
      UpdateExecution: {
        path: '/flyteidl.service.AdminService/UpdateExecution',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ExecutionUpdateRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ExecutionUpdateResponse),
      },
      RelaunchExecution: {
        path: '/flyteidl.service.AdminService/RelaunchExecution',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ExecutionRelaunchRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ExecutionCreateResponse),
      },
      GetExecutionMetrics: {
        path: '/flyteidl.service.AdminService/GetExecutionMetrics',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.WorkflowExecutionGetMetricsRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.WorkflowExecutionGetMetricsResponse),
      },
      // Launch Plan operations
      GetActiveLaunchPlan: {
        path: '/flyteidl.service.AdminService/GetActiveLaunchPlan',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ActiveLaunchPlanRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.LaunchPlan),
      },
      ListActiveLaunchPlans: {
        path: '/flyteidl.service.AdminService/ListActiveLaunchPlans',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ActiveLaunchPlanListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.LaunchPlanList),
      },
      // Named Entities
      UpdateNamedEntity: {
        path: '/flyteidl.service.AdminService/UpdateNamedEntity',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.NamedEntityUpdateRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.NamedEntityUpdateResponse),
      },
      GetNamedEntity: {
        path: '/flyteidl.service.AdminService/GetNamedEntity',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.NamedEntityGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.NamedEntity),
      },
      ListNamedEntities: {
        path: '/flyteidl.service.AdminService/ListNamedEntities',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.NamedEntityListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.NamedEntityList),
      },
      // Description Entities
      GetDescriptionEntity: {
        path: '/flyteidl.service.AdminService/GetDescriptionEntity',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ObjectGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.DescriptionEntity),
      },
      ListDescriptionEntities: {
        path: '/flyteidl.service.AdminService/ListDescriptionEntities',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.DescriptionEntityListRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.DescriptionEntityList),
      },
      // Attributes
      GetProjectAttributes: {
        path: '/flyteidl.service.AdminService/GetProjectAttributes',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ProjectAttributesGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ProjectAttributesGetResponse),
      },
      UpdateProjectAttributes: {
        path: '/flyteidl.service.AdminService/UpdateProjectAttributes',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ProjectAttributesUpdateRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ProjectAttributesUpdateResponse),
      },
      DeleteProjectAttributes: {
        path: '/flyteidl.service.AdminService/DeleteProjectAttributes',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ProjectAttributesDeleteRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ProjectAttributesDeleteResponse),
      },
      GetProjectDomainAttributes: {
        path: '/flyteidl.service.AdminService/GetProjectDomainAttributes',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ProjectDomainAttributesGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ProjectDomainAttributesGetResponse),
      },
      UpdateProjectDomainAttributes: {
        path: '/flyteidl.service.AdminService/UpdateProjectDomainAttributes',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ProjectDomainAttributesUpdateRequest),
        responseDeserialize: createDeserializer(
          flyteidl.admin.ProjectDomainAttributesUpdateResponse
        ),
      },
      DeleteProjectDomainAttributes: {
        path: '/flyteidl.service.AdminService/DeleteProjectDomainAttributes',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ProjectDomainAttributesDeleteRequest),
        responseDeserialize: createDeserializer(
          flyteidl.admin.ProjectDomainAttributesDeleteResponse
        ),
      },
      GetWorkflowAttributes: {
        path: '/flyteidl.service.AdminService/GetWorkflowAttributes',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.WorkflowAttributesGetRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.WorkflowAttributesGetResponse),
      },
      UpdateWorkflowAttributes: {
        path: '/flyteidl.service.AdminService/UpdateWorkflowAttributes',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.WorkflowAttributesUpdateRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.WorkflowAttributesUpdateResponse),
      },
      DeleteWorkflowAttributes: {
        path: '/flyteidl.service.AdminService/DeleteWorkflowAttributes',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.WorkflowAttributesDeleteRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.WorkflowAttributesDeleteResponse),
      },
      ListMatchableAttributes: {
        path: '/flyteidl.service.AdminService/ListMatchableAttributes',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.ListMatchableAttributesRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.ListMatchableAttributesResponse),
      },
      // Version
      GetVersion: {
        path: '/flyteidl.service.AdminService/GetVersion',
        requestStream: false,
        responseStream: false,
        requestSerialize: createSerializer(flyteidl.admin.GetVersionRequest),
        responseDeserialize: createDeserializer(flyteidl.admin.GetVersionResponse),
      },
    };

    const GenericClient = grpc.makeGenericClientConstructor(
      serviceMethods as any,
      'AdminService',
      {}
    );
    return new GenericClient(
      `${this.config.host}:${this.config.port}`,
      this.credentials,
      this.config.channelOptions || {}
    );
  }

  // ==================== TASK MANAGEMENT ====================

  /**
   * Create a new task
   */
  async createTask(request: TaskCreateRequest, options?: CallOptions): Promise<TaskCreateResponse> {
    return this.call<TaskCreateRequest, TaskCreateResponse>('CreateTask', request, options);
  }

  /**
   * Get a specific task
   */
  async getTask(request: ObjectGetRequest, options?: CallOptions): Promise<Task> {
    return this.call<ObjectGetRequest, Task>('GetTask', request, options);
  }

  /**
   * List tasks with pagination
   */
  async listTasks(request: ResourceListRequest, options?: CallOptions): Promise<TaskList> {
    return this.call<ResourceListRequest, TaskList>('ListTasks', request, options);
  }

  /**
   * List task identifiers
   */
  async listTaskIds(
    request: flyteidl.admin.NamedEntityIdentifierListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.NamedEntityIdentifierList> {
    return this.call('ListTaskIds', request, options);
  }

  // ==================== WORKFLOW MANAGEMENT ====================

  /**
   * Create a new workflow
   * Note: Flyte Admin returns WorkflowCreateResponse which is an empty message
   */
  async createWorkflow(
    request: WorkflowCreateRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.WorkflowCreateResponse> {
    return this.call<WorkflowCreateRequest, flyteidl.admin.WorkflowCreateResponse>(
      'CreateWorkflow',
      request,
      options
    );
  }

  /**
   * Get a specific workflow
   */
  async getWorkflow(request: ObjectGetRequest, options?: CallOptions): Promise<Workflow> {
    return this.call<ObjectGetRequest, Workflow>('GetWorkflow', request, options);
  }

  /**
   * List workflows with pagination
   */
  async listWorkflows(request: ResourceListRequest, options?: CallOptions): Promise<WorkflowList> {
    return this.call<ResourceListRequest, WorkflowList>('ListWorkflows', request, options);
  }

  // ==================== EXECUTION MANAGEMENT ====================

  /**
   * Create a new execution
   */
  async createExecution(
    request: ExecutionCreateRequest,
    options?: CallOptions
  ): Promise<ExecutionCreateResponse> {
    return this.call<ExecutionCreateRequest, ExecutionCreateResponse>(
      'CreateExecution',
      request,
      options
    );
  }

  /**
   * Get execution details
   */
  async getExecution(
    request: flyteidl.admin.WorkflowExecutionGetRequest,
    options?: CallOptions
  ): Promise<Execution> {
    return this.call('GetExecution', request, options);
  }

  /**
   * List executions
   */
  async listExecutions(
    request: ResourceListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ExecutionList> {
    return this.call('ListExecutions', request, options);
  }

  /**
   * Terminate an execution
   */
  async terminateExecution(
    request: flyteidl.admin.ExecutionTerminateRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ExecutionTerminateResponse> {
    return this.call('TerminateExecution', request, options);
  }

  /**
   * Recover an execution
   */
  async recoverExecution(
    request: flyteidl.admin.ExecutionRecoverRequest,
    options?: CallOptions
  ): Promise<ExecutionCreateResponse> {
    return this.call('RecoverExecution', request, options);
  }

  /**
   * Get execution data (inputs/outputs)
   */
  async getExecutionData(
    request: flyteidl.admin.WorkflowExecutionGetDataRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.WorkflowExecutionGetDataResponse> {
    return this.call('GetExecutionData', request, options);
  }

  // ==================== LAUNCH PLAN MANAGEMENT ====================

  /**
   * Create a launch plan
   */
  async createLaunchPlan(
    request: LaunchPlanCreateRequest,
    options?: CallOptions
  ): Promise<LaunchPlan> {
    return this.call<LaunchPlanCreateRequest, LaunchPlan>('CreateLaunchPlan', request, options);
  }

  /**
   * Get a launch plan
   */
  async getLaunchPlan(request: ObjectGetRequest, options?: CallOptions): Promise<LaunchPlan> {
    return this.call<ObjectGetRequest, LaunchPlan>('GetLaunchPlan', request, options);
  }

  /**
   * List launch plans
   */
  async listLaunchPlans(
    request: ResourceListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.LaunchPlanList> {
    return this.call('ListLaunchPlans', request, options);
  }

  /**
   * Update launch plan
   */
  async updateLaunchPlan(
    request: flyteidl.admin.LaunchPlanUpdateRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.LaunchPlanUpdateResponse> {
    return this.call('UpdateLaunchPlan', request, options);
  }

  // ==================== PROJECT MANAGEMENT ====================

  /**
   * Register a project
   */
  async registerProject(
    request: flyteidl.admin.ProjectRegisterRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ProjectRegisterResponse> {
    return this.call('RegisterProject', request, options);
  }

  /**
   * List projects
   */
  async listProjects(
    request: flyteidl.admin.ProjectListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.Projects> {
    return this.call('ListProjects', request, options);
  }

  /**
   * Update project
   */
  async updateProject(
    request: flyteidl.admin.Project,
    options?: CallOptions
  ): Promise<flyteidl.admin.ProjectUpdateResponse> {
    return this.call('UpdateProject', request, options);
  }

  // ==================== NODE EXECUTION ====================

  /**
   * Get node execution
   */
  async getNodeExecution(
    request: flyteidl.admin.NodeExecutionGetRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.NodeExecution> {
    return this.call('GetNodeExecution', request, options);
  }

  /**
   * List node executions
   */
  async listNodeExecutions(
    request: flyteidl.admin.NodeExecutionListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.NodeExecutionList> {
    return this.call('ListNodeExecutions', request, options);
  }

  // ==================== TASK EXECUTION ====================

  /**
   * Get task execution
   */
  async getTaskExecution(
    request: flyteidl.admin.TaskExecutionGetRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.TaskExecution> {
    return this.call('GetTaskExecution', request, options);
  }

  /**
   * List task executions
   */
  async listTaskExecutions(
    request: flyteidl.admin.TaskExecutionListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.TaskExecutionList> {
    return this.call('ListTaskExecutions', request, options);
  }

  /**
   * Get task execution data
   */
  async getTaskExecutionData(
    request: flyteidl.admin.TaskExecutionGetDataRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.TaskExecutionGetDataResponse> {
    return this.call('GetTaskExecutionData', request, options);
  }

  // ==================== NAMED ENTITY MANAGEMENT ====================

  /**
   * Get named entity metadata
   */
  async getNamedEntity(
    request: flyteidl.admin.NamedEntityGetRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.NamedEntity> {
    return this.call('GetNamedEntity', request, options);
  }

  /**
   * List named entities
   */
  async listNamedEntities(
    request: flyteidl.admin.NamedEntityListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.NamedEntityList> {
    return this.call('ListNamedEntities', request, options);
  }

  /**
   * Update named entity metadata
   */
  async updateNamedEntity(
    request: flyteidl.admin.NamedEntityUpdateRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.NamedEntityUpdateResponse> {
    return this.call('UpdateNamedEntity', request, options);
  }

  // ==================== DESCRIPTION ENTITIES ====================

  /**
   * Get description entity
   */
  async getDescriptionEntity(
    request: flyteidl.admin.ObjectGetRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.DescriptionEntity> {
    return this.call('GetDescriptionEntity', request, options);
  }

  /**
   * List description entities
   */
  async listDescriptionEntities(
    request: flyteidl.admin.DescriptionEntityListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.DescriptionEntityList> {
    return this.call('ListDescriptionEntities', request, options);
  }

  // ==================== ACTIVE LAUNCH PLANS ====================

  /**
   * Get active launch plan
   */
  async getActiveLaunchPlan(
    request: flyteidl.admin.ActiveLaunchPlanRequest,
    options?: CallOptions
  ): Promise<LaunchPlan> {
    return this.call('GetActiveLaunchPlan', request, options);
  }

  /**
   * List active launch plans
   */
  async listActiveLaunchPlans(
    request: flyteidl.admin.ActiveLaunchPlanListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.LaunchPlanList> {
    return this.call('ListActiveLaunchPlans', request, options);
  }

  // ==================== EXECUTION ADVANCED ====================

  /**
   * Update execution metadata
   */
  async updateExecution(
    request: flyteidl.admin.ExecutionUpdateRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ExecutionUpdateResponse> {
    return this.call('UpdateExecution', request, options);
  }

  /**
   * Relaunch an execution
   */
  async relaunchExecution(
    request: flyteidl.admin.ExecutionRelaunchRequest,
    options?: CallOptions
  ): Promise<ExecutionCreateResponse> {
    return this.call('RelaunchExecution', request, options);
  }

  /**
   * Get execution metrics
   */
  async getExecutionMetrics(
    request: flyteidl.admin.WorkflowExecutionGetMetricsRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.WorkflowExecutionGetMetricsResponse> {
    return this.call('GetExecutionMetrics', request, options);
  }

  /**
   * Get node execution data
   */
  async getNodeExecutionData(
    request: flyteidl.admin.NodeExecutionGetDataRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.NodeExecutionGetDataResponse> {
    return this.call('GetNodeExecutionData', request, options);
  }

  /**
   * List node executions for a specific task
   */
  async listNodeExecutionsForTask(
    request: flyteidl.admin.NodeExecutionForTaskListRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.NodeExecutionList> {
    return this.call('ListNodeExecutionsForTask', request, options);
  }

  // ==================== ATTRIBUTES & MATCHABLE RESOURCES ====================

  /**
   * Get project attributes
   */
  async getProjectAttributes(
    request: flyteidl.admin.ProjectAttributesGetRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ProjectAttributesGetResponse> {
    return this.call('GetProjectAttributes', request, options);
  }

  /**
   * Update project attributes
   */
  async updateProjectAttributes(
    request: flyteidl.admin.ProjectAttributesUpdateRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ProjectAttributesUpdateResponse> {
    return this.call('UpdateProjectAttributes', request, options);
  }

  /**
   * Delete project attributes
   */
  async deleteProjectAttributes(
    request: flyteidl.admin.ProjectAttributesDeleteRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ProjectAttributesDeleteResponse> {
    return this.call('DeleteProjectAttributes', request, options);
  }

  /**
   * Get project domain attributes
   */
  async getProjectDomainAttributes(
    request: flyteidl.admin.ProjectDomainAttributesGetRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ProjectDomainAttributesGetResponse> {
    return this.call('GetProjectDomainAttributes', request, options);
  }

  /**
   * Update project domain attributes
   */
  async updateProjectDomainAttributes(
    request: flyteidl.admin.ProjectDomainAttributesUpdateRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ProjectDomainAttributesUpdateResponse> {
    return this.call('UpdateProjectDomainAttributes', request, options);
  }

  /**
   * Delete project domain attributes
   */
  async deleteProjectDomainAttributes(
    request: flyteidl.admin.ProjectDomainAttributesDeleteRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ProjectDomainAttributesDeleteResponse> {
    return this.call('DeleteProjectDomainAttributes', request, options);
  }

  /**
   * Get workflow attributes
   */
  async getWorkflowAttributes(
    request: flyteidl.admin.WorkflowAttributesGetRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.WorkflowAttributesGetResponse> {
    return this.call('GetWorkflowAttributes', request, options);
  }

  /**
   * Update workflow attributes
   */
  async updateWorkflowAttributes(
    request: flyteidl.admin.WorkflowAttributesUpdateRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.WorkflowAttributesUpdateResponse> {
    return this.call('UpdateWorkflowAttributes', request, options);
  }

  /**
   * Delete workflow attributes
   */
  async deleteWorkflowAttributes(
    request: flyteidl.admin.WorkflowAttributesDeleteRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.WorkflowAttributesDeleteResponse> {
    return this.call('DeleteWorkflowAttributes', request, options);
  }

  /**
   * List matchable attributes
   */
  async listMatchableAttributes(
    request: flyteidl.admin.ListMatchableAttributesRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.ListMatchableAttributesResponse> {
    return this.call('ListMatchableAttributes', request, options);
  }

  // ==================== EVENT CREATION ====================

  /**
   * Create node event
   */
  async createNodeEvent(
    request: flyteidl.admin.NodeExecutionEventRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.NodeExecutionEventResponse> {
    return this.call('CreateNodeEvent', request, options);
  }

  /**
   * Create task event
   */
  async createTaskEvent(
    request: flyteidl.admin.TaskExecutionEventRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.TaskExecutionEventResponse> {
    return this.call('CreateTaskEvent', request, options);
  }

  /**
   * Create workflow event
   */
  async createWorkflowEvent(
    request: flyteidl.admin.WorkflowExecutionEventRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.WorkflowExecutionEventResponse> {
    return this.call('CreateWorkflowEvent', request, options);
  }

  // ==================== VERSION INFO ====================

  /**
   * Get service version information
   */
  async getVersion(
    request: flyteidl.admin.GetVersionRequest,
    options?: CallOptions
  ): Promise<flyteidl.admin.GetVersionResponse> {
    return this.call('GetVersion', request, options);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Create an identifier
   */
  static createIdentifier(
    project: string,
    domain: string,
    name: string,
    version?: string
  ): Identifier {
    return {
      project,
      domain,
      name,
      version: version || '',
      resourceType: flyteidl.core.ResourceType.UNSPECIFIED,
    } as Identifier;
  }

  /**
   * Public method to make gRPC calls (alias for makeCall)
   */
  protected async call<TReq, TRes>(
    method: string,
    request: TReq,
    options?: CallOptions
  ): Promise<TRes> {
    return this.makeCall<TReq, TRes>(method, request, options);
  }

  /**
   * Internal method to make gRPC calls
   */
  private async makeCall<TReq, TRes>(
    method: string,
    request: TReq,
    options?: CallOptions
  ): Promise<TRes> {
    if (!this.initialized) {
      throw new EngineGrpcError('Client not initialized', grpc.status.FAILED_PRECONDITION);
    }

    if (!this.client) {
      throw new EngineGrpcError('Admin client not available', grpc.status.FAILED_PRECONDITION);
    }

    const metadata = this.createMetadata(options);
    const deadline = this.createDeadline(options);

    return new Promise<TRes>((resolve, reject) => {
      // This would use the actual gRPC client method
      // For now, this is a structure placeholder
      const callMethod = (this.client as any)[method];

      if (!callMethod) {
        reject(new EngineGrpcError(`Method ${method} not found`, grpc.status.UNIMPLEMENTED));
        return;
      }

      // console.log(`[AdminService] ===== GRPC CALL DETAILS =====`);
      // console.log(`[AdminService] Method: ${method}`);
      // console.log(`[AdminService] Request keys:`, Object.keys(request || {}));
      // console.log(`[AdminService] Client initialized:`, this.initialized);
      // console.log(`[AdminService] Client exists:`, !!this.client);
      // console.log(`[AdminService] Connection status:`, this.status);
      // console.log(`[AdminService] Health status:`, this.healthStatus);
      // console.log(`[AdminService] Channel state:`, this.channel?.getConnectivityState(false));

      // Wrap the call to catch any synchronous errors
      try {
        // console.log(`[AdminService] About to invoke gRPC method: ${method}`);
        callMethod.call(
          this.client,
          request,
          metadata,
          { deadline },
          (error: grpc.ServiceError | null, response: TRes) => {
            if (error) {
              // console.error(`[AdminService] ===== GRPC ERROR RECEIVED =====`);
              // console.error(`[AdminService] Method: ${method}`);
              // console.error(`[AdminService] Error code:`, error.code);
              // console.error(`[AdminService] Error message:`, error.message);
              // console.error(`[AdminService] Error details:`, error.details);
              // console.error(`[AdminService] Error metadata:`, error.metadata);
              // console.error(
              //   `[AdminService] Error metadata keys:`,
              //   error.metadata ? Object.keys(error.metadata.getMap()) : []
              // );

              // Try to extract any trailing metadata
              if (error.metadata) {
                const metadataMap = error.metadata.getMap();
                // console.error(`[AdminService] Metadata map:`, metadataMap);

                // Check for grpc-status-details-bin which contains the detailed error
                const detailsBin = error.metadata.get('grpc-status-details-bin');
                if (detailsBin && detailsBin.length > 0) {
                  // console.error(`[AdminService] Binary error details found:`, detailsBin);
                }
              }

              // console.error(
              //   `[AdminService] Full error:`,
              //   JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
              // );
              reject(new EngineGrpcError(error.message, error.code, error.details, error.metadata));
            } else {
              // console.log(`[AdminService] ===== GRPC SUCCESS =====`);
              // console.log(`[AdminService] Response type:`, typeof response);
              // console.log(`[AdminService] Response keys:`, Object.keys(response || {}));
              resolve(response);
            }
          }
        );
      } catch (syncError) {
        // console.error(`[AdminService] ===== SYNCHRONOUS ERROR =====`);
        // console.error(`[AdminService] Sync error:`, syncError);
        reject(syncError);
      }
    });
  }
}
