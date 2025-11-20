// Execution tracking middleware for orchestrator billing
import { NextRequest } from 'next/server';

import { Identifier } from 'src/gen/index.orchestrator.core';

import { logger } from '../utils/logger';
import { BillingService } from '../services/billing-service';
import { ResourceUsage, ExecutionCost, ExecutionUsage, ExecutionStatus } from '../types/billing';

export interface ExecutionTrackingConfig {
  enabled: boolean;
  trackResources: boolean;
  trackCosts: boolean;
  billingService: BillingService;
}

export interface ExecutionContext {
  executionId: string;
  projectId: string;
  domain: string;
  workflowId: Identifier;
  userId: string;
  startTime: Date;
  resourceRequests?: ResourceRequests;
}

export interface ResourceRequests {
  cpu: number; // vCPUs requested
  memory: number; // GB requested
  storage: number; // GB requested
}

export interface ExecutionResult {
  status: ExecutionStatus;
  endTime: Date;
  resourceUsage: ResourceUsage;
  error?: string;
}

export class ExecutionTracker {
  private config: ExecutionTrackingConfig;

  private activeExecutions: Map<string, ExecutionContext> = new Map();

  constructor(config: ExecutionTrackingConfig) {
    this.config = config;
  }

  /**
   * Update the configuration
   */
  updateConfig(updates: Partial<ExecutionTrackingConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Start tracking an execution
   */
  async startExecution(context: ExecutionContext): Promise<void> {
    if (!this.config.enabled) return;

    try {
      this.activeExecutions.set(context.executionId, context);

      logger.info('Execution tracking started', {
        executionId: context.executionId,
        projectId: context.projectId,
        workflowId: context.workflowId,
        userId: context.userId,
      });

      // Track execution start event
      await ExecutionTracker.trackExecutionEvent('execution_started', context);
    } catch (error) {
      logger.error('Failed to start execution tracking', error as Error, {
        executionId: context.executionId,
      });
    }
  }

  /**
   * Complete execution tracking and calculate costs
   */
  async completeExecution(executionId: string, result: ExecutionResult): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const context = this.activeExecutions.get(executionId);
      if (!context) {
        logger.warn('Execution context not found', { executionId });
        return;
      }

      const duration = Math.floor((result.endTime.getTime() - context.startTime.getTime()) / 1000);

      // Calculate execution cost
      const cost = await this.calculateExecutionCost(
        result.resourceUsage,
        duration,
        context.projectId
      );

      // Create execution usage record
      const executionUsage: ExecutionUsage = {
        executionId,
        projectId: context.projectId,
        domain: context.domain,
        workflowId: context.workflowId,
        startTime: context.startTime,
        endTime: result.endTime,
        duration,
        status: result.status,
        resourceUsage: result.resourceUsage,
        cost,
      };

      // Track usage in billing system
      if (this.config.trackCosts) {
        await this.config.billingService.trackExecutionUsage(executionUsage);
      }

      // Track execution completion event
      await ExecutionTracker.trackExecutionEvent('execution_completed', context, {
        status: result.status,
        duration,
        cost: cost.total,
      });

      // Clean up
      this.activeExecutions.delete(executionId);

      logger.info('Execution tracking completed', {
        executionId,
        status: result.status,
        duration,
        cost: cost.total,
      });
    } catch (error) {
      logger.error('Failed to complete execution tracking', error as Error, {
        executionId,
      });
    }
  }

  /**
   * Handle execution failure
   */
  async failExecution(executionId: string, error: string): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const context = this.activeExecutions.get(executionId);
      if (!context) {
        logger.warn('Execution context not found for failure', { executionId });
        return;
      }

      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - context.startTime.getTime()) / 1000);

      // For failed executions, we might apply different pricing or credits
      const resourceUsage = ExecutionTracker.estimateResourceUsage(context, duration);
      const cost = await this.calculateExecutionCost(
        resourceUsage,
        duration,
        context.projectId,
        true
      );

      const executionUsage: ExecutionUsage = {
        executionId,
        projectId: context.projectId,
        domain: context.domain,
        workflowId: context.workflowId,
        startTime: context.startTime,
        endTime,
        duration,
        status: ExecutionStatus.FAILED,
        resourceUsage,
        cost,
      };

      // Track failed execution usage (might be discounted)
      if (this.config.trackCosts) {
        await this.config.billingService.trackExecutionUsage(executionUsage);
      }

      await ExecutionTracker.trackExecutionEvent('execution_failed', context, {
        error,
        duration,
        cost: cost.total,
      });

      this.activeExecutions.delete(executionId);

      logger.info('Failed execution tracked', {
        executionId,
        error,
        duration,
        cost: cost.total,
      });
    } catch (trackingError) {
      logger.error('Failed to track execution failure', trackingError as Error, {
        executionId,
        originalError: error,
      });
    }
  }

  /**
   * Get current execution metrics
   */
  getCurrentExecutions(): ExecutionContext[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution count for project
   */
  getProjectExecutionCount(projectId: string): number {
    return Array.from(this.activeExecutions.values()).filter((ctx) => ctx.projectId === projectId)
      .length;
  }

  /**
   * Calculate execution cost based on resource usage
   */
  private async calculateExecutionCost(
    resourceUsage: ResourceUsage,
    duration: number,
    projectId: string,
    isFailed: boolean = false
  ): Promise<ExecutionCost> {
    try {
      // Get project's subscription plan to determine pricing tier
      const subscription = await this.config.billingService.getSubscriptionByProject(projectId);
      const planTier = subscription
        ? await ExecutionTracker.getPlanTier(subscription.planId)
        : 'free';

      // Calculate base cost
      let cost = await BillingService.calculateExecutionCost(
        resourceUsage,
        duration,
        planTier as any
      );

      // Apply failure discount (e.g., 50% off for failed executions)
      if (isFailed) {
        cost = {
          ...cost,
          compute: cost.compute * 0.5,
          storage: cost.storage * 0.5,
          network: cost.network * 0.5,
          total: cost.total * 0.5,
          breakdown: cost.breakdown.map((item) => ({
            ...item,
            cost: item.cost * 0.5,
          })),
        };
      }

      return cost;
    } catch (error) {
      logger.error('Failed to calculate execution cost', error as Error);
      // Return zero cost on error
      return {
        compute: 0,
        storage: 0,
        network: 0,
        total: 0,
        currency: 'USD',
        breakdown: [],
      };
    }
  }

  /**
   * Estimate resource usage for failed executions
   */
  private static estimateResourceUsage(context: ExecutionContext, duration: number): ResourceUsage {
    const requests = context.resourceRequests;
    if (!requests) {
      // Default minimal usage
      return {
        cpu: { requested: 0.1, used: 0.05, peak: 0.1 },
        memory: { requested: 0.5, used: 0.25, peak: 0.5 },
        storage: { input: 0, output: 0, temporary: 0.1 },
        network: { ingress: 0.01, egress: 0.01 },
      };
    }

    // Estimate based on duration and requests
    const cpuUsed = (requests.cpu * duration) / 3600; // Convert to CPU-hours
    const memoryUsed = (requests.memory * duration) / 3600; // Convert to GB-hours

    return {
      cpu: {
        requested: requests.cpu,
        used: cpuUsed,
        peak: requests.cpu,
      },
      memory: {
        requested: requests.memory,
        used: memoryUsed,
        peak: requests.memory,
      },
      storage: {
        input: 0.1,
        output: 0.05,
        temporary: requests.storage || 1,
      },
      network: {
        ingress: 0.1,
        egress: 0.1,
      },
    };
  }

  /**
   * Track execution events for analytics
   */
  private static async trackExecutionEvent(
    event: string,
    context: ExecutionContext,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      // This could integrate with your analytics system
      const eventData = {
        event,
        executionId: context.executionId,
        projectId: context.projectId,
        domain: context.domain,
        workflowId: context.workflowId,
        userId: context.userId,
        timestamp: new Date(),
        metadata: metadata || {},
      };

      // Store event (implement based on your analytics system)
      logger.debug('Execution event tracked', eventData);
    } catch (error) {
      logger.error('Failed to track execution event', error as Error);
    }
  }

  /**
   * Get plan tier for subscription
   */
  private static async getPlanTier(planId: string): Promise<string> {
    try {
      // This should query your subscription plans
      // For now, return a default
      return 'professional';
    } catch (error) {
      logger.error('Failed to get plan tier', error as Error);
      return 'free';
    }
  }
}

