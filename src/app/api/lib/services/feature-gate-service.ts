// Feature gating service for premium features
import { logger } from '../utils/logger';
import {
  PlanTier,
  FeatureGate,
  FeatureUsage,
  Subscription,
  SubscriptionPlan,
} from '../types/billing';

export interface FeatureCheckResult {
  allowed: boolean;
  reason?: string;
  usageCount?: number;
  usageLimit?: number;
  planRequired?: PlanTier;
  upgradeUrl?: string;
}

export interface FeatureContext {
  userId: string;
  projectId: string;
  organizationId?: string;
  subscription?: Subscription;
  plan?: SubscriptionPlan;
}

export class FeatureGateService {
  private db: any; // Database connection

  private billingService: any; // Billing service

  // Feature definitions with their requirements
  private readonly FEATURE_GATES: Record<string, FeatureGate> = {
    // Workflow Features
    'advanced-workflows': {
      feature: 'advanced-workflows',
      requiredPlans: [PlanTier.STARTER, PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Advanced workflow types and complex orchestration',
      isActive: true,
    },
    'workflow-scheduling': {
      feature: 'workflow-scheduling',
      requiredPlans: [PlanTier.STARTER, PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Scheduled workflow execution',
      isActive: true,
    },
    'workflow-templates': {
      feature: 'workflow-templates',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Pre-built workflow templates',
      isActive: true,
    },

    // Analytics Features
    'basic-analytics': {
      feature: 'basic-analytics',
      requiredPlans: [PlanTier.STARTER, PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Basic execution metrics and dashboards',
      isActive: true,
    },
    'advanced-analytics': {
      feature: 'advanced-analytics',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Advanced analytics, forecasting, and insights',
      isActive: true,
    },
    'custom-dashboards': {
      feature: 'custom-dashboards',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Custom analytics dashboards',
      isActive: true,
    },
    'data-export': {
      feature: 'data-export',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Export analytics data and reports',
      isActive: true,
    },

    // Integration Features
    webhooks: {
      feature: 'webhooks',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Webhook notifications for workflow events',
      isActive: true,
    },
    'api-integrations': {
      feature: 'api-integrations',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Third-party API integrations',
      isActive: true,
    },
    'custom-integrations': {
      feature: 'custom-integrations',
      requiredPlans: [PlanTier.ENTERPRISE],
      description: 'Custom integration development',
      isActive: true,
    },

    // Infrastructure Features
    'dedicated-clusters': {
      feature: 'dedicated-clusters',
      requiredPlans: [PlanTier.ENTERPRISE],
      description: 'Dedicated compute clusters',
      isActive: true,
    },
    'multi-cloud': {
      feature: 'multi-cloud',
      requiredPlans: [PlanTier.ENTERPRISE],
      description: 'Multi-cloud orchestration',
      isActive: true,
    },
    'auto-scaling': {
      feature: 'auto-scaling',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Automatic resource scaling',
      isActive: true,
    },

    // Security & Compliance Features
    'audit-logging': {
      feature: 'audit-logging',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Comprehensive audit logging',
      isActive: true,
    },
    'compliance-suite': {
      feature: 'compliance-suite',
      requiredPlans: [PlanTier.ENTERPRISE],
      description: 'SOC2, GDPR, HIPAA compliance features',
      isActive: true,
    },
    'advanced-security': {
      feature: 'advanced-security',
      requiredPlans: [PlanTier.ENTERPRISE],
      description: 'Advanced security controls and encryption',
      isActive: true,
    },
    'rbac-advanced': {
      feature: 'rbac-advanced',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Advanced role-based access control',
      isActive: true,
    },

    // Support Features
    'priority-support': {
      feature: 'priority-support',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Priority customer support',
      isActive: true,
    },
    'dedicated-support': {
      feature: 'dedicated-support',
      requiredPlans: [PlanTier.ENTERPRISE],
      description: 'Dedicated support manager',
      isActive: true,
    },

    // Usage-based Features
    'high-concurrency': {
      feature: 'high-concurrency',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      usageLimit: 50, // Max concurrent executions
      description: 'High concurrency execution',
      isActive: true,
    },
    'long-running-workflows': {
      feature: 'long-running-workflows',
      requiredPlans: [PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE],
      description: 'Workflows running longer than 6 hours',
      isActive: true,
    },
  };

  constructor(db: any, billingService: any) {
    this.db = db;
    this.billingService = billingService;
  }

  /**
   * Check if a feature is available for the given context
   */
  async checkFeatureAccess(feature: string, context: FeatureContext): Promise<FeatureCheckResult> {
    try {
      const featureGate = this.FEATURE_GATES[feature];
      if (!featureGate || !featureGate.isActive) {
        return {
          allowed: false,
          reason: 'Feature not available',
        };
      }

      // Get user's subscription and plan
      let { subscription } = context;
      let { plan } = context;

      if (!subscription || !plan) {
        const subscriptionData = await this.getUserSubscription(context);
        subscription = subscriptionData.subscription || undefined;
        plan = subscriptionData.plan || undefined;
      }

      // Check plan requirements
      if (!FeatureGateService.checkPlanRequirement(featureGate, plan || null)) {
        const requiredPlan = FeatureGateService.getLowestRequiredPlan(featureGate.requiredPlans);
        return {
          allowed: false,
          reason: `Feature requires ${requiredPlan} plan or higher`,
          planRequired: requiredPlan,
          upgradeUrl: FeatureGateService.generateUpgradeUrl(context, requiredPlan),
        };
      }

      // Check usage limits if applicable
      if (featureGate.usageLimit) {
        const usageCheck = await this.checkUsageLimit(feature, context, featureGate.usageLimit);
        if (!usageCheck.allowed) {
          return usageCheck;
        }
      }

      // Check custom permissions if specified
      if (featureGate.requiredPermissions) {
        const hasPermissions = await FeatureGateService.checkPermissions(
          context,
          featureGate.requiredPermissions
        );
        if (!hasPermissions) {
          return {
            allowed: false,
            reason: 'Insufficient permissions',
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Feature access check failed', error as Error, {
        feature,
        userId: context.userId,
      });
      return {
        allowed: false,
        reason: 'Unable to verify feature access',
      };
    }
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(feature: string, context: FeatureContext): Promise<void> {
    try {
      const featureGate = this.FEATURE_GATES[feature];
      if (!featureGate || !featureGate.usageLimit) {
        return; // No tracking needed for unlimited features
      }

      const now = new Date();
      const resetPeriod = FeatureGateService.getResetPeriod(feature);

      // Get or create usage record
      let usage = await this.db.featureUsage.findOne({
        userId: context.userId,
        projectId: context.projectId,
        feature,
      });

      if (!usage) {
        usage = {
          userId: context.userId,
          projectId: context.projectId,
          feature,
          usageCount: 0,
          lastUsed: now,
          resetPeriod,
        };
      }

      // Check if usage should be reset
      if (FeatureGateService.shouldResetUsage(usage.lastUsed, resetPeriod)) {
        usage.usageCount = 0;
      }

      // Increment usage
      usage.usageCount += 1;
      usage.lastUsed = now;

      await this.db.featureUsage.upsert(usage);

      logger.debug('Feature usage tracked', {
        feature,
        userId: context.userId,
        projectId: context.projectId,
        usageCount: usage.usageCount,
      });
    } catch (error) {
      logger.error('Failed to track feature usage', error as Error, {
        feature,
        userId: context.userId,
      });
    }
  }

  /**
   * Get feature usage for a user/project
   */
  async getFeatureUsage(feature: string, context: FeatureContext): Promise<FeatureUsage | null> {
    try {
      return this.db.featureUsage.findOne({
        userId: context.userId,
        projectId: context.projectId,
        feature,
      });
    } catch (error) {
      logger.error('Failed to get feature usage', error as Error, {
        feature,
        userId: context.userId,
      });
      return null;
    }
  }

  /**
   * Get all available features for a user's plan
   */
  async getAvailableFeatures(context: FeatureContext): Promise<string[]> {
    try {
      const { plan } = await this.getUserSubscription(context);
      if (!plan) {
        return this.getFreeFeatures();
      }

      const availableFeatures: string[] = [];

      Object.entries(this.FEATURE_GATES).map(([featureName, featureGate]) => {
        if (
          featureGate.isActive &&
          FeatureGateService.checkPlanRequirement(featureGate, plan || null)
        ) {
          availableFeatures.push(featureName);
        }
        return null;
      });

      return availableFeatures;
    } catch (error) {
      logger.error('Failed to get available features', error as Error, { userId: context.userId });
      return this.getFreeFeatures();
    }
  }

  /**
   * Get feature limits for a user's plan
   */
  async getFeatureLimits(context: FeatureContext): Promise<Record<string, number>> {
    try {
      const { plan } = await this.getUserSubscription(context);
      const limits: Record<string, number> = {};

      Object.entries(this.FEATURE_GATES).map(([featureName, featureGate]) => {
        if (
          featureGate.usageLimit &&
          FeatureGateService.checkPlanRequirement(featureGate, plan || null)
        ) {
          limits[featureName] = featureGate.usageLimit;
        }
        return null;
      });

      return limits;
    } catch (error) {
      logger.error('Failed to get feature limits', error as Error, { userId: context.userId });
      return {};
    }
  }

  // Private helper methods

  private async getUserSubscription(
    context: FeatureContext
  ): Promise<{ subscription: Subscription | null; plan: SubscriptionPlan | null }> {
    try {
      const subscription = await this.billingService.getActiveSubscriptionByProject(
        context.projectId
      );
      const plan = subscription
        ? await this.billingService.getSubscriptionPlan(subscription.planId)
        : null;

      return { subscription, plan };
    } catch (error) {
      logger.error('Failed to get user subscription', error as Error, { userId: context.userId });
      return { subscription: null, plan: null };
    }
  }

  private static checkPlanRequirement(
    featureGate: FeatureGate,
    plan: SubscriptionPlan | null
  ): boolean {
    if (!plan) {
      return featureGate.requiredPlans.includes(PlanTier.FREE);
    }

    return featureGate.requiredPlans.includes(plan.tier);
  }

  private async checkUsageLimit(
    feature: string,
    context: FeatureContext,
    limit: number
  ): Promise<FeatureCheckResult> {
    const usage = await this.getFeatureUsage(feature, context);
    const usageCount = usage?.usageCount || 0;

    if (usageCount >= limit) {
      return {
        allowed: false,
        reason: `Feature usage limit exceeded (${usageCount}/${limit})`,
        usageCount,
        usageLimit: limit,
      };
    }

    return {
      allowed: true,
      usageCount,
      usageLimit: limit,
    };
  }

  private static async checkPermissions(
    context: FeatureContext,
    requiredPermissions: string[]
  ): Promise<boolean> {
    // This would integrate with your RBAC system
    // For now, assume all authenticated users have basic permissions
    return true;
  }

  private static getLowestRequiredPlan(requiredPlans: PlanTier[]): PlanTier {
    const planOrder = [PlanTier.FREE, PlanTier.STARTER, PlanTier.PROFESSIONAL, PlanTier.ENTERPRISE];

    const foundPlan = planOrder.find((plan) => requiredPlans.includes(plan));
    if (foundPlan) {
      return foundPlan;
    }

    return PlanTier.ENTERPRISE;
  }

  private static generateUpgradeUrl(context: FeatureContext, requiredPlan: PlanTier): string {
    return `/dashboard/billing/plans?plan=${requiredPlan}&project=${context.projectId}`;
  }

  private static getResetPeriod(feature: string): 'daily' | 'weekly' | 'monthly' {
    // Most features reset monthly, but some might be daily or weekly
    const dailyResetFeatures = ['api-calls', 'webhook-calls'];
    const weeklyResetFeatures = ['data-export'];

    if (dailyResetFeatures.includes(feature)) return 'daily';
    if (weeklyResetFeatures.includes(feature)) return 'weekly';
    return 'monthly';
  }

  private static shouldResetUsage(
    lastUsed: Date,
    resetPeriod: 'daily' | 'weekly' | 'monthly'
  ): boolean {
    const now = new Date();
    const diffMs = now.getTime() - lastUsed.getTime();

    switch (resetPeriod) {
      case 'daily':
        return diffMs > 24 * 60 * 60 * 1000;
      case 'weekly':
        return diffMs > 7 * 24 * 60 * 60 * 1000;
      case 'monthly':
        return (
          now.getMonth() !== lastUsed.getMonth() || now.getFullYear() !== lastUsed.getFullYear()
        );
      default:
        return false;
    }
  }

  private getFreeFeatures(): string[] {
    return Object.entries(this.FEATURE_GATES)
      .filter(([, gate]) => gate.isActive && gate.requiredPlans.includes(PlanTier.FREE))
      .map(([name]) => name);
  }
}

/**
 * Middleware to check feature access
 */
export function requireFeature(feature: string) {
  return async (request: Request, context: Record<string, any>, next: () => Promise<Response>) => {
    try {
      const featureGateService = new FeatureGateService(null, null); // Inject dependencies

      const featureContext: FeatureContext = {
        userId: context.auth?.user?.id || '',
        projectId: context.params?.projectId || request.headers.get('x-project-id') || '',
        organizationId: context.auth?.user?.organizationId,
      };

      const result = await featureGateService.checkFeatureAccess(feature, featureContext);

      if (!result.allowed) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'FEATURE_NOT_AVAILABLE',
              message: result.reason,
              feature,
              planRequired: result.planRequired,
              upgradeUrl: result.upgradeUrl,
            },
          }),
          {
            status: 402, // Payment Required
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Track feature usage
      await featureGateService.trackFeatureUsage(feature, featureContext);

      return await next();
    } catch (error) {
      logger.error('Feature gate middleware error', error as Error, { feature });
      return next(); // Allow access on error to avoid breaking functionality
    }
  };
}
