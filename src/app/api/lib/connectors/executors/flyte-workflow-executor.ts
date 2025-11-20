/**
 * Flyte Workflow Connector Executor
 * Executes Flyte workflows as data sources for connectors
 */

import { logger } from '../../utils/logger';
import { applyDataMapping, extractDataFromResponse } from '../utils/data-mapper';
import {
  DataMapping,
  ExecutionResult,
  ExecutionContext,
  ValidationResult,
  ConnectorExecutor,
  HealthCheckResult,
  AuthenticationConfig,
  ConnectorQueryParams,
  ConnectorTimeoutError,
  ConnectorExecutionError,
  FlyteWorkflowConnectorConfig,
} from '../types';

export class FlyteWorkflowExecutor implements ConnectorExecutor {
  /**
   * Execute Flyte workflow connector
   */
  // eslint-disable-next-line class-methods-use-this
  async execute(
    config: FlyteWorkflowConnectorConfig,
    auth: AuthenticationConfig | undefined,
    mapping: DataMapping | undefined,
    query: ConnectorQueryParams,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      logger.info('Executing Flyte workflow connector', {
        requestId: context.requestId,
        workflow: config.workflowName,
        project: config.project,
        domain: config.domain,
      });

      // Build workflow inputs
      const inputs = FlyteWorkflowExecutor.buildWorkflowInputs(config, query);

      // Execute workflow
      const executionId = await FlyteWorkflowExecutor.executeWorkflow(config, inputs);

      // Wait for completion if configured
      let outputs;
      if (config.waitForCompletion !== false) {
        outputs = await FlyteWorkflowExecutor.waitForCompletion(
          executionId,
          config.timeout || 60000,
          config.pollInterval || 1000
        );
      } else {
        throw new Error('Async workflow execution not yet supported for data sources');
      }

      // Extract data from workflow outputs
      let data = extractDataFromResponse(outputs, config.outputPath);

      // Ensure data is an array
      if (!Array.isArray(data)) {
        data = [data];
      }

      // Apply field mapping
      if (mapping) {
        data = applyDataMapping(data, mapping);
      }

      const executionTime = Date.now() - startTime;

      logger.info('Flyte workflow execution successful', {
        requestId: context.requestId,
        recordCount: data.length,
        executionTime,
      });

      return {
        success: true,
        data,
        totalCount: data.length,
        executionTime,
        debug: {
          params: { executionId },
          rawResponse: inputs,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error('Flyte workflow execution failed', error, {
        requestId: context.requestId,
        executionTime,
      });

      return {
        success: false,
        data: [],
        executionTime,
        error: error.message || 'Flyte workflow execution failed',
      };
    }
  }

  /**
   * Test Flyte workflow connector
   */
  async test(
    config: FlyteWorkflowConnectorConfig,
    auth: AuthenticationConfig | undefined
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Basic configuration validation
      const validation = await this.validate(config);

      if (!validation.valid) {
        return {
          status: 'unhealthy',
          lastCheck: new Date(),
          responseTime: Date.now() - startTime,
          error: `Invalid configuration: ${validation.errors.map((e) => e.message).join(', ')}`,
        };
      }

      // TODO: In a full implementation, verify workflow exists in Flyte
      return {
        status: 'healthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        details: {
          project: config.project,
          domain: config.domain,
          workflow: config.workflowName,
        },
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error.message || 'Health check failed',
      };
    }
  }

  /**
   * Validate Flyte workflow configuration
   */
  // eslint-disable-next-line class-methods-use-this
  async validate(config: FlyteWorkflowConnectorConfig): Promise<ValidationResult> {
    const errors: any[] = [];

    if (!config.project) {
      errors.push({
        field: 'project',
        message: 'Project is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!config.domain) {
      errors.push({
        field: 'domain',
        message: 'Domain is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!config.workflowName) {
      errors.push({
        field: 'workflowName',
        message: 'Workflow name is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!config.version) {
      errors.push({
        field: 'version',
        message: 'Version is required',
        code: 'REQUIRED_FIELD',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build workflow inputs from query parameters
   */
  private static buildWorkflowInputs(
    config: FlyteWorkflowConnectorConfig,
    query: ConnectorQueryParams
  ): Record<string, any> {
    const inputs: Record<string, any> = {};

    // Apply input mapping if configured
    if (config.inputMapping) {
      config.inputMapping.forEach((mapping) => {
        // Get value from query parameters
        const sourceValue =
          query.filters?.[mapping.sourceField] || query.customParams?.[mapping.sourceField];

        if (sourceValue !== undefined) {
          let transformedValue = sourceValue;

          // Apply transform if provided
          if (mapping.transform) {
            transformedValue = mapping.transform(sourceValue);
          }

          inputs[mapping.targetField] = transformedValue;
        }
      });
    }

    // Add all custom params as workflow inputs
    if (query.customParams) {
      Object.entries(query.customParams).forEach(([key, value]) => {
        if (!(key in inputs)) {
          inputs[key] = value;
        }
      });
    }

    return inputs;
  }

  /**
   * Execute workflow via API
   */
  private static async executeWorkflow(
    config: FlyteWorkflowConnectorConfig,
    inputs: Record<string, any>
  ): Promise<any> {
    try {
      const response = await fetch('/api/v1/engine/workflows/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowId: {
            project: config.project,
            domain: config.domain,
            name: config.workflowName,
            version: config.version,
          },
          inputs,
          launchPlanId: config.launchPlanName
            ? {
                project: config.project,
                domain: config.domain,
                name: config.launchPlanName,
                version: config.version,
              }
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to execute workflow');
      }

      const result = await response.json();
      return result.data?.executionId || result.executionId;
    } catch (error: any) {
      logger.error('Failed to execute workflow', error);
      throw new ConnectorExecutionError(
        `Failed to execute workflow: ${error.message}`,
        'flyte-workflow'
      );
    }
  }

  /**
   * Wait for workflow execution to complete
   */
  private static async waitForCompletion(
    executionId: any,
    timeout: number,
    pollInterval: number
  ): Promise<any> {
    return FlyteWorkflowExecutor.pollExecution(executionId, timeout, pollInterval, Date.now());
  }

  /**
   * Poll execution status recursively
   */
  private static async pollExecution(
    executionId: any,
    timeout: number,
    pollInterval: number,
    startTime: number
  ): Promise<any> {
    if (Date.now() - startTime >= timeout) {
      throw new ConnectorTimeoutError('Workflow execution timeout', 'flyte-workflow', timeout);
    }

    try {
      const status = await FlyteWorkflowExecutor.getExecutionStatus(executionId);

      if (status.phase === 'SUCCEEDED') {
        return status.outputs;
      }

      if (status.phase === 'FAILED' || status.phase === 'ABORTED') {
        throw new ConnectorExecutionError(
          `Workflow failed: ${status.error || 'Unknown error'}`,
          'flyte-workflow'
        );
      }

      // Still running, wait before polling again
      await FlyteWorkflowExecutor.sleep(pollInterval);
      return await FlyteWorkflowExecutor.pollExecution(
        executionId,
        timeout,
        pollInterval,
        startTime
      );
    } catch (error: any) {
      if (error instanceof ConnectorExecutionError) {
        throw error;
      }

      logger.warn('Error polling execution status', { error: error.message });
      await FlyteWorkflowExecutor.sleep(pollInterval);
      return FlyteWorkflowExecutor.pollExecution(executionId, timeout, pollInterval, startTime);
    }
  }

  /**
   * Get execution status
   */
  private static async getExecutionStatus(executionId: any): Promise<any> {
    try {
      const response = await fetch(
        `/api/v1/engine/executions/${executionId.project}/${executionId.domain}/${executionId.name}`
      );

      if (!response.ok) {
        throw new Error('Failed to get execution status');
      }

      const result = await response.json();
      return result.data || result;
    } catch (error: any) {
      logger.error('Failed to get execution status', error);
      throw error;
    }
  }

  /**
   * Sleep helper
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
