// Customer billing dashboard API endpoint
import { z } from 'zod';

import { logger } from '../../../lib/utils/logger';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { BillingService } from '../../../lib/services/billing-service';
import { createSingleMethodHandler } from '../../../lib/handlers/base';
import { FeatureGateService } from '../../../lib/services/feature-gate-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';
import { BillingAlert, SubscriptionPlan, BillingDashboardData } from '../../../lib/types/billing';

// Validation schema
const dashboardQuerySchema = z.object({
  projectId: z.string().optional(),
  period: z.enum(['current', 'last_month', 'last_quarter']).default('current'),
  includeForecasts: z.boolean().default(true),
  includeAlerts: z.boolean().default(true),
});

// Initialize services
const billingService = new BillingService(null, null); // Inject dependencies
const featureGateService = new FeatureGateService(null, null); // Inject dependencies

// Enhanced dashboard data interface
interface EnhancedDashboardData extends BillingDashboardData {
  availableFeatures: string[];
  featureLimits: Record<string, number>;
  usageAlerts: BillingAlert[];
  costOptimization: {
    recommendations: CostRecommendation[];
    potentialSavings: number;
  };
  planComparison: {
    currentPlan: SubscriptionPlan;
    recommendedPlan?: SubscriptionPlan;
    upgradeReasons: string[];
  };
}

interface CostRecommendation {
  type: 'resource_optimization' | 'plan_change' | 'usage_pattern';
  title: string;
  description: string;
  potentialSavings: number;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
}

// API handler
const handler = createSingleMethodHandler(
  'GET',
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
  },
  async ({ query, context, auth }) => {
    try {
      const validation = dashboardQuerySchema.safeParse(query);
      if (!validation.success) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          {
            message: 'Invalid query parameters',
            errors: validation.error.issues,
          },
          context.requestId
        );
      }

      const { projectId, period, includeForecasts, includeAlerts } = validation.data;

      const userOrgId = (auth.user as any)?.organizationId;
      if (!userOrgId) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          { message: 'User organization not found' },
          context.requestId
        );
      }

      const billingAccount = await billingService.getBillingAccountByOrganization(userOrgId);
      if (!billingAccount) {
        return createErrorResponse(
          'RESOURCE_NOT_FOUND',
          { message: 'Billing account not found' },
          context.requestId
        );
      }

      // Get basic dashboard data
      const dashboardData = await billingService.getBillingDashboard(billingAccount.id);
      // Get enhanced data
      const featureContext = {
        userId: auth.user!.id,
        projectId: projectId || dashboardData.subscription?.projectId || '',
        organizationId: userOrgId,
      };

      const [availableFeatures, featureLimits, costOptimization, planComparison] =
        await Promise.all([
          featureGateService.getAvailableFeatures(featureContext),
          featureGateService.getFeatureLimits(featureContext),
          generateCostOptimization(dashboardData, period),
          generatePlanComparison(dashboardData),
        ]);

      // Generate usage alerts
      const usageAlerts = await generateUsageAlerts(dashboardData, featureLimits);

      // Calculate period-specific metrics
      const periodMetrics = await calculatePeriodMetrics(dashboardData, period);

      const enhancedDashboard: EnhancedDashboardData = {
        ...dashboardData,
        availableFeatures,
        featureLimits,
        usageAlerts: includeAlerts ? usageAlerts : [],
        costOptimization,
        planComparison,
      };

      // Add forecasts if requested
      let forecasts;
      if (includeForecasts && dashboardData.subscription) {
        forecasts = await BillingService.generateUsageForecasts(
          dashboardData.subscription.projectId,
          userOrgId,
          new Date()
        );
      }

      logger.info('Billing dashboard retrieved', {
        billingAccountId: billingAccount.id,
        projectId,
        period,
        userId: auth.user?.id,
        requestId: context.requestId,
      });

      return createSuccessResponse(
        {
          dashboard: enhancedDashboard,
          periodMetrics,
          forecasts,
          metadata: {
            generatedAt: new Date(),
            period,
            currency: dashboardData.plan?.pricing?.currency || 'USD',
          },
        },
        200,
        context.requestId
      );
    } catch (error) {
      logger.error('Failed to get billing dashboard', error as Error, {
        userId: auth.user?.id,
        requestId: context.requestId,
      });

      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        { message: 'Failed to get billing dashboard' },
        context.requestId
      );
    }
  }
);

// Helper functions

