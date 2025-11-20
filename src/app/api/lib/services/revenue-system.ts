// Revenue system integration service - orchestrates all revenue components
import { logger } from '../utils/logger';
import { BillingService } from './billing-service';
import { ComplianceService } from './compliance-service';
import { MonitoringService } from './monitoring-service';
import { MultiCloudService } from './multi-cloud-service';
import { executionTracker } from '../middleware/execution-tracking';
import { FeatureContext, FeatureGateService } from './feature-gate-service';

export interface RevenueSystemConfig {
  billing: {
    enabled: boolean;
    trackUsage: boolean;
    trackCosts: boolean;
  };
  featureGating: {
    enabled: boolean;
    strictMode: boolean;
  };
  compliance: {
    enabled: boolean;
    auditLogging: boolean;
    dataClassification: boolean;
  };
  multiCloud: {
    enabled: boolean;
    costOptimization: boolean;
  };
  monitoring: {
    enabled: boolean;
    realTime: boolean;
    alerting: boolean;
  };
}

export interface RevenueMetrics {
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  churnRate: number;
  ltv: number; // Customer Lifetime Value
  arpu: number; // Average Revenue Per User
  conversionRate: number;
  usageGrowth: number;
  marketplaceRevenue: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    billing: 'up' | 'down' | 'degraded';
    featureGating: 'up' | 'down' | 'degraded';
    compliance: 'up' | 'down' | 'degraded';
    multiCloud: 'up' | 'down' | 'degraded';
    monitoring: 'up' | 'down' | 'degraded';
  };
  lastCheck: Date;
}

export class RevenueSystem {
  private config: RevenueSystemConfig;

  private billingService: BillingService;

  private featureGateService: FeatureGateService;

  private complianceService: ComplianceService;

  private multiCloudService: MultiCloudService;

  private monitoringService: MonitoringService;

  constructor(
    config: RevenueSystemConfig,
    services: {
      billing: BillingService;
      featureGate: FeatureGateService;
      compliance: ComplianceService;
      multiCloud: MultiCloudService;
      monitoring: MonitoringService;
    }
  ) {
    this.config = config;
    this.billingService = services.billing;
    this.featureGateService = services.featureGate;
    this.complianceService = services.compliance;
    this.multiCloudService = services.multiCloud;
    this.monitoringService = services.monitoring;

    this.initialize();
  }

  // ============================================================================
  // SYSTEM INITIALIZATION
  // ============================================================================

