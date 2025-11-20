// Real-time monitoring and alerting service
import { EventEmitter } from 'events';

import { logger } from '../utils/logger';

export interface MonitoringConfig {
  enabled: boolean;
  realTimeEnabled: boolean;
  alertingEnabled: boolean;
  retentionDays: number;
  samplingRate: number;
  thresholds: MonitoringThresholds;
}

export interface MonitoringThresholds {
  cpu: { warning: number; critical: number };
  memory: { warning: number; critical: number };
  errorRate: { warning: number; critical: number };
  latency: { warning: number; critical: number };
  cost: { warning: number; critical: number };
}

export interface Metric {
  id: string;
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
  projectId: string;
  executionId?: string;
}

export interface Alert {
  id: string;
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'firing' | 'resolved' | 'silenced';
  rule: AlertRule;
  metrics: Metric[];
  triggeredAt: Date;
  resolvedAt?: Date;
  projectId: string;
  executionId?: string;
  metadata: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  query: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'critical';
  duration: number; // seconds
  cooldown: number; // seconds
  enabled: boolean;
  notifications: NotificationChannel[];
}

export interface AlertCondition {
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  threshold: number;
  aggregation: 'avg' | 'sum' | 'min' | 'max' | 'count';
  timeWindow: number; // seconds
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  projectId: string;
  panels: DashboardPanel[];
  timeRange: TimeRange;
  refreshInterval: number;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'gauge' | 'table' | 'heatmap';
  query: string;
  position: { x: number; y: number; width: number; height: number };
  config: Record<string, any>;
}

export interface TimeRange {
  from: Date;
  to: Date;
  relative?: string; // e.g., 'last_1h', 'last_24h'
}

export interface MonitoringData {
  metrics: Metric[];
  alerts: Alert[];
  healthStatus: HealthStatus;
  performance: PerformanceMetrics;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  uptime: number;
  lastCheck: Date;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  errorRate: number;
  lastCheck: Date;
}

export interface PerformanceMetrics {
  executionRate: number;
  successRate: number;
  averageLatency: number;
  throughput: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
}

export class MonitoringService extends EventEmitter {
  private db: any;

  private config: MonitoringConfig;

  private metrics: Map<string, Metric[]> = new Map();

  private alerts: Map<string, Alert> = new Map();

  private alertRules: Map<string, AlertRule> = new Map();

  private notificationChannels: Map<string, NotificationChannel> = new Map();

  constructor(db: any, config: MonitoringConfig) {
    super();
    this.db = db;
    this.config = config;

    if (config.enabled) {
      this.startMonitoring();
    }
  }

  // ============================================================================
  // METRICS COLLECTION
  // ============================================================================

