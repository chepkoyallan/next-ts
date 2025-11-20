/**
 * Enhanced Engine Helper with RBAC Integration
 * Provides secure access to engine services with authentication, authorization, and usage tracking
 */

import { NextRequest, NextResponse } from 'next/server';

import { EngineManager } from '@app/engine';

import { getOrInitializeEngine } from './engine-helper';
import { RBACConfig, rbacMiddleware } from '../auth/rbac/middleware';
import { isHeadlessMode, HEADLESS_MOCK_CONTEXT } from '../headless-mode';

export interface SecureEngineOptions {
  serviceName?: keyof EngineManager['services'];
  rbac?: RBACConfig;
  checkSubscription?: boolean;
  trackUsage?: boolean;
  auditLog?: boolean;
}

export interface SecureEngineResult {
  engineManager: EngineManager;
  userId: string;
  context: {
    organizationId?: string;
    subscriptionTier?: string;
    subscriptionStatus?: string;
    roles: string[];
    permissions: string[];
  };
}

/**
 * Secure engine access with RBAC, subscription, and usage tracking
 */
export async function requireSecureEngine(
  request: NextRequest,
  options: SecureEngineOptions,
  params?: any
): Promise<SecureEngineResult | NextResponse> {
  // In headless mode, bypass all checks and return mock context
  if (isHeadlessMode()) {
    const engineManager = await getOrInitializeEngine();
    if (!engineManager) {
      return NextResponse.json(
        {
          success: false,
          error: 'Engine services unavailable',
          code: 'ENGINE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    return {
      engineManager,
      userId: HEADLESS_MOCK_CONTEXT.userId,
      context: {
        organizationId: HEADLESS_MOCK_CONTEXT.organizationId,
        subscriptionTier: HEADLESS_MOCK_CONTEXT.subscriptionTier,
        subscriptionStatus: HEADLESS_MOCK_CONTEXT.subscriptionStatus,
        roles: HEADLESS_MOCK_CONTEXT.roles as string[],
        permissions: HEADLESS_MOCK_CONTEXT.permissions as string[],
      },
    };
  }

  // 1. Initialize engine first (fail fast if engine unavailable)
  const engineManager = await getOrInitializeEngine();
  if (!engineManager) {
    return NextResponse.json(
      {
        success: false,
        error: 'Engine services unavailable',
        code: 'ENGINE_UNAVAILABLE',
      },
      { status: 503 }
    );
  }

  // Check specific service if requested
  if (options.serviceName && !engineManager.services[options.serviceName]) {
    return NextResponse.json(
      {
        success: false,
        error: `${options.serviceName} service not available`,
        code: 'SERVICE_UNAVAILABLE',
      },
      { status: 503 }
    );
  }

  // 2. Check RBAC (authentication + authorization)
  if (options.rbac) {
    const rbacResult = await rbacMiddleware(request, options.rbac, params);

    if (rbacResult instanceof NextResponse) {
      return rbacResult; // Return error response
    }

    const { userId } = rbacResult;

    // 3. Get user context (roles, organization, subscription)
    // Pass request to enable organization switching via X-Organization-Id header
    const userContext = await getUserContext(userId, request);

    // 4. Check subscription if required
    if (options.checkSubscription) {
      const subscriptionCheck = await checkUserSubscription(userId, userContext);
      if (subscriptionCheck instanceof NextResponse) {
        return subscriptionCheck; // Return error response
      }
    }

    // Return successful result with context
    return {
      engineManager,
      userId,
      context: userContext,
    };
  }

  // No RBAC - return engine only (backward compatibility)
  return {
    engineManager,
    userId: 'anonymous',
    context: { roles: [], permissions: [] },
  };
}

/**
 * Get user context (roles, organization, subscription)
 * Supports organization switching via request headers
 */
async function getUserContext(userId: string, request?: NextRequest) {
  const { AccessControlEngine } = await import('../auth/rbac/access-control');
  const rbacContext = await AccessControlEngine.buildRBACContext(userId);

  // Get organization from request header (if provided) or database
  // This enables organization switching in multi-org environments
  const organizationId = await getOrganizationId(userId, request);

  // Get subscription info from environment or database
  const subscriptionInfo = await getSubscriptionInfo(userId);

  return {
    organizationId,
    subscriptionTier: subscriptionInfo.tier,
    subscriptionStatus: subscriptionInfo.status,
    roles: rbacContext.roles.map((r: any) => r.id),
    permissions: rbacContext.permissions.map((p: any) => p.id),
  };
}

/**
 * Get user's organization ID
 * Supports organization switching via X-Organization-Id header
 */
async function getOrganizationId(userId: string, request?: NextRequest): Promise<string> {
  try {
    const { prisma } = await import('src/lib/prisma');

    // Check if user has selected a specific organization (from X-Organization-Id header)
    const selectedOrgId = request?.headers.get('x-organization-id');

    console.log('DEBUG: Organization selection', {
      userId,
      selectedOrgId,
      hasHeader: !!selectedOrgId,
    });

    if (selectedOrgId) {
      // Validate that user is an active member of the selected organization
      const membership = await prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId: selectedOrgId,
          isActive: true,
        },
        include: {
          organization: true,
        },
      });

      console.log('DEBUG: Organization membership check', {
        userId,
        selectedOrgId,
        membershipFound: !!membership,
        actualOrgId: membership?.organization?.id,
      });

      if (membership?.organization) {
        // User has valid access to selected organization
        console.log(`User ${userId} switched to organization ${selectedOrgId}`);
        return membership.organization.id;
      }

      // User tried to access organization they don't belong to
      console.warn(
        `Security: User ${userId} attempted to access organization ${selectedOrgId} without permission`
      );
      // Fall through to default behavior
    }

    // Fallback: Get user's primary organization (oldest membership)
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId,
        isActive: true,
      },
      include: {
        organization: true,
      },
      orderBy: {
        joinedAt: 'asc', // Get oldest membership as primary
      },
    });

    if (membership?.organization) {
      return membership.organization.id;
    }

    if (membership) {
      return membership.organizationId;
    }

    console.warn(`No organization found for user ${userId}, using default`);
    return 'default-org';
  } catch (error) {
    console.error('Failed to fetch organization from database:', error);
    return 'default-org';
  }
}