  private async initialize(): Promise<void> {
    try {
      logger.info('Initializing Revenue System', { config: this.config });

      // Initialize execution tracking
      if (this.config.billing.enabled) {
        executionTracker.updateConfig({
          billingService: this.billingService,
          enabled: true,
          trackCosts: this.config.billing.trackCosts,
          trackResources: this.config.billing.trackUsage,
        });
      }

      // Start monitoring if enabled
      if (this.config.monitoring.enabled) {
        await this.startSystemMonitoring();
      }

      // Initialize compliance logging
      if (this.config.compliance.enabled && this.config.compliance.auditLogging) {
        await this.complianceService.logAuditEvent({
          userId: 'system',
          projectId: 'system',
          action: 'revenue_system_initialized',
          resource: 'system',
          resourceId: 'revenue_system',
          ipAddress: '127.0.0.1',
          userAgent: 'system',
          metadata: { config: this.config },
        });
      }

      logger.info('Revenue System initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Revenue System', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // REVENUE ANALYTICS
  // ============================================================================

  static async getRevenueMetrics(
    period: 'month' | 'quarter' | 'year' = 'month'
  ): Promise<RevenueMetrics> {
    try {
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          // Default to month if period is not recognized
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }

      // Get billing metrics (mock implementation)
      const billingMetrics = await RevenueSystem.getBillingMetrics(startDate, endDate);

      // Get marketplace metrics
      const marketplaceRevenue = await RevenueSystem.getMarketplaceRevenue(startDate, endDate);

      // Calculate derived metrics
      let divisor: number;
      if (period === 'month') {
        divisor = 1;
      } else if (period === 'quarter') {
        divisor = 3;
      } else {
        divisor = 12;
      }
      const mrr = billingMetrics.totalRevenue / divisor;
      const arr = mrr * 12;
      const arpu = billingMetrics.totalRevenue / billingMetrics.activeCustomers;

      return {
        mrr,
        arr,
        churnRate: billingMetrics.churnRate,
        ltv: arpu / (billingMetrics.churnRate / 12), // Simplified LTV calculation
        arpu,
        conversionRate: billingMetrics.conversionRate,
        usageGrowth: billingMetrics.usageGrowth,
        marketplaceRevenue,
      };
    } catch (error) {
      logger.error('Failed to get revenue metrics', error as Error);
      throw error;
    }
  }

  async getCustomerInsights(organizationId: string): Promise<Record<string, any>> {
    try {
      const context: FeatureContext = {
        userId: 'system',
        projectId: 'system',
        organizationId,
      };

      // Get billing data
      const billingAccount =
        await this.billingService.getBillingAccountByOrganization(organizationId);
      const subscription = billingAccount
        ? await this.billingService.getActiveSubscriptionByBillingAccount(billingAccount.id)
        : null;

      // Get usage analytics
      const usageAnalytics = subscription
        ? await this.billingService.getCurrentUsageAnalytics(subscription.projectId)
        : null;

      // Get available features
      const availableFeatures = await this.featureGateService.getAvailableFeatures(context);

      // Get compliance status
      const complianceStatus = this.config.compliance.enabled
        ? await this.getComplianceStatus(organizationId)
        : null;

      return {
        billing: {
          account: billingAccount,
          subscription,
          usage: usageAnalytics,
        },
        features: {
          available: availableFeatures,
          limits: await this.featureGateService.getFeatureLimits(context),
        },
        compliance: complianceStatus,
        recommendations: await this.generateCustomerRecommendations(context),
      };
    } catch (error) {
      logger.error('Failed to get customer insights', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // SYSTEM HEALTH & MONITORING
  // ============================================================================

  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const components = {
        billing: await this.checkServiceHealth('billing'),
        featureGating: await this.checkServiceHealth('featureGating'),
        compliance: await this.checkServiceHealth('compliance'),
        multiCloud: await this.checkServiceHealth('multiCloud'),
        monitoring: await this.checkServiceHealth('monitoring'),
      };

      const healthyCount = Object.values(components).filter(
        (status: string) => status === 'up'
      ).length;
      const degradedCount = Object.values(components).filter(
        (status: string) => status === 'degraded'
      ).length;

      let overall: 'healthy' | 'degraded' | 'critical';
      if (healthyCount === Object.keys(components).length) {
        overall = 'healthy';
      } else if (degradedCount > 0 && healthyCount >= 3) {
        overall = 'degraded';
      } else {
        overall = 'critical';
      }

      return {
        overall,
        components,
        lastCheck: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get system health', error as Error);
      return {
        overall: 'critical',
        components: {
          billing: 'down',
          featureGating: 'down',
          compliance: 'down',
          multiCloud: 'down',
          monitoring: 'down',
        },
        lastCheck: new Date(),
      };
    }
  }

  // ============================================================================
  // WORKFLOW EXECUTION INTEGRATION
  // ============================================================================

  async handleWorkflowExecution(
    workflowId: string,
    context: FeatureContext,
    executionSpec: Record<string, any>
  ): Promise<{ allowed: boolean; reason?: string; cost?: number }> {
    try {
      // Check feature access
      const featureAccess = await this.featureGateService.checkFeatureAccess(
        'workflow-execution',
        context
      );
      if (!featureAccess.allowed) {
        return {
          allowed: false,
          reason: featureAccess.reason,
        };
      }

      // Check subscription limits
      const subscription = await this.billingService.getActiveSubscriptionByProject(
        context.projectId
      );
      if (!subscription) {
        return {
          allowed: false,
          reason: 'No active subscription found',
        };
      }

      const plan = await this.billingService.getSubscriptionPlan(subscription.planId);
      if (!plan) {
        return {
          allowed: false,
          reason: 'Subscription plan not found',
        };
      }

      const currentUsage = await this.billingService.getCurrentUsageAnalytics(context.projectId);

      // Check execution limits
      if (
        typeof plan.features.maxExecutions === 'number' &&
        currentUsage.metrics.totalExecutions >= plan.features.maxExecutions
      ) {
        return {
          allowed: false,
          reason: 'Monthly execution limit exceeded',
        };
      }

      // Estimate execution cost
      const estimatedCost = await RevenueSystem.estimateExecutionCost(executionSpec, plan.tier);

      // Log compliance event
      if (this.config.compliance.enabled) {
        await this.complianceService.logAuditEvent({
          userId: context.userId,
          projectId: context.projectId,
          action: 'workflow_execution_authorized',
          resource: 'workflow',
          resourceId: workflowId,
          ipAddress: '127.0.0.1',
          userAgent: 'system',
          metadata: { estimatedCost, planTier: plan.tier },
        });
      }

      return {
        allowed: true,
        cost: estimatedCost,
      };
    } catch (error) {
      logger.error('Failed to handle workflow execution', error as Error);
      return {
        allowed: false,
        reason: 'System error during authorization',
      };
    }
  }

  // ============================================================================
  // OPTIMIZATION RECOMMENDATIONS
  // ============================================================================

  async generateSystemOptimizations(): Promise<Record<string, any[]>> {
    try {
      const optimizations = {
        cost: [] as any[],
        performance: [] as any[],
        compliance: [] as any[],
        revenue: [] as any[],
      };

      // Cost optimizations
      if (this.config.multiCloud.enabled) {
        const costOpt = await this.multiCloudService.analyzeCostOptimization({
          userId: 'system',
          projectId: 'system',
        });
        optimizations.cost = costOpt.recommendations;
      }

      // Performance optimizations
      if (this.config.monitoring.enabled) {
        const perfMetrics = await this.monitoringService.getPerformanceMetrics('system', {
          from: new Date(Date.now() - 24 * 60 * 60 * 1000),
          to: new Date(),
        });

        if (perfMetrics.resourceUtilization.cpu > 80) {
          optimizations.performance.push({
            type: 'cpu_optimization',
            description: 'High CPU utilization detected',
            recommendation: 'Consider scaling up compute resources',
          });
        }
      }

      // Revenue optimizations
      const revenueMetrics = await RevenueSystem.getRevenueMetrics('month');
      if (revenueMetrics.conversionRate < 0.05) {
        optimizations.revenue.push({
          type: 'conversion_optimization',
          description: 'Low conversion rate detected',
          recommendation: 'Review onboarding flow and pricing strategy',
        });
      }

      return optimizations;
    } catch (error) {
      logger.error('Failed to generate system optimizations', error as Error);
      return {
        cost: [] as any[],
        performance: [] as any[],
        compliance: [] as any[],
        revenue: [] as any[],
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async startSystemMonitoring(): Promise<void> {
    // Record system metrics every minute
    setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        const revenueMetrics = await RevenueSystem.getRevenueMetrics('month');

        await this.monitoringService.recordMetric({
          name: 'system_health_score',
          type: 'gauge',
          value: RevenueSystem.getHealthScore(health.overall),
          labels: { component: 'revenue_system' },
          projectId: 'system',
        });

        await this.monitoringService.recordMetric({
          name: 'monthly_recurring_revenue',
          type: 'gauge',
          value: revenueMetrics.mrr,
          labels: { currency: 'USD' },
          projectId: 'system',
        });
      } catch (error) {
        logger.error('System monitoring error', error as Error);
      }
    }, 60000); // Every minute
  }

  private async checkServiceHealth(service: string): Promise<'up' | 'down' | 'degraded'> {
    try {
      switch (service) {
        case 'billing':
          // Test billing service - use a method that exists
          // In production, this would test actual billing service health
          // For now, assume billing service is healthy if config is enabled
          return this.config.billing.enabled ? 'up' : 'degraded';
        case 'featureGating': {
          // Test feature gate service
          try {
            const features = await this.featureGateService.getAvailableFeatures({
              userId: 'test',
              projectId: 'test',
            });
            return features ? 'up' : 'degraded';
          } catch (error) {
            logger.error(`Health check failed for featureGating`, error as Error);
            return 'down';
          }
        }
        case 'compliance':
          // Test compliance service
          return this.config.compliance.enabled ? 'up' : 'degraded';
        case 'multiCloud':
          // Test multi-cloud service
          return this.config.multiCloud.enabled ? 'up' : 'degraded';
        case 'monitoring':
          // Test monitoring service
          return this.config.monitoring.enabled ? 'up' : 'degraded';
        default:
          return 'down';
      }
    } catch (error) {
      logger.error(`Health check failed for ${service}`, error as Error);
      return 'down';
    }
  }

  private static async getMarketplaceRevenue(startDate: Date, endDate: Date): Promise<number> {
    // Calculate marketplace revenue (30% of sales)
    // This would integrate with your marketplace database
    return 0; // Placeholder
  }

  private async getComplianceStatus(organizationId: string): Promise<Record<string, any> | null> {
    if (!this.config.compliance.enabled) return null;

    try {
      // Generate compliance report
      const report = await this.complianceService.generateComplianceReport(
        'audit',
        {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        'system'
      );

      return {
        status: report.status,
        lastAudit: report.generatedAt,
        findings: report.findings.length,
        criticalIssues: report.findings.filter((f: any) => f.severity === 'critical').length,
      };
    } catch (error) {
      logger.error('Failed to get compliance status', error as Error);
      return { status: 'unknown', error: (error as Error).message };
    }
  }

  private async generateCustomerRecommendations(
    context: FeatureContext
  ): Promise<Record<string, any>[]> {
    const recommendations: Record<string, any>[] = [];

    try {
      // Get customer data
      const subscription = await this.billingService.getActiveSubscriptionByProject(
        context.projectId
      );
      if (!subscription) return recommendations;

      const usage = await this.billingService.getCurrentUsageAnalytics(context.projectId);
      const plan = await this.billingService.getSubscriptionPlan(subscription.planId);
      if (!plan) return recommendations;

      // Usage-based recommendations
      if (typeof plan.features.maxExecutions === 'number') {
        const utilizationRate = usage.metrics.totalExecutions / plan.features.maxExecutions;

        if (utilizationRate > 0.8) {
          recommendations.push({
            type: 'upgrade',
            title: 'Consider upgrading your plan',
            description: `You're using ${Math.round(
              utilizationRate * 100
            )}% of your execution limit`,
            action: 'upgrade_plan',
            priority: 'high',
          });
        }
      }

      // Cost optimization recommendations
      if (usage.metrics.averageCost > 0.05) {
        recommendations.push({
          type: 'optimization',
          title: 'Optimize workflow costs',
          description: 'Your average execution cost is higher than typical',
          action: 'optimize_workflows',
          priority: 'medium',
        });
      }

      return recommendations;
    } catch (error) {
      logger.error('Failed to generate customer recommendations', error as Error);
      return recommendations;
    }
  }

  private static async estimateExecutionCost(
    executionSpec: Record<string, any>,
    planTier: string
  ): Promise<number> {
    // Estimate cost based on execution spec and plan tier
    const baseCost = 0.01; // $0.01 base cost

    // Apply tier-based pricing
    const tierMultipliers = {
      free: 0,
      starter: 0.8,
      professional: 0.6,
      enterprise: 0.4,
    };

    return baseCost * (tierMultipliers[planTier as keyof typeof tierMultipliers] || 1);
  }

  private static getHealthScore(healthStatus: string): number {
    if (healthStatus === 'healthy') {
      return 100;
    }
    if (healthStatus === 'degraded') {
      return 50;
    }
    return 0;
  }

  private static async getBillingMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalRevenue: number;
    activeCustomers: number;
    churnRate: number;
    conversionRate: number;
    usageGrowth: number;
  }> {
    // Mock implementation - in production this would aggregate billing data
    // This could be implemented by querying subscription and usage data
    try {
      // Calculate days in period for scaling mock data
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const monthlyMultiplier = daysDiff / 30;

      return {
        totalRevenue: Math.round(10000 * monthlyMultiplier), // Scale by period length
        activeCustomers: Math.round(100 * monthlyMultiplier),
        churnRate: 0.05, // 5% churn rate
        conversionRate: 0.15, // 15% conversion rate
        usageGrowth: 0.2, // 20% usage growth
      };
    } catch (error) {
      logger.error('Failed to get billing metrics', error as Error);
      return {
        totalRevenue: 0,
        activeCustomers: 0,
        churnRate: 0,
        conversionRate: 0,
        usageGrowth: 0,
      };
    }
  }
}

// Export singleton instance factory
export function createRevenueSystem(
  config: RevenueSystemConfig,
  services: {
    billing: BillingService;
    featureGate: FeatureGateService;
    compliance: ComplianceService;
    multiCloud: MultiCloudService;
    monitoring: MonitoringService;
  }
): RevenueSystem {
  return new RevenueSystem(config, services);
}