/**
 * Middleware factory for execution tracking
 */
export function createExecutionTrackingMiddleware(config: ExecutionTrackingConfig) {
  const tracker = new ExecutionTracker(config);

  return {
    tracker,

    /**
     * Middleware for API routes that start executions
     */
    trackExecution: (handler: Function) => async (request: NextRequest, context: any) => {
      try {
        // Extract execution context from request
        const executionContext = await extractExecutionContext(request, context);

        if (executionContext) {
          await tracker.startExecution(executionContext);
        }

        // Call the original handler
        const response = await handler(request, context);

        // If execution started successfully, the completion will be tracked separately
        return response;
      } catch (error) {
        logger.error('Execution tracking middleware error', error as Error);
        // Don't fail the request due to tracking errors
        return handler(request, context);
      }
    },

    /**
     * Webhook handler for execution status updates
     */
    handleExecutionStatusUpdate: async (executionId: string, status: string, metadata?: any) => {
      try {
        if (status === 'SUCCEEDED' || status === 'COMPLETED') {
          const result: ExecutionResult = {
            status: ExecutionStatus.SUCCEEDED,
            endTime: new Date(),
            resourceUsage: metadata?.resourceUsage || estimateDefaultResourceUsage(),
          };
          await tracker.completeExecution(executionId, result);
        } else if (status === 'FAILED' || status === 'ABORTED') {
          await tracker.failExecution(executionId, metadata?.error || 'Execution failed');
        }
      } catch (error) {
        logger.error('Failed to handle execution status update', error as Error);
      }
    },
  };
}