/**
 * Get user's subscription information
 */
async function getSubscriptionInfo(userId: string): Promise<{ tier: string; status: string }> {
  try {
    const { prisma } = await import('src/lib/prisma');

    // Get user's organization first
    const userMembership = await prisma.organizationMember.findFirst({
      where: { userId },
      select: { organizationId: true },
    });

    if (!userMembership) {
      return { tier: 'free', status: 'active' };
    }

    // Get organization's active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        billingAccount: {
          organizationId: userMembership.organizationId,
        },
        status: {
          in: ['ACTIVE', 'TRIALING', 'PAST_DUE'],
        },
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (subscription?.plan) {
      return {
        tier: subscription.plan.tier.toLowerCase(),
        status: subscription.status.toLowerCase(),
      };
    }

    // No subscription found - return free tier
    return { tier: 'free', status: 'active' };
  } catch (error) {
    console.error('Failed to fetch subscription from database:', error);
    return { tier: 'free', status: 'active' };
  }
}

/**
 * Check user subscription status and limits
 */
async function checkUserSubscription(userId: string, context: any) {
  // Check if subscription is active
  if (context.subscriptionTier === 'none') {
    return NextResponse.json(
      {
        success: false,
        error: 'Active subscription required to access engine services',
        code: 'SUBSCRIPTION_REQUIRED',
        upgradeUrl: '/dashboard/billing/plans',
      },
      { status: 402 } // Payment Required
    );
  }

  // Check subscription status
  if (context.subscriptionStatus !== 'active' && context.subscriptionStatus !== 'trialing') {
    return NextResponse.json(
      {
        success: false,
        error: `Subscription ${context.subscriptionStatus}. Please update billing information.`,
        code: 'SUBSCRIPTION_INACTIVE',
        manageUrl: '/dashboard/billing',
        status: context.subscriptionStatus,
      },
      { status: 402 }
    );
  }

  return null; // Subscription is valid
}

/**
 * Track resource usage for billing
 */
