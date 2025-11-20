/**
 * Plan Limits Sync Service
 * Syncs subscription plan limits with feature gates and usage tracking
 */

import { prisma } from '@app/database';

import { logger } from '../utils/logger';

export interface PlanLimitsConfig {
  planId: string;
  tier: string;
  limits: Record<string, any>;
  features: string[];
}

export class PlanLimitsSyncService {
  /**
   * Sync a single plan's limits to feature gates
   */
  static async syncPlanToFeatureGates(planId: string): Promise<void> {
    try {
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });

      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      const limits = plan.limits as Record<string, any>;
      const { tier } = plan;

      // Sync feature gates based on plan limits
      const featureGates: Array<{
        feature: string;
        enabled: boolean;
        usageLimit?: number;
        requiredTier: string;
      }> = [];

      // Forms features
      if (limits.maxForms !== undefined) {
        featureGates.push({
          feature: 'forms',
          enabled: (limits.maxForms || 0) > 0,
          usageLimit: limits.maxForms === -1 ? undefined : limits.maxForms,
          requiredTier: tier,
        });
      }

      if (limits.advancedForms) {
        featureGates.push({
          feature: 'advanced-forms',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.formThemes) {
        featureGates.push({
          feature: 'form-themes',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.formWebhooks) {
        featureGates.push({
          feature: 'form-webhooks',
          enabled: true,
          requiredTier: tier,
        });
      }

      // Connectors features
      if (limits.maxConnectors !== undefined) {
        featureGates.push({
          feature: 'connectors',
          enabled: (limits.maxConnectors || 0) > 0,
          usageLimit: limits.maxConnectors === -1 ? undefined : limits.maxConnectors,
          requiredTier: tier,
        });
      }

      if (limits.databaseConnectors) {
        featureGates.push({
          feature: 'database-connectors',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.cloudConnectors) {
        featureGates.push({
          feature: 'cloud-connectors',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.customConnectors) {
        featureGates.push({
          feature: 'custom-connectors',
          enabled: true,
          requiredTier: tier,
        });
      }

      // Workflows features
      if (limits.advancedWorkflows) {
        featureGates.push({
          feature: 'advanced-workflows',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.workflowScheduling) {
        featureGates.push({
          feature: 'workflow-scheduling',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.workflowTemplates) {
        featureGates.push({
          feature: 'workflow-templates',
          enabled: true,
          requiredTier: tier,
        });
      }

      // Analytics features
      if (limits.advancedAnalytics) {
        featureGates.push({
          feature: 'advanced-analytics',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.customDashboards) {
        featureGates.push({
          feature: 'custom-dashboards',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.dataExport) {
        featureGates.push({
          feature: 'data-export',
          enabled: true,
          requiredTier: tier,
        });
      }

      // Integration features
      if (limits.webhooks) {
        featureGates.push({
          feature: 'webhooks',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.apiIntegrations) {
        featureGates.push({
          feature: 'api-integrations',
          enabled: true,
          requiredTier: tier,
        });
      }

      // Infrastructure features
      if (limits.dedicatedClusters) {
        featureGates.push({
          feature: 'dedicated-clusters',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.autoScaling) {
        featureGates.push({
          feature: 'auto-scaling',
          enabled: true,
          requiredTier: tier,
        });
      }

      // Security features
      if (limits.auditLogging) {
        featureGates.push({
          feature: 'audit-logging',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.advancedSecurity) {
        featureGates.push({
          feature: 'advanced-security',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.rbacAdvanced) {
        featureGates.push({
          feature: 'rbac-advanced',
          enabled: true,
          requiredTier: tier,
        });
      }

      // Support features
      if (limits.prioritySupport) {
        featureGates.push({
          feature: 'priority-support',
          enabled: true,
          requiredTier: tier,
        });
      }

      if (limits.dedicatedSupport) {
        featureGates.push({
          feature: 'dedicated-support',
          enabled: true,
          requiredTier: tier,
        });
      }

      logger.info('Plan limits synced to feature gates', {
        planId,
        tier,
        featureCount: featureGates.length,
      });
    } catch (error) {
      logger.error('Failed to sync plan to feature gates', error as Error, { planId });
      throw error;
    }
  }

  /**
   * Sync all plans to feature gates
   */
  static async syncAllPlansToFeatureGates(): Promise<void> {
    try {
      const plans = await prisma.subscriptionPlan.findMany({
        where: { isActive: true },
      });

      await Promise.all(plans.map((plan) => this.syncPlanToFeatureGates(plan.id)));

      logger.info('All plans synced to feature gates', {
        planCount: plans.length,
      });
    } catch (error) {
      logger.error('Failed to sync all plans to feature gates', error as Error);
      throw error;
    }
  }

  /**
   * Check if user has access to a feature based on their plan
   */
  static async checkFeatureAccess(
    userId: string,
    projectId: string,
    feature: string
  ): Promise<{ allowed: boolean; reason?: string; currentUsage?: number; limit?: number }> {
    try {
      // Get user's active subscription
      const subscription = await prisma.subscription.findFirst({
        where: {
          projectId,
          status: {
            in: ['ACTIVE', 'TRIALING'],
          },
        },
        include: {
          plan: true,
        },
      });

      if (!subscription) {
        return {
          allowed: false,
          reason: 'No active subscription found',
        };
      }

      const limits = subscription.plan.limits as Record<string, any>;

      // Check feature-specific limits
      const featureLimitMap: Record<string, { limitKey: string; metricType: string }> = {
        // Forms
        forms: { limitKey: 'maxForms', metricType: 'FORMS' },
        'form-submissions': { limitKey: 'maxFormSubmissions', metricType: 'FORM_SUBMISSIONS' },
        'form-fields': { limitKey: 'maxFormFields', metricType: 'FORM_FIELDS' },
        'form-assignments': { limitKey: 'maxFormAssignments', metricType: 'FORM_ASSIGNMENTS' },

        // Connectors
        connectors: { limitKey: 'maxConnectors', metricType: 'CONNECTORS' },
        'connector-calls': { limitKey: 'maxConnectorCalls', metricType: 'CONNECTOR_CALLS' },

        // Workflows
        workflows: { limitKey: 'maxWorkflows', metricType: 'WORKFLOWS' },
        'workflow-drafts': { limitKey: 'maxWorkflowDrafts', metricType: 'WORKFLOW_DRAFTS' },
        'workflow-versions': { limitKey: 'maxWorkflowVersions', metricType: 'WORKFLOW_VERSIONS' },
        executions: { limitKey: 'maxExecutions', metricType: 'EXECUTIONS' },

        // Marketplace
        'marketplace-listings': {
          limitKey: 'maxMarketplaceListings',
          metricType: 'MARKETPLACE_LISTINGS',
        },
        'workflow-purchases': {
          limitKey: 'maxWorkflowPurchases',
          metricType: 'WORKFLOW_PURCHASES',
        },

        // Projects & Teams
        projects: { limitKey: 'maxProjects', metricType: 'PROJECTS' },
        'team-members': { limitKey: 'maxTeamMembers', metricType: 'USERS' },

        // Organization
        organizations: { limitKey: 'maxOrganizations', metricType: 'ORGANIZATIONS' },
        invitations: { limitKey: 'maxInvitations', metricType: 'INVITATIONS' },

        // Alerts & Monitoring
        alerts: { limitKey: 'maxAlerts', metricType: 'ALERTS' },
        'alert-rules': { limitKey: 'maxAlertRules', metricType: 'ALERT_RULES' },

        // API Access
        'api-keys': { limitKey: 'maxApiKeys', metricType: 'API_KEYS' },
        'api-calls': { limitKey: 'apiRateLimit', metricType: 'API_CALLS' },
        'webhook-endpoints': { limitKey: 'apiWebhookEndpoints', metricType: 'WEBHOOK_ENDPOINTS' },

        // RBAC
        'custom-roles': { limitKey: 'maxCustomRoles', metricType: 'CUSTOM_ROLES' },

        // Collaboration
        comments: { limitKey: 'maxComments', metricType: 'COMMENTS' },

        // Tasks
        tasks: { limitKey: 'maxTasks', metricType: 'TASKS' },

        // Launch Plans
        'launch-plans': { limitKey: 'maxLaunchPlans', metricType: 'LAUNCH_PLANS' },

        // Support
        'support-tickets': { limitKey: 'maxSupportTickets', metricType: 'SUPPORT_TICKETS' },
      };

      const featureLimit = featureLimitMap[feature];
      if (featureLimit) {
        const limit = limits[featureLimit.limitKey];

        // If limit is -1, it's unlimited
        if (limit === -1) {
          return { allowed: true };
        }

        // Check current usage
        const currentUsage = await this.getCurrentUsage(
          subscription.id,
          projectId,
          featureLimit.metricType
        );

        if (currentUsage >= limit) {
          return {
            allowed: false,
            reason: `${feature} limit reached`,
            currentUsage,
            limit,
          };
        }

        return {
          allowed: true,
          currentUsage,
          limit,
        };
      }

      // For boolean features, check if enabled
      const booleanFeatures: Record<string, string> = {
        // Forms
        'advanced-forms': 'advancedForms',
        'form-themes': 'formThemes',
        'form-webhooks': 'formWebhooks',
        'form-workflow-triggers': 'formWorkflowTriggers',
        'form-conditional-routing': 'formConditionalRouting',
        'form-file-uploads': 'formFileUploads',

        // Connectors
        'database-connectors': 'databaseConnectors',
        'cloud-connectors': 'cloudConnectors',
        'custom-connectors': 'customConnectors',

        // Workflows
        'advanced-workflows': 'advancedWorkflows',
        'workflow-scheduling': 'workflowScheduling',
        'workflow-templates': 'workflowTemplates',
        'long-running-workflows': 'longRunningWorkflows',
        'workflow-versioning': 'workflowVersioning',
        'workflow-history': 'workflowHistory',
        'workflow-rollback': 'workflowRollback',

        // Execution & Runtime
        'execution-priority': 'executionPriority',
        'execution-logs': 'executionLogs',

        // Marketplace
        'marketplace-publishing': 'marketplacePublishing',
        'workflow-monetization': 'workflowMonetization',
        'marketplace-revenue': 'marketplaceRevenue',
        'marketplace-analytics': 'marketplaceAnalytics',

        // Organization Management
        'sso-integration': 'ssoIntegration',
        'organization-branding': 'organizationBranding',
        'department-hierarchy': 'departmentHierarchy',

        // Analytics
        'basic-analytics': 'basicAnalytics',
        'advanced-analytics': 'advancedAnalytics',
        'custom-dashboards': 'customDashboards',
        'data-export': 'dataExport',

        // Alerts & Monitoring
        'custom-alerts': 'customAlerts',
        'alert-integrations': 'alertIntegrations',
        'custom-metrics': 'customMetrics',
        'real-time-monitoring': 'realTimeMonitoring',

        // API Access
        'rest-api-access': 'restApiAccess',
        'graphql-api-access': 'graphqlApiAccess',
        webhooks: 'webhooks',
        'api-integrations': 'apiIntegrations',

        // RBAC
        'custom-roles-feature': 'customRoles',
        'granular-permissions': 'granularPermissions',
        'rbac-advanced': 'rbacAdvanced',

        // Collaboration
        'real-time-collaboration': 'realTimeCollaboration',
        'comments-feature': 'comments',
        'workflow-sharing': 'workflowSharing',
        'external-sharing': 'externalSharing',

        // Infrastructure
        'dedicated-clusters': 'dedicatedClusters',
        'auto-scaling': 'autoScaling',
        'multi-cloud': 'multiCloud',

        // Security & Compliance
        'audit-logging': 'auditLogging',
        'advanced-security': 'advancedSecurity',
        'compliance-suite': 'complianceSuite',
        'data-classification': 'dataClassification',
        'gdpr-tools': 'gdprTools',
        'data-retention-policies': 'dataRetentionPolicies',
        'encryption-at-rest': 'encryptionAtRest',
        'encryption-in-transit': 'encryptionInTransit',

        // White Labeling
        'white-label': 'whiteLabel',
        'custom-domain': 'customDomain',
        'custom-logo': 'customLogo',
        'custom-theme': 'customTheme',
        'custom-email-templates': 'customEmailTemplates',

        // Support
        'priority-support': 'prioritySupport',
        'dedicated-support': 'dedicatedSupport',
        'support-tickets-feature': 'supportTickets',
        'onboarding-support': 'onboardingSupport',
        'training-resources': 'trainingResources',

        // Billing
        'billing-alerts': 'billingAlerts',
        'multiple-payment-methods': 'multiplePaymentMethods',
        'purchase-orders': 'purchaseOrders',

        // Tasks
        'task-automation': 'taskAutomation',
        'task-reminders': 'taskReminders',

        // Launch Plans
        'launch-plan-automation': 'launchPlanAutomation',
      };

      const limitKey = booleanFeatures[feature];
      if (limitKey) {
        const enabled = limits[limitKey];
        return {
          allowed: enabled === true,
          reason: enabled ? undefined : `${feature} not available in your plan`,
        };
      }

      // Feature not found, allow by default
      return { allowed: true };
    } catch (error) {
      logger.error('Failed to check feature access', error as Error, {
        userId,
        projectId,
        feature,
      });
      // On error, allow access to avoid breaking functionality
      return { allowed: true };
    }
  }

  /**
   * Get current usage for a metric
   */
  private static async getCurrentUsage(
    subscriptionId: string,
    projectId: string,
    metricType: string
  ): Promise<number> {
    try {
      // For count-based metrics (forms, connectors, workflows), count records
      switch (metricType) {
        case 'FORMS': {
          const count = await prisma.formSchema.count({
            where: { organizationId: projectId },
          });
          return count;
        }

        case 'CONNECTORS': {
          const count = await prisma.connectorConfig.count({
            where: { organizationId: projectId },
          });
          return count;
        }

        case 'WORKFLOWS': {
          const count = await prisma.workflow.count({
            where: { projectId },
          });
          return count;
        }

        case 'FORM_SUBMISSIONS':
        case 'CONNECTOR_CALLS':
        case 'EXECUTIONS': {
          // For usage-based metrics, sum usage records for current billing period
          const subscription = await prisma.subscription.findUnique({
            where: { id: subscriptionId },
          });

          if (!subscription) return 0;

          const usageRecords = await prisma.usageRecord.findMany({
            where: {
              subscriptionId,
              metric: metricType as any,
              timestamp: {
                gte: subscription.currentPeriodStart,
                lte: subscription.currentPeriodEnd,
              },
            },
          });

          return usageRecords.reduce((sum, record) => sum + Number(record.quantity), 0);
        }

        default:
          return 0;
      }
    } catch (error) {
      logger.error('Failed to get current usage', error as Error, {
        subscriptionId,
        projectId,
        metricType,
      });
      return 0;
    }
  }

  /**
   * Track feature usage (increment counter)
   */
  static async trackFeatureUsage(
    subscriptionId: string,
    projectId: string,
    metricType: string,
    quantity: number = 1
  ): Promise<void> {
    try {
      await prisma.usageRecord.create({
        data: {
          subscriptionId,
          projectId,
          metric: metricType as any,
          quantity,
          unit: metricType,
          timestamp: new Date(),
          metadata: {},
        },
      });

      logger.debug('Feature usage tracked', {
        subscriptionId,
        projectId,
        metricType,
        quantity,
      });
    } catch (error) {
      logger.error('Failed to track feature usage', error as Error, {
        subscriptionId,
        projectId,
        metricType,
      });
    }
  }
}
