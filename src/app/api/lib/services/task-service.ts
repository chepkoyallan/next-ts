/**
 * Task Service
 * Handles task definition CRUD and Flyte registration workflow
 * Enforces Pydantic-based task development with automatic code generation
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@app/database';

import { logger } from '../utils/logger';
import { PydanticGeneratorService } from './pydantic-generator-service';
import { enqueueTaskRegistration } from '../queues/task-registration-queue';
import { ValidationResult, TaskValidationService } from './task-validation-service';

// ============================================================================
// Types
// ============================================================================

export interface CreateTaskInput {
  name: string;
  description?: string;
  organizationId: string;
  projectId: string;
  domain?: string;
  inputSchemaId: string;
  outputSchemaId: string;
  baseImage?: string;
  extraDependencies?: string[];
  createdBy: string;
}

export interface UpdateTaskCodeInput {
  taskCode: string;
}

export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  projectId: string;
  domain: string;
  inputSchemaId: string;
  outputSchemaId: string;
  generatedInputModel: string;
  generatedOutputModel: string;
  // Dynamic function signature fields
  functionName: string;
  parameterName: string;
  inputTypeName: string;
  outputTypeName: string;
  taskCode: string;
  baseImage: string;
  extraDependencies: string[];
  isValid: boolean;
  validationErrors?: any;
  lastValidated?: Date;
  flyteTaskId?: string;
  registeredAt?: Date;
  version: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskListFilters {
  projectId?: string;
  domain?: string;
  isValid?: boolean;
  createdBy?: string;
  search?: string;
}

export interface RegisterTaskResult {
  success: boolean;
  flyteTaskId?: string;
  error?: string;
}

// ============================================================================
// Task Service
// ============================================================================

export class TaskService {
  /**
   * Create a new task definition
   * Generates Pydantic models from schemas and creates initial template
   */
  static async createTask(input: CreateTaskInput): Promise<TaskDefinition> {
    try {
      logger.info('Creating task definition', {
        name: input.name,
        organizationId: input.organizationId,
        projectId: input.projectId,
      });

      // Fetch input and output schemas
      const inputSchema = await prisma.formSchema.findFirst({
        where: {
          id: input.inputSchemaId,
          organizationId: input.organizationId,
        },
      });

      if (!inputSchema) {
        throw new Error(`Input schema not found: ${input.inputSchemaId}`);
      }

      const outputSchema = await prisma.formSchema.findFirst({
        where: {
          id: input.outputSchemaId,
          organizationId: input.organizationId,
        },
      });

      if (!outputSchema) {
        throw new Error(`Output schema not found: ${input.outputSchemaId}`);
      }

      // Generate Pydantic models
      const taskName = this.toValidPythonName(input.name);
      const inputModelName = `${taskName}Input`;
      const outputModelName = `${taskName}Output`;

      const inputModel = PydanticGeneratorService.generatePydanticModel(inputSchema.schema as any, {
        className: inputModelName,
        includeImports: true,
        includeDocstring: true,
      });

      const outputModel = PydanticGeneratorService.generatePydanticModel(
        outputSchema.schema as any,
        {
          className: outputModelName,
          includeImports: false,
          includeDocstring: true,
        }
      );

      // Generate complete task template
      const taskTemplate = PydanticGeneratorService.generateTaskTemplate(
        taskName,
        inputSchema.schema as any,
        outputSchema.schema as any
      );

      // Create task definition in database
      const created = await prisma.taskDefinition.create({
        data: {
          name: input.name,
          description: input.description,
          organizationId: input.organizationId,
          projectId: input.projectId,
          domain: input.domain || 'development',
          inputSchemaId: input.inputSchemaId,
          outputSchemaId: input.outputSchemaId,
          generatedInputModel: inputModel.code,
          generatedOutputModel: outputModel.code,
          // Dynamic function signature (defaults, user can customize)
          functionName: 'process_data',
          parameterName: 'input_data',
          inputTypeName: inputModelName,
          outputTypeName: outputModelName,
          taskCode: taskTemplate,
          baseImage: input.baseImage || 'minimal-python',
          extraDependencies: input.extraDependencies || [],
          isValid: false, // Will be validated when user updates code
          createdBy: input.createdBy,
          version: '1.0.0',
        },
      });

      logger.info('Task definition created', { id: created.id });

      return this.mapToTaskDefinition(created);
    } catch (error: any) {
      logger.error('Failed to create task', error);
      throw error;
    }
  }

  /**
   * Get task by ID
   */
  static async getTask(id: string, organizationId: string): Promise<TaskDefinition | null> {
    try {
      const task = await prisma.taskDefinition.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          inputSchema: true,
          outputSchema: true,
        },
      });

      if (!task) {
        return null;
      }

      return this.mapToTaskDefinition(task);
    } catch (error: any) {
      logger.error('Failed to get task', error);
      throw error;
    }
  }

  /**
   * List tasks with filters
   */
  static async listTasks(
    organizationId: string,
    filters?: TaskListFilters
  ): Promise<TaskDefinition[]> {
    try {
      const where: any = { organizationId };

      if (filters?.projectId) {
        where.projectId = filters.projectId;
      }

      if (filters?.domain) {
        where.domain = filters.domain;
      }

      if (filters?.isValid !== undefined) {
        where.isValid = filters.isValid;
      }

      if (filters?.createdBy) {
        where.createdBy = filters.createdBy;
      }

      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const tasks = await prisma.taskDefinition.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return tasks.map((t) => this.mapToTaskDefinition(t));
    } catch (error: any) {
      logger.error('Failed to list tasks', error);
      throw error;
    }
  }

  /**
   * Update task code
   * Validates the code and updates validation status
   */
  static async updateTaskCode(
    id: string,
    organizationId: string,
    input: UpdateTaskCodeInput
  ): Promise<{ task: TaskDefinition; validation: ValidationResult }> {
    try {
      logger.info('Updating task code', { id });

      // Get task
      const task = await this.getTask(id, organizationId);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      // Get expected model names and function signature from task
      const taskName = this.toValidPythonName(task.name);
      const expectedInputModel = `${taskName}Input`;
      const expectedOutputModel = `${taskName}Output`;

      // Validate the code with dynamic function signature
      const validation = TaskValidationService.validateTaskCode({
        code: input.taskCode,
        expectedInputModel,
        expectedOutputModel,
        expectedFunctionName: task.functionName || 'process_data',
        expectedParameterName: task.parameterName || 'input_data',
      });

      // Update task in database
      const updated = await prisma.taskDefinition.update({
        where: { id },
        data: {
          taskCode: input.taskCode,
          isValid: validation.valid,
          validationErrors: validation.valid
            ? Prisma.JsonNull
            : ({ errors: validation.errors } as unknown as Prisma.InputJsonValue),
          lastValidated: new Date(),
        },
      });

      logger.info('Task code updated', {
        id,
        isValid: validation.valid,
        errorCount: validation.errors.length,
      });

      return {
        task: this.mapToTaskDefinition(updated),
        validation,
      };
    } catch (error: any) {
      logger.error('Failed to update task code', error);
      throw error;
    }
  }

  /**
   * Validate task code without saving
   */
  static async validateTask(
    id: string,
    organizationId: string,
    code?: string
  ): Promise<ValidationResult> {
    try {
      const task = await this.getTask(id, organizationId);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      const taskName = this.toValidPythonName(task.name);
      const expectedInputModel = `${taskName}Input`;
      const expectedOutputModel = `${taskName}Output`;

      const codeToValidate = code || task.taskCode;

      return TaskValidationService.validateTaskCode({
        code: codeToValidate,
        expectedInputModel,
        expectedOutputModel,
        expectedFunctionName: task.functionName || 'process_data',
        expectedParameterName: task.parameterName || 'input_data',
      });
    } catch (error: any) {
      logger.error('Failed to validate task', error);
      throw error;
    }
  }

  /**
   * Register task to Flyte
   * Submits task to registration queue for processing by Python worker
   */
  static async registerTask(id: string, organizationId: string): Promise<RegisterTaskResult> {
    try {
      logger.info('Registering task to Flyte', { id });

      const task = await this.getTask(id, organizationId);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      // Validate task before registration
      if (!task.isValid) {
        // Run validation to get specific errors
        const validation = await this.validateTask(id, organizationId);
        return {
          success: false,
          error: `Task validation failed: ${validation.errors.map((e) => e.message).join(', ')}`,
        };
      }

      // Generate Flyte task ID
      const flyteTaskId = `${task.projectId}:${task.domain}:${this.toValidPythonName(task.name)}:${
        task.version
      }`;

      // Update task status to PENDING
      await prisma.taskDefinition.update({
        where: { id },
        data: {
          flyteTaskId,
          registrationStatus: 'PENDING',
        },
      });

      // Submit to registration worker queue
      await enqueueTaskRegistration({
        taskDefinitionId: id,
        taskCode: task.taskCode,
        projectId: task.projectId,
        domain: task.domain,
        name: this.toValidPythonName(task.name),
        version: task.version,
        baseImage: task.baseImage,
        extraDependencies: Array.isArray(task.extraDependencies) ? task.extraDependencies : [],
        organizationId: task.organizationId,
        createdBy: task.createdBy,
      });

      logger.info('Task submitted to registration queue', {
        id,
        flyteTaskId,
      });

      return {
        success: true,
        flyteTaskId,
      };
    } catch (error: any) {
      logger.error('Failed to register task', error);

      // Update task status to FAILED if queue submission fails
      try {
        await prisma.taskDefinition.update({
          where: { id },
          data: {
            registrationStatus: 'FAILED',
            registrationError: error.message,
          },
        });
      } catch (updateError) {
        logger.error('Failed to update task status after error', updateError);
      }

      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Delete task
   */
  static async deleteTask(id: string, organizationId: string): Promise<boolean> {
    try {
      await prisma.taskDefinition.delete({
        where: {
          id,
          organizationId,
        },
      });

      logger.info('Task deleted', { id });
      return true;
    } catch (error: any) {
      logger.error('Failed to delete task', error);
      return false;
    }
  }

  /**
   * Update task dependencies
   */
  static async updateDependencies(
    id: string,
    organizationId: string,
    baseImage: string,
    extraDependencies: string[]
  ): Promise<TaskDefinition> {
    try {
      const updated = await prisma.taskDefinition.update({
        where: {
          id,
          organizationId,
        },
        data: {
          baseImage,
          extraDependencies,
        },
      });

      return this.mapToTaskDefinition(updated);
    } catch (error: any) {
      logger.error('Failed to update dependencies', error);
      throw error;
    }
  }

  /**
   * Convert task name to valid Python identifier
   */
  private static toValidPythonName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .replace(/^_+|_+$/g, '');
  }

  /**
   * Map Prisma model to TaskDefinition
   */
  private static mapToTaskDefinition(prismaModel: any): TaskDefinition {
    return {
      id: prismaModel.id,
      name: prismaModel.name,
      description: prismaModel.description,
      organizationId: prismaModel.organizationId,
      projectId: prismaModel.projectId,
      domain: prismaModel.domain,
      inputSchemaId: prismaModel.inputSchemaId,
      outputSchemaId: prismaModel.outputSchemaId,
      generatedInputModel: prismaModel.generatedInputModel,
      generatedOutputModel: prismaModel.generatedOutputModel,
      // Dynamic function signature fields
      functionName: prismaModel.functionName || 'process_data',
      parameterName: prismaModel.parameterName || 'input_data',
      inputTypeName: prismaModel.inputTypeName || 'InputType',
      outputTypeName: prismaModel.outputTypeName || 'OutputType',
      taskCode: prismaModel.taskCode,
      baseImage: prismaModel.baseImage,
      extraDependencies: prismaModel.extraDependencies || [],
      isValid: prismaModel.isValid,
      validationErrors: prismaModel.validationErrors,
      lastValidated: prismaModel.lastValidated,
      flyteTaskId: prismaModel.flyteTaskId,
      registeredAt: prismaModel.registeredAt,
      version: prismaModel.version,
      createdBy: prismaModel.createdBy,
      createdAt: prismaModel.createdAt,
      updatedAt: prismaModel.updatedAt,
    };
  }
}

export default TaskService;