export async function trackEngineUsage(
  userId: string,
  resourceType: string,
  quantity: number = 1,
  metadata?: Record<string, any>
) {
  try {
    const { UsageTrackingService } = await import('src/lib/services/usage-tracking-service');
    const { prisma } = await import('src/lib/prisma');

    // Get user's subscription
    const userMembership = await prisma.organizationMember.findFirst({
      where: { userId, isActive: true },
      select: { organizationId: true },
    });

    if (!userMembership) {
      console.warn('No organization membership found for user', { userId });
      return;
    }

    // Get organization's active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        billingAccount: {
          organizationId: userMembership.organizationId,
        },
        status: {
          in: ['ACTIVE', 'TRIALING', 'PAST_DUE'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      console.info('No active subscription found for tracking', { userId });
      return;
    }

    // Map resourceType to usage metric
    const metricMapping: Record<string, string> = {
      project: 'projects',
      execution: 'executions',
      workflow_run: 'workflow_runs',
      storage: 'storage_bytes',
      api_call: 'api_calls',
      user: 'users',
    };

    const metric = metricMapping[resourceType] || resourceType;

    // Track usage
    const usageService = new UsageTrackingService();
    await usageService.trackUsage({
      subscriptionId: subscription.id,
      projectId: metadata?.projectId || 'system',
      metric: metric as any,
      quantity,
      unit: resourceType === 'storage' ? 'bytes' : 'count',
      metadata: {
        ...metadata,
        userId,
        timestamp: new Date().toISOString(),
      },
    });

    console.log('✅ Usage tracked successfully:', {
      userId,
      subscriptionId: subscription.id,
      metric,
      quantity,
    });
  } catch (error) {
    console.error('Failed to track usage:', error);
    // Don't throw - usage tracking failure shouldn't block operations
  }
}

/**
 * Check if user can perform operation based on usage limits
 */
export async function checkUsageLimit(
  userId: string,
  resourceType: string,
  quantity: number = 1
): Promise<{ allowed: boolean; reason?: string; current?: number; limit?: number }> {
  try {
    const { UsageTrackingService } = await import('src/lib/services/usage-tracking-service');
    const { prisma } = await import('src/lib/prisma');

    // Get user's subscription
    const userMembership = await prisma.organizationMember.findFirst({
      where: { userId, isActive: true },
      select: { organizationId: true },
    });

    if (!userMembership) {
      // No organization - allow with warning
      console.warn('No organization membership found for limit check', { userId });
      return { allowed: true };
    }

    // Get organization's active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        billingAccount: {
          organizationId: userMembership.organizationId,
        },
        status: {
          in: ['ACTIVE', 'TRIALING', 'PAST_DUE'],
        },
      },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      // No subscription - use FREE tier limits
      const freeLimits: Record<string, number> = {
        projects: 3,
        executions: 100,
        workflow_runs: 100,
        storage_bytes: 1073741824, // 1 GB
        users: 1,
      };

      const limit = freeLimits[resourceType];
      if (limit === undefined) {
        return { allowed: true }; // No limit defined for this resource
      }

      // Check current usage (simplified - would need actual tracking)
      return {
        allowed: true, // For now, allow but track
        reason: 'Using FREE tier limits',
        limit,
      };
    }

    // Get plan limits
    const limits = subscription.plan.limits as any;
    const limit = limits[resourceType];

    // -1 means unlimited
    if (limit === -1 || limit === undefined) {
      return { allowed: true };
    }

    // Get current usage
    const metricMapping: Record<string, string> = {
      project: 'PROJECTS',
      execution: 'EXECUTIONS',
      storage: 'STORAGE_GB',
      user: 'USERS',
    };
    const metric = metricMapping[resourceType] || resourceType;

    const currentUsage = await UsageTrackingService.getCurrentUsage({
      subscriptionId: subscription.id,
      metrics: [metric as any],
    });

    const current = currentUsage[metric] || 0;

    // Check if adding this quantity would exceed limit
    if (current + quantity > limit) {
      return {
        allowed: false,
        reason: `${resourceType} limit reached`,
        current,
        limit,
      };
    }

    return {
      allowed: true,
      current,
      limit,
    };
  } catch (error) {
    console.error('Failed to check usage limit:', error);
    // On error, allow operation to prevent blocking legitimate users
    return { allowed: true, reason: 'Limit check failed, allowing operation' };
  }
}

/**
 * Audit log engine operations
 */
export async function auditEngineOperation(
  userId: string,
  operation: string,
  resource: string,
  resourceId?: string,
  details?: Record<string, any>
) {
  try {
    // Import and use the audit service
    const { logAuditEvent } = await import('./audit-service');
    await logAuditEvent({
      userId,
      action: operation,
      resource,
      resourceId,
      projectId: details?.project || 'default',
      details,
    });
  } catch (error) {
    // Fallback to console logging if database fails
    console.error('Failed to create audit log, falling back to console:', error);
    console.log('📝 Audit log (fallback):', {
      userId,
      operation,
      resource,
      resourceId,
      timestamp: new Date().toISOString(),
      details,
    });
  }
}

/**
 * Check tier-based limits
 */
