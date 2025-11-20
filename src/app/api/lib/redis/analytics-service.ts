/**
 * Analytics Service
 * Real-time analytics and leaderboards using Redis sorted sets
 */

import { redisClient, connectRedis } from '@app/cache/client';

import { logger } from '../utils/logger';

export interface LeaderboardEntry {
  id: string;
  score: number;
  rank: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export class AnalyticsService {
  private isConnected = false;

  constructor() {
    this.ensureConnection();
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await connectRedis();
        this.isConnected = true;
        logger.info('Analytics Service initialized');
      } catch (error) {
        logger.error('Failed to connect Redis for analytics', error as Error);
      }
    }
  }

  /**
   * Increment counter
   */
  async incrementCounter(key: string, amount: number = 1): Promise<number> {
    await this.ensureConnection();

    try {
      const newValue = await redisClient.incrBy(key, amount);

      logger.debug('Counter incremented', { key, amount, newValue });

      return newValue;
    } catch (error) {
      logger.error('Counter increment error', error, { key });
      return 0;
    }
  }

  /**
   * Get counter value
   */
  async getCounter(key: string): Promise<number> {
    await this.ensureConnection();

    try {
      const value = await redisClient.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      logger.error('Counter get error', error, { key });
      return 0;
    }
  }

  /**
   * Add score to sorted set (for leaderboards)
   */
  async addScore(
    leaderboard: string,
    member: string,
    score: number,
    increment: boolean = false
  ): Promise<void> {
    await this.ensureConnection();

    try {
      if (increment) {
        await redisClient.zIncrBy(leaderboard, score, member);
      } else {
        await redisClient.zAdd(leaderboard, { score, value: member });
      }

      logger.debug('Score added to leaderboard', { leaderboard, member, score });
    } catch (error) {
      logger.error('Add score error', error, { leaderboard, member });
    }
  }

  /**
   * Get top N entries from leaderboard
   */
  async getTopScores(
    leaderboard: string,
    limit: number = 10,
    reverse: boolean = true
  ): Promise<LeaderboardEntry[]> {
    await this.ensureConnection();

    try {
      const results = reverse
        ? await redisClient.zRangeWithScores(leaderboard, 0, limit - 1, { REV: true })
        : await redisClient.zRangeWithScores(leaderboard, 0, limit - 1);

      return results.map((entry, index) => ({
        id: entry.value,
        score: entry.score,
        rank: index + 1,
      }));
    } catch (error) {
      logger.error('Get top scores error', error, { leaderboard });
      return [];
    }
  }

  /**
   * Get member rank and score
   */
  async getMemberRank(
    leaderboard: string,
    member: string
  ): Promise<{ rank: number; score: number } | null> {
    await this.ensureConnection();

    try {
      const [rank, score] = await Promise.all([
        redisClient.zRevRank(leaderboard, member),
        redisClient.zScore(leaderboard, member),
      ]);

      if (rank === null || score === null) {
        return null;
      }

      return {
        rank: rank + 1, // Redis ranks are 0-based
        score,
      };
    } catch (error) {
      logger.error('Get member rank error', error, { leaderboard, member });
      return null;
    }
  }

  /**
   * Get leaderboard size
   */
  async getLeaderboardSize(leaderboard: string): Promise<number> {
    await this.ensureConnection();

    try {
      return await redisClient.zCard(leaderboard);
    } catch (error) {
      logger.error('Get leaderboard size error', error, { leaderboard });
      return 0;
    }
  }

  /**
   * Record time series data point
   */
  async recordTimeSeries(key: string, value: number, timestamp?: number): Promise<void> {
    await this.ensureConnection();

    const ts = timestamp || Date.now();

    try {
      // Store as sorted set with timestamp as score
      await redisClient.zAdd(key, { score: ts, value: `${ts}:${value}` });

      // Keep only last 24 hours of data
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      await redisClient.zRemRangeByScore(key, 0, cutoff);

      logger.debug('Time series recorded', { key, value, timestamp: ts });
    } catch (error) {
      logger.error('Record time series error', error, { key });
    }
  }

  /**
   * Get time series data
   */
  async getTimeSeries(
    key: string,
    startTime?: number,
    endTime?: number
  ): Promise<TimeSeriesPoint[]> {
    await this.ensureConnection();

    const start = startTime || Date.now() - 24 * 60 * 60 * 1000; // Last 24h
    const end = endTime || Date.now();

    try {
      const results = await redisClient.zRangeByScore(key, start, end);

      return results.map((entry) => {
        const [timestamp, value] = entry.split(':');
        return {
          timestamp: parseInt(timestamp, 10),
          value: parseFloat(value),
        };
      });
    } catch (error) {
      logger.error('Get time series error', error, { key });
      return [];
    }
  }

  /**
   * Get aggregated time series (hourly buckets)
   */
  async getAggregatedTimeSeries(
    key: string,
    bucketSizeMs: number = 3600000 // 1 hour
  ): Promise<TimeSeriesPoint[]> {
    const data = await this.getTimeSeries(key);

    // Group by bucket
    const buckets = new Map<number, number[]>();

    data.forEach((point) => {
      const bucket = Math.floor(point.timestamp / bucketSizeMs) * bucketSizeMs;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket)!.push(point.value);
    });

    // Calculate averages
    return Array.from(buckets.entries())
      .map(([timestamp, values]) => ({
        timestamp,
        value: values.reduce((a, b) => a + b, 0) / values.length,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}

// Export singleton
export const analytics = new AnalyticsService();

/**
 * Predefined Analytics
 */
export const ExecutionAnalytics = {
  /**
   * Record workflow execution
   */
  async recordExecution(workflowId: string, success: boolean): Promise<void> {
    await analytics.incrementCounter(`execution:total:${workflowId}`);

    if (success) {
      await analytics.incrementCounter(`execution:success:${workflowId}`);
      await analytics.addScore('workflows:success-rate', workflowId, 1, true);
    } else {
      await analytics.incrementCounter(`execution:failed:${workflowId}`);
    }

    // Record in time series
    await analytics.recordTimeSeries(`execution:timeseries:${workflowId}`, success ? 1 : 0);
  },

  /**
   * Get workflow execution stats
   */
  async getStats(workflowId: string): Promise<{
    total: number;
    success: number;
    failed: number;
    successRate: number;
  }> {
    const [total, success, failed] = await Promise.all([
      analytics.getCounter(`execution:total:${workflowId}`),
      analytics.getCounter(`execution:success:${workflowId}`),
      analytics.getCounter(`execution:failed:${workflowId}`),
    ]);

    return {
      total,
      success,
      failed,
      successRate: total > 0 ? (success / total) * 100 : 0,
    };
  },

  /**
   * Get top workflows by execution count
   */
  async getTopWorkflows(limit: number = 10): Promise<LeaderboardEntry[]> {
    return analytics.getTopScores('workflows:execution-count', limit);
  },
};

export const UserAnalytics = {
  /**
   * Record user activity
   */
  async recordActivity(userId: string, activityType: string): Promise<void> {
    await analytics.incrementCounter(`user:activity:${userId}:${activityType}`);
    await analytics.addScore('users:activity-score', userId, 1, true);
    await analytics.recordTimeSeries(`user:activity:timeseries:${userId}`, 1);
  },

  /**
   * Get most active users
   */
  async getMostActive(limit: number = 10): Promise<LeaderboardEntry[]> {
    return analytics.getTopScores('users:activity-score', limit);
  },
};

export const ConnectorAnalytics = {
  /**
   * Record connector usage
   */
  async recordUsage(connectorId: string, responseTime: number): Promise<void> {
    await analytics.incrementCounter(`connector:usage:${connectorId}`);
    await analytics.addScore('connectors:usage', connectorId, 1, true);
    await analytics.recordTimeSeries(`connector:response-time:${connectorId}`, responseTime);
  },

  /**
   * Get most used connectors
   */
  async getMostUsed(limit: number = 10): Promise<LeaderboardEntry[]> {
    return analytics.getTopScores('connectors:usage', limit);
  },

  /**
   * Get connector response time trend
   */
  async getResponseTimeTrend(connectorId: string): Promise<TimeSeriesPoint[]> {
    return analytics.getAggregatedTimeSeries(
      `connector:response-time:${connectorId}`,
      3600000 // 1 hour buckets
    );
  },
};