/**
 * Extract execution context from request
 */
async function extractExecutionContext(
  request: NextRequest,
  context: any
): Promise<ExecutionContext | null> {
  try {
    const body = await request.json();

    // Extract from orchestrator execution request
    if (body.id && body.spec) {
      return {
        executionId: generateExecutionId(),
        projectId: body.id.project || 'default',
        domain: body.id.domain || 'development',
        workflowId: body.id,
        userId: context.auth?.user?.id || 'anonymous',
        startTime: new Date(),
        resourceRequests: extractResourceRequests(body.spec),
      };
    }

    return null;
  } catch (error) {
    logger.error('Failed to extract execution context', error as Error);
    return null;
  }
}

/**
 * Extract resource requests from execution spec
 */
function extractResourceRequests(spec: any): ResourceRequests | undefined {
  try {
    // This depends on your orchestrator's spec format
    const resources = spec.resources || spec.template?.resources;
    if (resources) {
      return {
        cpu: parseFloat(resources.requests?.cpu || '0.1'),
        memory: parseFloat(resources.requests?.memory || '0.5'),
        storage: parseFloat(resources.requests?.storage || '1'),
      };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Generate unique execution ID
 */
function generateExecutionId(): string {
  return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Default resource usage for when we can't measure actual usage
 */
function estimateDefaultResourceUsage(): ResourceUsage {
  return {
    cpu: { requested: 0.1, used: 0.05, peak: 0.1 },
    memory: { requested: 0.5, used: 0.25, peak: 0.5 },
    storage: { input: 0.1, output: 0.05, temporary: 0.1 },
    network: { ingress: 0.05, egress: 0.05 },
  };
}

// Export singleton instance
export const executionTracker = new ExecutionTracker({
  enabled: process.env.EXECUTION_TRACKING_ENABLED === 'true',
  trackResources: process.env.TRACK_RESOURCES === 'true',
  trackCosts: process.env.TRACK_COSTS === 'true',
  billingService: null as any, // Will be injected
});
