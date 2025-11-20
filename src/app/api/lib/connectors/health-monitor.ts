/**
 * Connector Health Monitor
 * Monitors connector health and performs periodic health checks
 */

import { logger } from '../utils/logger';
import {
  IHealthMonitor,
  HealthCheckResult,
  AuthenticationConfig,
  ConnectorConfiguration,
} from './types';

/**
 * Health check history entry
 */
interface HealthHistoryEntry extends HealthCheckResult {
  connectorId: string;
}

/**
 * Scheduled health check
 */
interface ScheduledCheck {
  connectorId: string;
  interval: number;
  timer: NodeJS.Timeout;
  lastCheck?: Date;
}

/**
 * Health Monitor Implementation
 */
export class ConnectorHealthMonitor implements IHealthMonitor {
  private scheduledChecks: Map<string, ScheduledCheck>;

  private healthHistory: Map<string, HealthHistoryEntry[]>;

  private readonly MAX_HISTORY_PER_CONNECTOR = 100;

  constructor() {
    this.scheduledChecks = new Map();
    this.healthHistory = new Map();
  }

  /**
   * Check connector health
   */
  async checkHealth(
    connectorId: string,
    config: ConnectorConfiguration,
    auth?: AuthenticationConfig
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    logger.debug('Checking connector health', { connectorId, type: config.type });

    try {
      // Perform type-specific health checks
      const result = await ConnectorHealthMonitor.performHealthCheck(config, auth);

      const responseTime = Date.now() - startTime;

      const healthResult: HealthCheckResult = {
        status: result.success ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        error: result.error,
        details: result.details,
      };

      // Store in history
      this.addToHistory(connectorId, healthResult);

      logger.info('Health check completed', {
        connectorId,
        status: healthResult.status,
        responseTime,
      });

      return healthResult;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      const healthResult: HealthCheckResult = {
        status: 'unhealthy',
        lastCheck: new Date(),
        responseTime,
        error: error.message || 'Health check failed',
        details: { errorType: error.name },
      };

      // Store in history
      this.addToHistory(connectorId, healthResult);

      logger.error('Health check failed', error, {
        connectorId,
        responseTime,
      });

      return healthResult;
    }
  }

  /**
   * Schedule periodic health checks
   */
  scheduleHealthCheck(connectorId: string, interval: number): void {
    // Cancel existing check if any
    this.cancelHealthCheck(connectorId);

    logger.info('Scheduling health check', { connectorId, interval });

    // Create scheduled check
    const timer = setInterval(async () => {
      try {
        // Health check will be performed by the main connector service
        // This just triggers the check
        logger.debug('Scheduled health check triggered', { connectorId });
      } catch (error) {
        logger.error('Scheduled health check error', error);
      }
    }, interval * 1000);

    // Prevent the timer from keeping the process alive
    if (timer.unref) {
      timer.unref();
    }

    const scheduledCheck: ScheduledCheck = {
      connectorId,
      interval,
      timer,
      lastCheck: new Date(),
    };

    this.scheduledChecks.set(connectorId, scheduledCheck);
  }

  /**
   * Cancel scheduled health check
   */
  cancelHealthCheck(connectorId: string): void {
    const check = this.scheduledChecks.get(connectorId);

    if (check) {
      clearInterval(check.timer);
      this.scheduledChecks.delete(connectorId);
      logger.info('Health check cancelled', { connectorId });
    }
  }

  /**
   * Get health check history for a connector
   */
  async getHealthHistory(connectorId: string, limit: number = 10): Promise<HealthCheckResult[]> {
    const history = this.healthHistory.get(connectorId) || [];
    return history.slice(-limit).reverse(); // Return most recent first
  }

  /**
   * Get health statistics
   */
  getHealthStats(connectorId: string): {
    totalChecks: number;
    healthyChecks: number;
    unhealthyChecks: number;
    averageResponseTime: number;
    uptime: number; // Percentage
    lastCheck?: Date;
    lastHealthyCheck?: Date;
  } {
    const history = this.healthHistory.get(connectorId) || [];

    if (history.length === 0) {
      return {
        totalChecks: 0,
        healthyChecks: 0,
        unhealthyChecks: 0,
        averageResponseTime: 0,
        uptime: 0,
      };
    }

    const healthyChecks = history.filter((h) => h.status === 'healthy').length;
    const unhealthyChecks = history.filter((h) => h.status === 'unhealthy').length;

    const totalResponseTime = history.reduce((sum, h) => sum + (h.responseTime || 0), 0);
    const averageResponseTime = totalResponseTime / history.length;

    const uptime = (healthyChecks / history.length) * 100;

    const lastCheck = history[history.length - 1]?.lastCheck;
    const lastHealthyCheck = history
      .slice()
      .reverse()
      .find((h) => h.status === 'healthy')?.lastCheck;

    return {
      totalChecks: history.length,
      healthyChecks,
      unhealthyChecks,
      averageResponseTime,
      uptime,
      lastCheck,
      lastHealthyCheck,
    };
  }