  async recordMetric(metric: Omit<Metric, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const fullMetric: Metric = {
        id: MonitoringService.generateId(),
        timestamp: new Date(),
        ...metric,
      };

      // Store in memory for real-time access
      const projectMetrics = this.metrics.get(metric.projectId) || [];
      projectMetrics.push(fullMetric);

      // Keep only recent metrics in memory
      const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
      const recentMetrics = projectMetrics.filter((m) => m.timestamp > cutoff);
      this.metrics.set(metric.projectId, recentMetrics);

      // Store in database with sampling
      if (Math.random() < this.config.samplingRate) {
        await this.db.metrics.create(fullMetric);
      }

      // Emit real-time event
      if (this.config.realTimeEnabled) {
        this.emit('metric', fullMetric);
      }

      // Check alert rules
      if (this.config.alertingEnabled) {
        await this.checkAlertRules(fullMetric);
      }

      logger.debug('Metric recorded', {
        name: metric.name,
        value: metric.value,
        projectId: metric.projectId,
      });
    } catch (error) {
      logger.error('Failed to record metric', error as Error);
    }
  }

  async getMetrics(
    projectId: string,
    query: {
      names?: string[];
      timeRange: TimeRange;
      aggregation?: 'avg' | 'sum' | 'min' | 'max';
      groupBy?: string[];
      limit?: number;
    }
  ): Promise<Metric[]> {
    try {
      // Try memory first for recent data
      if (query.timeRange.from > new Date(Date.now() - 60 * 60 * 1000)) {
        const memoryMetrics = this.metrics.get(projectId) || [];
        const filtered = memoryMetrics.filter(
          (m) =>
            m.timestamp >= query.timeRange.from &&
            m.timestamp <= query.timeRange.to &&
            (!query.names || query.names.includes(m.name))
        );

        if (filtered.length > 0) {
          return MonitoringService.aggregateMetrics(filtered, query);
        }
      }

      // Fallback to database
      const metrics = await this.db.metrics.find({
        projectId,
        timestamp: {
          gte: query.timeRange.from,
          lte: query.timeRange.to,
        },
        name: query.names ? { in: query.names } : undefined,
        limit: query.limit || 1000,
      });

      return MonitoringService.aggregateMetrics(metrics, query);
    } catch (error) {
      logger.error('Failed to get metrics', error as Error);
      return [];
    }
  }

  // ============================================================================
  // ALERTING SYSTEM
  // ============================================================================

  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    try {
      const alertRule: AlertRule = {
        id: MonitoringService.generateId(),
        ...rule,
      };

      await this.db.alertRules.create(alertRule);
      this.alertRules.set(alertRule.id, alertRule);

      logger.info('Alert rule created', {
        ruleId: alertRule.id,
        name: alertRule.name,
        severity: alertRule.severity,
      });

      return alertRule;
    } catch (error) {
      logger.error('Failed to create alert rule', error as Error);
      throw error;
    }
  }

  async checkAlertRules(metric: Metric): Promise<void> {
    try {
      const enabledRules = Array.from(this.alertRules.values()).filter((rule) => rule.enabled);

      const evaluationPromises = enabledRules.map(async (rule) => {
        const shouldTrigger = await MonitoringService.evaluateAlertRule(rule, metric);
        if (shouldTrigger) {
          return this.triggerAlert(rule, [metric]);
        }
        return null;
      });

      await Promise.allSettled(evaluationPromises);
    } catch (error) {
      logger.error('Failed to check alert rules', error as Error);
    }
  }

  async triggerAlert(rule: AlertRule, metrics: Metric[]): Promise<Alert> {
    try {
      const existingAlert = Array.from(this.alerts.values()).find(
        (a) => a.rule.id === rule.id && a.status === 'firing'
      );

      if (existingAlert) {
        // Update existing alert
        existingAlert.metrics = metrics;
        existingAlert.metadata.lastTriggered = new Date();
        return existingAlert;
      }

      // Create new alert
      const alert: Alert = {
        id: MonitoringService.generateId(),
        name: rule.name,
        description: rule.name,
        severity: rule.severity,
        status: 'firing',
        rule,
        metrics,
        triggeredAt: new Date(),
        projectId: metrics[0]?.projectId || '',
        executionId: metrics[0]?.executionId,
        metadata: {
          ruleId: rule.id,
          triggerCount: 1,
        },
      };

      // Store alert
      await this.db.alerts.create(alert);
      this.alerts.set(alert.id, alert);

      // Send notifications
      await MonitoringService.sendAlertNotifications(alert);

      // Emit real-time event
      this.emit('alert', alert);

      logger.warn('Alert triggered', {
        alertId: alert.id,
        ruleName: rule.name,
        severity: alert.severity,
        projectId: alert.projectId,
      });

      return alert;
    } catch (error) {
      logger.error('Failed to trigger alert', error as Error);
      throw error;
    }
  }

  async resolveAlert(alertId: string, reason?: string): Promise<void> {
    try {
      const alert = this.alerts.get(alertId);
      if (!alert || alert.status !== 'firing') return;

      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      alert.metadata.resolveReason = reason;

      await this.db.alerts.update(alertId, alert);

      // Send resolution notification
      await MonitoringService.sendAlertResolutionNotifications(alert);

      // Emit real-time event
      this.emit('alertResolved', alert);

      logger.info('Alert resolved', {
        alertId,
        reason,
        duration: alert.resolvedAt.getTime() - alert.triggeredAt.getTime(),
      });
    } catch (error) {
      logger.error('Failed to resolve alert', error as Error);
    }
  }

  // ============================================================================
  // DASHBOARDS
  // ============================================================================

  async createDashboard(
    dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Dashboard> {
    try {
      const newDashboard: Dashboard = {
        id: MonitoringService.generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...dashboard,
      };

      await this.db.dashboards.create(newDashboard);

      logger.info('Dashboard created', {
        dashboardId: newDashboard.id,
        name: newDashboard.name,
        projectId: newDashboard.projectId,
      });

      return newDashboard;
    } catch (error) {
      logger.error('Failed to create dashboard', error as Error);
      throw error;
    }
  }

  async getDashboardData(dashboardId: string, timeRange: TimeRange): Promise<any> {
    try {
      const dashboard = await this.db.dashboards.findById(dashboardId);
      if (!dashboard) {
        throw new Error('Dashboard not found');
      }

      const panelPromises = dashboard.panels.map(async (panel: any) => {
        const metrics = await MonitoringService.queryMetrics(panel.query, timeRange);
        return {
          id: panel.id,
          data: {
            title: panel.title,
            type: panel.type,
            data: MonitoringService.formatPanelData(metrics, panel.type),
            config: panel.config,
          },
        };
      });

      const panelResults = await Promise.all(panelPromises);
      const panelData: Record<string, any> = {};
      panelResults.forEach(({ id, data }) => {
        panelData[id] = data;
      });

      return {
        dashboard,
        panels: panelData,
        timeRange,
        generatedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get dashboard data', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // HEALTH MONITORING
  // ============================================================================

  static async getHealthStatus(projectId: string): Promise<HealthStatus> {
    try {
      const services = await MonitoringService.checkServiceHealth(projectId);
      const overallStatus = MonitoringService.calculateOverallHealth(services);
      const uptime = await MonitoringService.calculateUptime(projectId);

      return {
        overall: overallStatus,
        services,
        uptime,
        lastCheck: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get health status', error as Error);
      return {
        overall: 'unhealthy',
        services: [],
        uptime: 0,
        lastCheck: new Date(),
      };
    }
  }

  async getPerformanceMetrics(
    projectId: string,
    timeRange: TimeRange
  ): Promise<PerformanceMetrics> {
    try {
      const metrics = await this.getMetrics(projectId, {
        names: [
          'execution_rate',
          'success_rate',
          'latency',
          'throughput',
          'cpu_usage',
          'memory_usage',
        ],
        timeRange,
      });

      return {
        executionRate: MonitoringService.getMetricValue(metrics, 'execution_rate', 'avg'),
        successRate: MonitoringService.getMetricValue(metrics, 'success_rate', 'avg'),
        averageLatency: MonitoringService.getMetricValue(metrics, 'latency', 'avg'),
        throughput: MonitoringService.getMetricValue(metrics, 'throughput', 'avg'),
        resourceUtilization: {
          cpu: MonitoringService.getMetricValue(metrics, 'cpu_usage', 'avg'),
          memory: MonitoringService.getMetricValue(metrics, 'memory_usage', 'avg'),
          storage: MonitoringService.getMetricValue(metrics, 'storage_usage', 'avg'),
          network: MonitoringService.getMetricValue(metrics, 'network_usage', 'avg'),
        },
      };
    } catch (error) {
      logger.error('Failed to get performance metrics', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // REAL-TIME MONITORING
  // ============================================================================

  startRealTimeMonitoring(projectId: string, callback: (data: MonitoringData) => void): () => void {
    const interval = setInterval(async () => {
      try {
        const timeRange: TimeRange = {
          from: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
          to: new Date(),
        };

        const [metrics, alerts, healthStatus, performance] = await Promise.all([
          this.getMetrics(projectId, { timeRange }),
          this.getActiveAlerts(projectId),
          MonitoringService.getHealthStatus(projectId),
          this.getPerformanceMetrics(projectId, timeRange),
        ]);

        callback({
          metrics,
          alerts,
          healthStatus,
          performance,
        });
      } catch (error) {
        logger.error('Real-time monitoring error', error as Error);
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private static generateId(): string {
    return `mon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startMonitoring(): void {
    // Start background monitoring tasks
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000); // Every hour
    setInterval(() => this.checkSystemHealth(), 30 * 1000); // Every 30 seconds
  }

  private async cleanupOldMetrics(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
      await this.db.metrics.deleteOlderThan(cutoff);

      // Clean up memory cache
      Array.from(this.metrics.entries()).forEach(([projectId, metrics]) => {
        const recentMetrics = metrics.filter((m) => m.timestamp > cutoff);
        this.metrics.set(projectId, recentMetrics);
      });
    } catch (error) {
      logger.error('Failed to cleanup old metrics', error as Error);
    }
  }

  private async checkSystemHealth(): Promise<void> {
    // Implement system health checks
    try {
      // Check database connectivity
      await this.db.ping();

      // Check memory usage
      const memoryUsage = process.memoryUsage();
      await this.recordMetric({
        name: 'system_memory_usage',
        type: 'gauge',
        value: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        labels: { component: 'monitoring_service' },
        projectId: 'system',
      });
    } catch (error) {
      logger.error('System health check failed', error as Error);
    }
  }

  private static aggregateMetrics(metrics: Metric[], query: any): Metric[] {
    if (!query.aggregation) return metrics;

    // Group metrics by name and labels
    const groups = new Map<string, Metric[]>();

    metrics.forEach((metric) => {
      const key = `${metric.name}:${JSON.stringify(metric.labels)}`;
      const group = groups.get(key) || [];
      group.push(metric);
      groups.set(key, group);
    });

    // Aggregate each group
    const aggregated: Metric[] = [];

    Array.from(groups.entries()).forEach(([, group]) => {
      let value: number;

      switch (query.aggregation) {
        case 'avg':
          value = group.reduce((sum, m) => sum + m.value, 0) / group.length;
          break;
        case 'sum':
          value = group.reduce((sum, m) => sum + m.value, 0);
          break;
        case 'min':
          value = Math.min(...group.map((m) => m.value));
          break;
        case 'max':
          value = Math.max(...group.map((m) => m.value));
          break;
        default:
          value = group[group.length - 1]?.value || 0;
      }

      aggregated.push({
        ...group[0],
        value,
        timestamp: new Date(),
      });
    });

    return aggregated;
  }

  private static async evaluateAlertRule(rule: AlertRule, metric: Metric): Promise<boolean> {
    try {
      // Get recent metrics for the rule's query
      const timeRange: TimeRange = {
        from: new Date(Date.now() - rule.condition.timeWindow * 1000),
        to: new Date(),
      };

      const metrics = await MonitoringService.queryMetrics(rule.query, timeRange);
      if (metrics.length === 0) return false;

      // Apply aggregation
      let value: number;
      switch (rule.condition.aggregation) {
        case 'avg':
          value = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
          break;
        case 'sum':
          value = metrics.reduce((sum, m) => sum + m.value, 0);
          break;
        case 'min':
          value = Math.min(...metrics.map((m) => m.value));
          break;
        case 'max':
          value = Math.max(...metrics.map((m) => m.value));
          break;
        case 'count':
          value = metrics.length;
          break;
        default:
          value = metrics[metrics.length - 1]?.value || 0;
      }

      // Evaluate condition
      switch (rule.condition.operator) {
        case '>':
          return value > rule.condition.threshold;
        case '<':
          return value < rule.condition.threshold;
        case '>=':
          return value >= rule.condition.threshold;
        case '<=':
          return value <= rule.condition.threshold;
        case '==':
          return value === rule.condition.threshold;
        case '!=':
          return value !== rule.condition.threshold;
        default:
          return false;
      }
    } catch (error) {
      logger.error('Failed to evaluate alert rule', error as Error);
      return false;
    }
  }

  private static async queryMetrics(query: string, timeRange: TimeRange): Promise<Metric[]> {
    // Implement metric query parsing and execution
    // For now, return empty array
    return [];
  }

  private static async sendAlertNotifications(alert: Alert): Promise<void> {
    const enabledChannels = alert.rule.notifications.filter((channel) => channel.enabled);

    await Promise.all(
      enabledChannels.map(async (channel) => {
        try {
          await MonitoringService.sendNotification(channel, alert);
        } catch (error) {
          logger.error('Failed to send alert notification', error as Error, {
            alertId: alert.id,
            channelType: channel.type,
          });
        }
      })
    );
  }

  private static async sendAlertResolutionNotifications(alert: Alert): Promise<void> {
    const enabledChannels = alert.rule.notifications.filter((channel) => channel.enabled);

    await Promise.all(
      enabledChannels.map(async (channel) => {
        try {
          await MonitoringService.sendResolutionNotification(channel, alert);
        } catch (error) {
          logger.error('Failed to send resolution notification', error as Error);
        }
      })
    );
  }

  private static async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Implement notification sending based on channel type
    logger.info('Sending alert notification', {
      channelType: channel.type,
      alertId: alert.id,
      severity: alert.severity,
    });
  }

  private static async sendResolutionNotification(
    channel: NotificationChannel,
    alert: Alert
  ): Promise<void> {
    // Implement resolution notification sending
    logger.info('Sending resolution notification', {
      channelType: channel.type,
      alertId: alert.id,
    });
  }

  private static async checkServiceHealth(projectId: string): Promise<ServiceHealth[]> {
    // Implement service health checks
    return [
      {
        name: 'orchestrator',
        status: 'healthy',
        latency: 50,
        errorRate: 0.01,
        lastCheck: new Date(),
      },
      {
        name: 'database',
        status: 'healthy',
        latency: 10,
        errorRate: 0,
        lastCheck: new Date(),
      },
    ];
  }

  private static calculateOverallHealth(
    services: ServiceHealth[]
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const unhealthyCount = services.filter((s) => s.status === 'unhealthy').length;
    const degradedCount = services.filter((s) => s.status === 'degraded').length;

    if (unhealthyCount > 0) return 'unhealthy';
    if (degradedCount > 0) return 'degraded';
    return 'healthy';
  }

  private static async calculateUptime(projectId: string): Promise<number> {
    // Calculate uptime percentage
    return 99.9;
  }

  private static getMetricValue(metrics: Metric[], name: string, aggregation: string): number {
    const filtered = metrics.filter((m) => m.name === name);
    if (filtered.length === 0) return 0;

    switch (aggregation) {
      case 'avg':
        return filtered.reduce((sum, m) => sum + m.value, 0) / filtered.length;
      case 'sum':
        return filtered.reduce((sum, m) => sum + m.value, 0);
      case 'min':
        return Math.min(...filtered.map((m) => m.value));
      case 'max':
        return Math.max(...filtered.map((m) => m.value));
      default:
        return filtered[filtered.length - 1].value;
    }
  }

  private async getActiveAlerts(projectId: string): Promise<Alert[]> {
    return Array.from(this.alerts.values()).filter(
      (a) => a.projectId === projectId && a.status === 'firing'
    );
  }

  private static formatPanelData(metrics: Metric[], panelType: string): any {
    // Format metrics data based on panel type
    switch (panelType) {
      case 'line':
        return metrics.map((m) => ({ x: m.timestamp, y: m.value }));
      case 'bar':
        return metrics.map((m) => ({ label: m.name, value: m.value }));
      case 'pie':
        return metrics.map((m) => ({ name: m.name, value: m.value }));
      default:
        return metrics;
    }
  }
}
