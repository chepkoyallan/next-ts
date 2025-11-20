/**
 * Subscription Tier Limits for Engine Resources
 */

export interface TierLimits {
  // Resource quotas
  maxProjects: number;
  maxWorkflows: number;
  maxExecutionsPerMonth: number;
  maxConcurrentExecutions: number;
  maxTasksPerWorkflow: number;

  // Storage limits
  maxStorageGB: number;
  maxArtifactSizeMB: number;

  // Rate limits
  apiRequestsPerMinute: number;
  executionsPerHour: number;

  // Feature flags
  features: {
    advancedScheduling: boolean;
    customContainers: boolean;
    privateNetworking: boolean;
    prioritySupport: boolean;
    auditLogs: boolean;
    teamManagement: boolean;
    ssoIntegration: boolean;
    customDomains: boolean;
  };
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    maxProjects: 1,
    maxWorkflows: 5,
    maxExecutionsPerMonth: 100,
    maxConcurrentExecutions: 1,
    maxTasksPerWorkflow: 10,
    maxStorageGB: 1,
    maxArtifactSizeMB: 10,
    apiRequestsPerMinute: 10,
    executionsPerHour: 5,
    features: {
      advancedScheduling: false,
      customContainers: false,
      privateNetworking: false,
      prioritySupport: false,
      auditLogs: false,
      teamManagement: false,
      ssoIntegration: false,
      customDomains: false,
    },
  },

  starter: {
    maxProjects: 3,
    maxWorkflows: 50,
    maxExecutionsPerMonth: 1000,
    maxConcurrentExecutions: 5,
    maxTasksPerWorkflow: 50,
    maxStorageGB: 10,
    maxArtifactSizeMB: 50,
    apiRequestsPerMinute: 50,
    executionsPerHour: 50,
    features: {
      advancedScheduling: true,
      customContainers: false,
      privateNetworking: false,
      prioritySupport: false,
      auditLogs: false,
      teamManagement: true,
      ssoIntegration: false,
      customDomains: false,
    },
  },

  professional: {
    maxProjects: 10,
    maxWorkflows: 100,
    maxExecutionsPerMonth: 10000,
    maxConcurrentExecutions: 50,
    maxTasksPerWorkflow: 100,
    maxStorageGB: 50,
    maxArtifactSizeMB: 100,
    apiRequestsPerMinute: 100,
    executionsPerHour: 100,
    features: {
      advancedScheduling: true,
      customContainers: true,
      privateNetworking: false,
      prioritySupport: true,
      auditLogs: true,
      teamManagement: true,
      ssoIntegration: false,
      customDomains: false,
    },
  },

  enterprise: {
    maxProjects: Infinity,
    maxWorkflows: Infinity,
    maxExecutionsPerMonth: Infinity,
    maxConcurrentExecutions: 100,
    maxTasksPerWorkflow: 1000,
    maxStorageGB: 1000,
    maxArtifactSizeMB: 1000,
    apiRequestsPerMinute: 1000,
    executionsPerHour: 1000,
    features: {
      advancedScheduling: true,
      customContainers: true,
      privateNetworking: true,
      prioritySupport: true,
      auditLogs: true,
      teamManagement: true,
      ssoIntegration: true,
      customDomains: true,
    },
  },
};

/**
 * Get limits for subscription tier
 */
export function getTierLimits(tier: string): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

/**
 * Check if feature is available in tier
 */
export function hasFeature(tier: string, feature: keyof TierLimits['features']): boolean {
  const limits = getTierLimits(tier);
  return limits.features[feature];
}

/**
 * Get tier upgrade recommendations
 */
export function getTierUpgradeRecommendation(
  currentTier: string,
  reason: string
): { suggestedTier: string; benefits: string[] } {
  if (currentTier === 'enterprise') {
    return {
      suggestedTier: 'enterprise',
      benefits: ['Contact sales for custom limits'],
    };
  }

  if (currentTier === 'free') {
    return {
      suggestedTier: 'starter',
      benefits: [
        '50 workflows (vs 5)',
        '1,000 executions/month (vs 100)',
        'Advanced scheduling',
        'Team management',
      ],
    };
  }

  if (currentTier === 'starter') {
    return {
      suggestedTier: 'professional',
      benefits: [
        '100 workflows (vs 50)',
        '10,000 executions/month (vs 1,000)',
        'Custom containers',
        'Priority support',
        'Audit logs',
      ],
    };
  }

  // professional -> enterprise
  return {
    suggestedTier: 'enterprise',
    benefits: [
      'Unlimited workflows & executions',
      'Private networking',
      'SSO integration',
      'Custom domains',
      'Dedicated support',
      'SLA guarantees',
    ],
  };
}

/**
 * Format tier limit for display
 */
export function formatLimit(value: number): string {
  if (value === Infinity) {
    return 'Unlimited';
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`;
  }
  return value.toString();
}

/**
 * Get tier comparison data
 */
export function getTierComparison() {
  return {
    tiers: ['free', 'starter', 'professional', 'enterprise'],
    comparison: {
      price: ['$0/month', '$49/month', '$199/month', 'Custom'],
      workflows: [
        formatLimit(TIER_LIMITS.free.maxWorkflows),
        formatLimit(TIER_LIMITS.starter.maxWorkflows),
        formatLimit(TIER_LIMITS.professional.maxWorkflows),
        formatLimit(TIER_LIMITS.enterprise.maxWorkflows),
      ],
      executions: [
        formatLimit(TIER_LIMITS.free.maxExecutionsPerMonth),
        formatLimit(TIER_LIMITS.starter.maxExecutionsPerMonth),
        formatLimit(TIER_LIMITS.professional.maxExecutionsPerMonth),
        formatLimit(TIER_LIMITS.enterprise.maxExecutionsPerMonth),
      ],
      storage: [
        `${TIER_LIMITS.free.maxStorageGB}GB`,
        `${TIER_LIMITS.starter.maxStorageGB}GB`,
        `${TIER_LIMITS.professional.maxStorageGB}GB`,
        `${TIER_LIMITS.enterprise.maxStorageGB}GB`,
      ],
      support: ['Community', 'Community', 'Priority', 'Dedicated'],
    },
  };
}
