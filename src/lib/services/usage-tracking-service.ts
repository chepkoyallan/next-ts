// Usage tracking service
import { prisma } from '../prisma';
import { logger } from '../../app/api/lib/utils/logger';

export type UsageMetric =
  | 'EXECUTIONS'
  | 'CPU_HOURS'
  | 'MEMORY_GB_HOURS'
  | 'STORAGE_GB'
  | 'NETWORK_GB'
  | 'USERS'
  | 'PROJECTS';

export interface TrackUsageParams {
  subscriptionId: string;
  projectId: string;
  metric: UsageMetric;
  quantity: number;
  unit: string;
  metadata?: Record<string, any>;
}

export interface GetUsageParams {
  subscriptionId: string;
  startDate?: Date;
  endDate?: Date;
  metrics?: UsageMetric[];
}

export class UsageTrackingService {
  /**
   * Track usage for a subscription
   */
  // eslint-disable-next-line class-methods-use-this
  async trackUsage(params: TrackUsageParams): Promise<void> {
    const { subscriptionId, projectId, metric, quantity, unit, metadata = {} } = params;

    try {
      // Find subscription
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true },
      });

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      // Record usage
      await prisma.usageRecord.create({
        data: {
          subscriptionId,
          projectId,
          metric,
          quantity,
          unit,
          timestamp: new Date(),
          metadata,
        },
      });

      logger.info('Usage tracked', {
        subscriptionId,
        metric,
        quantity,
      });

      // Check if usage exceeds limits
      const limits = subscription.plan.limits as any;
      if (limits[metric] && limits[metric] !== -1) {
        const currentUsage = await UsageTrackingService.getCurrentUsage({
          subscriptionId,
          metrics: [metric],
        });

        if (currentUsage[metric] >= limits[metric]) {
          logger.warn('Usage limit exceeded', {
            subscriptionId,
            metric,
            current: currentUsage[metric],
            limit: limits[metric],
          });

          // TODO: Implement limit enforcement (send email, block actions, etc.)
        }
      }
    } catch (error) {
      logger.error('Failed to track usage', error as Error, {
        subscriptionId,
        metric,
        quantity,
      });
      throw error;
    }
  }

  /**
   * Get current usage for subscription in current billing period
   */
  static async getCurrentUsage(params: GetUsageParams): Promise<Record<string, number>> {
    const { subscriptionId, metrics } = params;

    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      const usageRecords = await prisma.usageRecord.findMany({
        where: {
          subscriptionId,
          timestamp: {
            gte: subscription.currentPeriodStart,
            lte: subscription.currentPeriodEnd,
          },
          ...(metrics && { metric: { in: metrics } }),
        },
      });

      const usage = usageRecords.reduce(
        (acc, record) => {
          acc[record.metric] = (acc[record.metric] || 0) + Number(record.quantity);
          return acc;
        },
        {} as Record<string, number>
      );

      return usage;
    } catch (error) {
      logger.error('Failed to get current usage', error as Error, {
        subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Get usage history
   */
  static async getUsageHistory(params: GetUsageParams): Promise<
    Array<{
      metric: string;
      quantity: number;
      timestamp: Date;
      metadata: any;
    }>
  > {
    const { subscriptionId, startDate, endDate, metrics } = params;

    try {
      const where: any = { subscriptionId };

      if (startDate || endDate) {
        where.timestamp = {};
        if (startDate) where.timestamp.gte = startDate;
        if (endDate) where.timestamp.lte = endDate;
      }

      if (metrics) {
        where.metric = { in: metrics };
      }

      const records = await prisma.usageRecord.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: 1000, // Limit to last 1000 records
      });

      return records.map((record) => ({
        metric: record.metric,
        quantity: Number(record.quantity),
        timestamp: record.timestamp,
        metadata: record.metadata as any,
      }));
    } catch (error) {
      logger.error('Failed to get usage history', error as Error, {
        subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Get usage summary for all metrics
   */
  // eslint-disable-next-line class-methods-use-this
  async getUsageSummary(subscriptionId: string): Promise<{
    current: Record<string, number>;
    limits: Record<string, number | string>;
    percentages: Record<string, number>;
  }> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: { plan: true },
      });

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      const current = await UsageTrackingService.getCurrentUsage({ subscriptionId });
      const limits = subscription.plan.limits as Record<string, number | string>;

      const percentages: Record<string, number> = Object.entries(current).reduce(
        (acc, [key, value]) => {
          const limit = limits[key];
          if (typeof limit === 'number' && limit !== -1) {
            acc[key] = (value / limit) * 100;
          } else {
            acc[key] = 0; // Unlimited
          }
          return acc;
        },
        {} as Record<string, number>
      );

      return { current, limits, percentages };
    } catch (error) {
      logger.error('Failed to get usage summary', error as Error, {
        subscriptionId,
      });
      throw error;
    }
  }

  /**
   * Reset usage (typically called at the start of a new billing period)
   */
  static async resetUsage(subscriptionId: string): Promise<void> {
    try {
      // Archive old usage records
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      // Delete records from previous periods (optional - could archive instead)
      await prisma.usageRecord.deleteMany({
        where: {
          subscriptionId,
          timestamp: {
            lt: subscription.currentPeriodStart,
          },
        },
      });

      logger.info('Usage reset for new billing period', { subscriptionId });
    } catch (error) {
      logger.error('Failed to reset usage', error as Error, {
        subscriptionId,
      });
      throw error;
    }
  }
}