async function generateCostOptimization(
  dashboardData: BillingDashboardData,
  period: string
): Promise<{ recommendations: CostRecommendation[]; potentialSavings: number }> {
  const recommendations: CostRecommendation[] = [];
  let totalSavings = 0;

  // Analyze resource utilization
  const utilization = dashboardData.currentUsage?.metrics?.resourceUtilization;
  if (utilization) {
    // CPU optimization
    if (utilization.cpu.efficiency < 0.6) {
      const savings = (dashboardData.upcomingInvoice?.total ?? 0) * 0.15;
      recommendations.push({
        type: 'resource_optimization',
        title: 'Optimize CPU Usage',
        description: `Your CPU utilization is ${Math.round(
          utilization.cpu.efficiency * 100
        )}%. Consider rightsizing your workflows to reduce costs.`,
        potentialSavings: savings,
        effort: 'medium',
        impact: 'medium',
      });
      totalSavings += savings;
    }

    // Memory optimization
    if (utilization.memory.efficiency < 0.5) {
      const savings = (dashboardData.upcomingInvoice?.total ?? 0) * 0.12;
      recommendations.push({
        type: 'resource_optimization',
        title: 'Optimize Memory Usage',
        description: `Your memory utilization is ${Math.round(
          utilization.memory.efficiency * 100
        )}%. Reducing memory requests could save costs.`,
        potentialSavings: savings,
        effort: 'low',
        impact: 'medium',
      });
      totalSavings += savings;
    }
  }

  // Plan optimization
  if (dashboardData.plan && dashboardData.currentUsage) {
    const executionCount = dashboardData.currentUsage.metrics.totalExecutions;
    const planLimits = dashboardData.plan.features.maxExecutions;

    if (typeof planLimits === 'number' && executionCount < planLimits * 0.3) {
      recommendations.push({
        type: 'plan_change',
        title: 'Consider Downgrading Plan',
        description: `You're using only ${Math.round(
          (executionCount / planLimits) * 100
        )}% of your plan's execution limit. A lower tier might be more cost-effective.`,
        potentialSavings: dashboardData.plan.pricing.basePrice * 0.5,
        effort: 'low',
        impact: 'high',
      });
    }
  }

  return { recommendations, potentialSavings: totalSavings };
}

async function generatePlanComparison(dashboardData: BillingDashboardData): Promise<{
  currentPlan: SubscriptionPlan;
  recommendedPlan?: SubscriptionPlan;
  upgradeReasons: string[];
}> {
  const currentPlan = dashboardData.plan!;
  const upgradeReasons: string[] = [];

  // Analyze usage patterns to recommend upgrades
  if (dashboardData.currentUsage) {
    const usage = dashboardData.currentUsage.metrics;

    // Check execution limits
    if (typeof currentPlan.features.maxExecutions === 'number') {
      const utilizationRate = usage.totalExecutions / currentPlan.features.maxExecutions;
      if (utilizationRate > 0.8) {
        upgradeReasons.push('Approaching execution limit');
      }
    }

    // Check success rate
    if (usage.successfulExecutions / usage.totalExecutions < 0.9) {
      upgradeReasons.push('Higher tier plans include better reliability features');
    }

    // Check resource utilization
    if (usage.resourceUtilization?.cpu.efficiency > 0.9) {
      upgradeReasons.push('High resource utilization - upgrade for better performance');
    }
  }

  return {
    currentPlan,
    upgradeReasons,
  };
}

async function generateUsageAlerts(
  dashboardData: BillingDashboardData,
  featureLimits: Record<string, number>
): Promise<BillingAlert[]> {
  const alerts: BillingAlert[] = [];

  // Check execution limits
  if (dashboardData.currentUsage && dashboardData.plan) {
    const usage = dashboardData.currentUsage.metrics;
    const planLimits = dashboardData.plan.features.maxExecutions;

    if (typeof planLimits === 'number') {
      const utilizationRate = usage.totalExecutions / planLimits;

      if (utilizationRate > 0.9) {
        alerts.push({
          id: 'execution-limit-critical',
          type: 'usage_limit',
          severity: 'critical',
          message: `You've used ${Math.round(utilizationRate * 100)}% of your execution limit`,
          threshold: planLimits,
          current: usage.totalExecutions,
          createdAt: new Date(),
        });
      } else if (utilizationRate > 0.75) {
        alerts.push({
          id: 'execution-limit-warning',
          type: 'usage_limit',
          severity: 'warning',
          message: `You've used ${Math.round(utilizationRate * 100)}% of your execution limit`,
          threshold: planLimits,
          current: usage.totalExecutions,
          createdAt: new Date(),
        });
      }
    }
  }

  // Check cost thresholds
  if (dashboardData.upcomingInvoice) {
    const currentCost = dashboardData.upcomingInvoice.total;
    const previousCost = dashboardData.paymentHistory?.[0]?.total || 0;

    if (currentCost > previousCost * 1.5) {
      alerts.push({
        id: 'cost-spike',
        type: 'cost_threshold',
        severity: 'warning',
        message: `Your current bill is ${Math.round(
          ((currentCost - previousCost) / previousCost) * 100
        )}% higher than last month`,
        threshold: previousCost * 1.5,
        current: currentCost,
        createdAt: new Date(),
      });
    }
  }

  return alerts;
}

async function calculatePeriodMetrics(
  dashboardData: BillingDashboardData,
  period: string
): Promise<any> {
  // Calculate period-specific metrics
  return {
    period,
    totalCost: dashboardData.upcomingInvoice?.total || 0,
    totalExecutions: dashboardData.currentUsage?.metrics?.totalExecutions || 0,
    averageCostPerExecution: dashboardData.currentUsage?.metrics?.averageCost || 0,
    successRate: dashboardData.currentUsage?.metrics
      ? (dashboardData.currentUsage.metrics.successfulExecutions /
          dashboardData.currentUsage.metrics.totalExecutions) *
        100
      : 0,
  };
}

export const GET = handler;