  /**
   * Clear health history for a connector
   */
  clearHistory(connectorId: string): void {
    this.healthHistory.delete(connectorId);
    logger.info('Health history cleared', { connectorId });
  }

  /**
   * Clear all health data
   */
  clearAll(): void {
    // Cancel all scheduled checks
    const checkEntries = Array.from(this.scheduledChecks.entries());
    for (let i = 0; i < checkEntries.length; i += 1) {
      const [connectorId] = checkEntries[i];
      this.cancelHealthCheck(connectorId);
    }

    // Clear history
    this.healthHistory.clear();

    logger.info('All health data cleared');
  }

  /**
   * Perform type-specific health check
   */
  private static async performHealthCheck(
    config: ConnectorConfiguration,
    auth?: AuthenticationConfig
  ): Promise<{ success: boolean; error?: string; details?: any }> {
    switch (config.type) {
      case 'rest_api':
        return ConnectorHealthMonitor.checkRestApiHealth(config, auth);

      case 'database':
        return ConnectorHealthMonitor.checkDatabaseHealth(config);

      case 'flyte_workflow':
        return ConnectorHealthMonitor.checkFlyteWorkflowHealth(config);

      case 'graphql':
        return ConnectorHealthMonitor.checkGraphQLHealth(config, auth);

      case 'cloud_storage':
        return ConnectorHealthMonitor.checkCloudStorageHealth(config, auth);

      default:
        return {
          success: false,
          error: `Health check not implemented for connector type: ${config.type}`,
        };
    }
  }

  /**
   * Check REST API health
   */
  private static async checkRestApiHealth(
    config: any,
    auth?: AuthenticationConfig
  ): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const url = `${config.baseUrl}${config.endpoint || '/'}`;
      const headers = ConnectorHealthMonitor.buildHeaders(config.headers, auth);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout || 10000);

      const response = await fetch(url, {
        method: 'HEAD', // Use HEAD for health check
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      return {
        success: response.ok,
        details: {
          statusCode: response.status,
          statusText: response.statusText,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        details: { errorType: error.name },
      };
    }
  }

  /**
   * Check Database health
   */
  private static async checkDatabaseHealth(
    config: any
  ): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      // For database health, we just verify the connection string format
      // Actual connection testing should be done by the database executor
      if (!config.connectionString && (!config.host || !config.database)) {
        return {
          success: false,
          error: 'Invalid database configuration',
        };
      }

      return {
        success: true,
        details: {
          databaseType: config.databaseType,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check Flyte Workflow health
   */
  private static async checkFlyteWorkflowHealth(
    config: any
  ): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      // Verify workflow configuration
      if (!config.project || !config.domain || !config.workflowName) {
        return {
          success: false,
          error: 'Invalid Flyte workflow configuration',
        };
      }

      return {
        success: true,
        details: {
          project: config.project,
          domain: config.domain,
          workflow: config.workflowName,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check GraphQL health
   */
  private static async checkGraphQLHealth(
    config: any,
    auth?: AuthenticationConfig
  ): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const headers = ConnectorHealthMonitor.buildHeaders({}, auth);

      // Use introspection query for health check
      const introspectionQuery = '{ __schema { queryType { name } } }';

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeout || 10000);

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: introspectionQuery }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      return {
        success: response.ok,
        details: {
          statusCode: response.status,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check Cloud Storage health
   */
  private static async checkCloudStorageHealth(
    config: any,
    auth?: AuthenticationConfig
  ): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      // Basic configuration validation
      if (!config.bucket) {
        return {
          success: false,
          error: 'Invalid cloud storage configuration',
        };
      }

      return {
        success: true,
        details: {
          provider: config.provider,
          bucket: config.bucket,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Build request headers with authentication
   */
  private static buildHeaders(
    baseHeaders: Record<string, string> = {},
    auth?: AuthenticationConfig
  ): Record<string, string> {
    const headers = { ...baseHeaders };

    if (!auth || auth.type === 'none') {
      return headers;
    }

    switch (auth.type) {
      case 'bearer':
        headers.Authorization = `Bearer ${auth.token}`;
        break;

      case 'api_key':
        if (auth.location === 'header') {
          const headerName = auth.headerName || 'X-API-Key';
          headers[headerName] = auth.key;
        }
        break;

      case 'basic': {
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers.Authorization = `Basic ${credentials}`;
        break;
      }

      case 'custom':
        if (auth.headers) {
          Object.assign(headers, auth.headers);
        }
        break;

      default:
        break;
    }

    return headers;
  }

  /**
   * Add health check result to history
   */
  private addToHistory(connectorId: string, result: HealthCheckResult): void {
    const history = this.healthHistory.get(connectorId) || [];

    history.push({
      connectorId,
      ...result,
    });

    // Keep only the last N entries
    if (history.length > this.MAX_HISTORY_PER_CONNECTOR) {
      history.shift();
    }

    this.healthHistory.set(connectorId, history);
  }

  /**
   * Shutdown cleanup
   */
  destroy(): void {
    this.clearAll();
  }
}

// Export singleton instance
export const healthMonitor = new ConnectorHealthMonitor();
