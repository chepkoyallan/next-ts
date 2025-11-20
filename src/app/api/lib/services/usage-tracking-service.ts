// Usage Tracking Service - Records workflow execution usage for billing
import { prisma } from '@app/database';

import { logger } from '../utils/logger';

export interface ExecutionUsageData {
  executionId: string;
  workflowId: string;
  projectId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: 'SUCCESS' | 'FAILED' | 'ABORTED';
  resources: {
    cpuSeconds: number;
    memoryGbSeconds: number;
    storageGb?: number;
    networkGb?: number;
  };
  metadata?: Record<string, any>;
}

export class UsageTrackingService {
  /**
   * Record workflow execution usage
   */
  static async trackExecution(data: ExecutionUsageData): Promise<void> {
    try {
      // Get project's subscription
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        include: {
          subscriptions: {
            where: {
              status: {
                in: ['ACTIVE', 'TRIALING'],
              },
            },
            take: 1,
          },
        },
      });

      if (!project || !project.subscriptions.length) {
        logger.warn('No active subscription found for project', {
          projectId: data.projectId,
        });
        return;
      }

      const subscription = project.subscriptions[0];

      // Create usage records for each metric
      const records = [
        {
          subscriptionId: subscription.id,
          projectId: data.projectId,
          metric: 'EXECUTIONS' as any, // Cast to any - UsageMetric enum may not match
          quantity: 1,
          timestamp: data.endTime,
          executionId: data.executionId,
          unit: 'EXECUTIONS',
          metadata: {
            workflowId: data.workflowId,
            userId: data.userId,
            status: data.status,
            duration: data.endTime.getTime() - data.startTime.getTime(),
          },
        },
        {
          subscriptionId: subscription.id,
          projectId: data.projectId,
          metric: 'CPU_HOURS' as any, // Cast to any - UsageMetric enum may not match
          quantity: data.resources.cpuSeconds / 3600,
          timestamp: data.endTime,
          executionId: data.executionId,
          unit: 'CPU_HOURS',
          metadata: { cpuSeconds: data.resources.cpuSeconds },
        },
        {
          subscriptionId: subscription.id,
          projectId: data.projectId,
          metric: 'MEMORY_GB_HOURS' as any, // Cast to any - UsageMetric enum may not match
          quantity: data.resources.memoryGbSeconds / 3600,
          timestamp: data.endTime,
          executionId: data.executionId,
          unit: 'MEMORY_GB_HOURS',
          metadata: { memoryGbSeconds: data.resources.memoryGbSeconds },
        },
      ];

      await prisma.usageRecord.createMany({ data: records });

      logger.info('Execution usage tracked', {
        executionId: data.executionId,
        projectId: data.projectId,
        subscriptionId: subscription.id,
      });

      await this.checkUsageAlerts(subscription.id, subscription.billingAccountId);
    } catch (error) {
      logger.error('Failed to track execution usage', error as Error, {
        executionId: data.executionId,
      });
    }
  }

  static async checkUsageAlerts(subscriptionId: string, billingAccountId: string): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true },
      });

      if (!subscription) return;

      const usage = await this.getUsageSummary(
        subscriptionId,
        subscription.currentPeriodStart,
        new Date()
      );

      const features = subscription.plan.features as any;

      if (features.maxExecutions && typeof features.maxExecutions === 'number') {
        const executionUsage = usage.EXECUTIONS || 0;
        const percentage = (executionUsage / features.maxExecutions) * 100;

        if (percentage >= 90) {
          await this.createAlert(
            billingAccountId,
            'USAGE_LIMIT',
            'CRITICAL',
            `You've used ${Math.round(percentage)}% of your execution limit`,
            features.maxExecutions,
            executionUsage
          );
        }
      }
    } catch (error) {
      logger.error('Failed to check usage alerts', error as Error, { subscriptionId });
    }
  }

  static async getUsageSummary(
    subscriptionId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, number>> {
    const records = await prisma.usageRecord.findMany({
      where: {
        subscriptionId,
        timestamp: { gte: startDate, lte: endDate },
      },
      select: { metric: true, quantity: true },
    });

    const summary: Record<string, number> = {};
    records.forEach((record) => {
      summary[record.metric] = (summary[record.metric] || 0) + Number(record.quantity);
    });

    return summary;
  }

  static async createAlert(
    billingAccountId: string,
    type: 'USAGE_LIMIT' | 'COST_THRESHOLD' | 'PAYMENT_FAILED' | 'QUOTA_EXCEEDED',
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    message: string,
    threshold?: number,
    currentValue?: number
  ): Promise<void> {
    try {
      // Try to find existing alert
      const existing = await prisma.billingAlert.findFirst({
        where: {
          billingAccountId,
          type: type as any,
          message,
        },
      });

      if (existing) {
        // Update existing
        await prisma.billingAlert.update({
          where: { id: existing.id },
          data: {
            severity,
            currentValue: currentValue ? String(currentValue) : undefined,
          },
        });
      } else {
        // Create new
        await prisma.billingAlert.create({
          data: {
            billingAccountId,
            type: type as any,
            severity,
            message,
            threshold: threshold ? String(threshold) : undefined,
            currentValue: currentValue ? String(currentValue) : undefined,
          },
        });
      }
    } catch (error) {
      logger.error('Failed to create billing alert', error);
    }
  }
}