export async function checkTierLimit(
  userId: string,
  tier: string,
  resourceType: string,
  operation: string
): Promise<{
  allowed: boolean;
  reason?: string;
  upgradeUrl?: string;
  current?: number;
  limit?: number;
}> {
  const { getTierLimits } = await import('../billing/tier-limits');
  const limits = getTierLimits(tier);

  // Check resource-specific limits
  if (resourceType === 'workflows' && operation === 'create') {
    const count = await getResourceCount(userId, 'workflows');
    if (count >= limits.maxWorkflows) {
      return {
        allowed: false,
        reason: `Workflow limit reached (${limits.maxWorkflows} for ${tier} tier)`,
        upgradeUrl: '/dashboard/billing/plans',
        current: count,
        limit: limits.maxWorkflows,
      };
    }
  }

  if (resourceType === 'executions' && operation === 'create') {
    const count = await getMonthlyCount(userId, 'executions');
    if (count >= limits.maxExecutionsPerMonth) {
      return {
        allowed: false,
        reason: `Monthly execution limit reached (${limits.maxExecutionsPerMonth} for ${tier} tier)`,
        upgradeUrl: '/dashboard/billing/plans',
        current: count,
        limit: limits.maxExecutionsPerMonth,
      };
    }
  }

  if (resourceType === 'projects' && operation === 'create') {
    const count = await getResourceCount(userId, 'projects');
    if (count >= limits.maxProjects) {
      return {
        allowed: false,
        reason: `Project limit reached (${limits.maxProjects} for ${tier} tier)`,
        upgradeUrl: '/dashboard/billing/plans',
        current: count,
        limit: limits.maxProjects,
      };
    }
  }

  // Check feature flags
  if (operation === 'customContainer' && !limits.features.customContainers) {
    return {
      allowed: false,
      reason: 'Custom containers not available in your tier',
      upgradeUrl: '/dashboard/billing/plans',
    };
  }

  if (operation === 'advancedScheduling' && !limits.features.advancedScheduling) {
    return {
      allowed: false,
      reason: 'Advanced scheduling not available in your tier',
      upgradeUrl: '/dashboard/billing/plans',
    };
  }

  return { allowed: true };
}

/**
 * Get resource count for user
 */
async function getResourceCount(userId: string, resourceType: string): Promise<number> {
  try {
    const { prisma } = await import('src/lib/prisma');

    // Get user's organization
    const orgId = await getOrganizationId(userId);

    switch (resourceType) {
      case 'workflows': {
        const count = await prisma.workflow.count({
          where: {
            organizationId: orgId,
            isDeleted: false,
          },
        });
        return count;
      }

      case 'projects': {
        const count = await prisma.project.count({
          where: {
            organizationId: orgId,
            isArchived: false,
          },
        });
        return count;
      }

      default:
        console.warn(`Unknown resource type: ${resourceType}`);
        return 0;
    }
  } catch (error) {
    console.error(`Failed to fetch ${resourceType} count from database:`, error);
    return 0;
  }
}

/**
 * Get monthly resource count for user
 */
async function getMonthlyCount(userId: string, resourceType: string): Promise<number> {
  try {
    const { prisma } = await import('src/lib/prisma');

    // Get first day of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get user's organization
    const orgId = await getOrganizationId(userId);

    switch (resourceType) {
      case 'executions': {
        const count = await prisma.workflowExecution.count({
          where: {
            organizationId: orgId,
            createdAt: {
              gte: startOfMonth,
            },
          },
        });
        return count;
      }

      default:
        console.warn(`Unknown monthly resource type: ${resourceType}`);
        return 0;
    }
  } catch (error) {
    console.error(`Failed to fetch monthly ${resourceType} count from database:`, error);
    return 0;
  }
}

/**
 * Filter results by organization (for non-admins)
 */
export function filterByOrganization<T extends { organizationId?: string }>(
  items: T[],
  userOrgId: string,
  userRoles: string[]
): T[] {
  // Super admin and system admin can see everything
  const isAdmin = userRoles.some((r) => ['super-admin', 'system-admin'].includes(r));

  if (isAdmin) {
    return items;
  }

  // Filter to user's organization
  return items.filter((item) => item.organizationId === userOrgId);
}

/**
 * Check if user can access resource in organization
 */
export function canAccessOrganization(
  userOrgId: string,
  resourceOrgId: string,
  userRoles: string[]
): boolean {
  // Admins can access any organization
  const isAdmin = userRoles.some((r) => ['super-admin', 'system-admin'].includes(r));

  if (isAdmin) {
    return true;
  }

  // Regular users can only access their own organization
  return userOrgId === resourceOrgId;
}
