/**
 * Task Management Service
 * High-level task management operations with convenient methods
 */

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';

import { CallOptions } from '../grpc/types';
import { AdminService } from './admin-service';

// Type aliases
type Task = flyteidl.admin.Task;
type TaskTemplate = flyteidl.core.TaskTemplate;
type Identifier = flyteidl.core.Identifier;

/**
 * Task query options
 */
export interface TaskQueryOptions {
  project?: string;
  domain?: string;
  name?: string;
  version?: string;
  limit?: number;
  token?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, string>;
}

/**
 * Simple task creation options
 */
export interface CreateTaskOptions {
  project: string;
  domain: string;
  name: string;
  version?: string;
  template: TaskTemplate;
  description?: string;
}

/**
 * Task statistics
 */
export interface TaskStatistics {
  totalTasks: number;
  tasksByProject: Record<string, number>;
  tasksByDomain: Record<string, number>;
  recentTasks: Task[];
}

export class TaskService extends AdminService {
  /**
   * Create a task with simplified options
   */
  async createTaskSimple(options: CreateTaskOptions, callOptions?: CallOptions): Promise<Task> {
    const request: flyteidl.admin.TaskCreateRequest = {
      id: TaskService.createTaskIdentifier(
        options.project,
        options.domain,
        options.name,
        options.version
      ),
      spec: {
        template: options.template,
        description: {
          shortDescription: options.description || '',
          longDescription: '',
          sourceCode: {
            link: '',
          },
        } as any,
      },
    } as flyteidl.admin.TaskCreateRequest;

    await this.createTask(request, callOptions);

    // TaskCreateResponse is empty, so fetch the created task
    return this.getTaskById(
      options.project,
      options.domain,
      options.name,
      options.version,
      callOptions
    );
  }

  /**
   * Get task by components
   */
  async getTaskById(
    project: string,
    domain: string,
    name: string,
    version?: string,
    options?: CallOptions
  ): Promise<Task> {
    const request: flyteidl.admin.ObjectGetRequest = {
      id: TaskService.createTaskIdentifier(project, domain, name, version),
    } as flyteidl.admin.ObjectGetRequest;

    return this.getTask(request, options);
  }

  /**
   * Query tasks with convenient options
   */
  async queryTasks(
    queryOptions: TaskQueryOptions,
    callOptions?: CallOptions
  ): Promise<flyteidl.admin.TaskList> {
    const request: flyteidl.admin.ResourceListRequest = {
      id: {
        resourceType: flyteidl.core.ResourceType.TASK,
        project: queryOptions.project || '',
        domain: queryOptions.domain || '',
        name: queryOptions.name || '',
        version: queryOptions.version || '',
      } as Identifier,
      limit: queryOptions.limit || 50,
      token: queryOptions.token || '',
      sortBy: queryOptions.sortBy
        ? ({
            key: queryOptions.sortBy,
            direction: queryOptions.sortOrder === 'desc' ? 1 : 0,
          } as any)
        : undefined,
      filters: queryOptions.filters
        ? Object.entries(queryOptions.filters)
            .map(([k, v]) => `${k}=${v}`)
            .join(',')
        : '',
    } as flyteidl.admin.ResourceListRequest;

    return this.listTasks(request, callOptions);
  }

  /**
   * Get all tasks for a project
   */
  async getProjectTasks(project: string, domain?: string, options?: CallOptions): Promise<Task[]> {
    const result = await this.queryTasks(
      {
        project,
        domain,
        limit: 100,
      },
      options
    );

    return (result.tasks || []) as Task[];
  }

  /**
   * Get task statistics
   */
  async getTaskStatistics(
    project?: string,
    domain?: string,
    options?: CallOptions
  ): Promise<TaskStatistics> {
    const tasks = await this.queryTasks(
      {
        project,
        domain,
        limit: 1000,
      },
      options
    );

    const taskList = (tasks.tasks || []) as Task[];

    // Aggregate statistics
    const stats: TaskStatistics = {
      totalTasks: taskList.length,
      tasksByProject: {},
      tasksByDomain: {},
      recentTasks: taskList.slice(0, 10),
    };

    taskList.forEach((task) => {
      const proj = (task.id as Identifier)?.project || 'unknown';
      const dom = (task.id as Identifier)?.domain || 'unknown';

      stats.tasksByProject[proj] = (stats.tasksByProject[proj] || 0) + 1;
      stats.tasksByDomain[dom] = (stats.tasksByDomain[dom] || 0) + 1;
    });

    return stats;
  }

  /**
   * Check if task exists
   */
  async taskExists(
    project: string,
    domain: string,
    name: string,
    version?: string,
    options?: CallOptions
  ): Promise<boolean> {
    try {
      await this.getTaskById(project, domain, name, version, options);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all task identifiers for a project
   */
  async listTaskIdentifiers(
    project: string,
    domain: string,
    limit: number = 100,
    options?: CallOptions
  ): Promise<flyteidl.admin.NamedEntityIdentifierList> {
    const request: flyteidl.admin.NamedEntityIdentifierListRequest = {
      project,
      domain,
      limit,
      token: '',
      sortBy: undefined,
      filters: '',
    } as flyteidl.admin.NamedEntityIdentifierListRequest;

    return this.listTaskIds(request, options);
  }

  /**
   * Create task identifier helper
   */
  private static createTaskIdentifier(
    project: string,
    domain: string,
    name: string,
    version?: string
  ): Identifier {
    return {
      resourceType: flyteidl.core.ResourceType.TASK,
      project,
      domain,
      name,
      version: version || '',
    } as Identifier;
  }
}
