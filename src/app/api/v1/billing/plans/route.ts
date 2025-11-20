// Subscription plans API endpoints
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { PlanTier, UsageMetric, SubscriptionPlan } from '../../../lib/types/billing';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schemas
const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  description: z.string().min(1, 'Plan description is required'),
  tier: z.enum(['free', 'starter', 'professional', 'enterprise']),
  pricing: z.object({
    basePrice: z.number().min(0),
    currency: z.string().length(3),
    billingInterval: z.enum(['monthly', 'yearly']),
    usagePricing: z.array(
      z.object({
        metric: z.enum([
          'executions',
          'cpu_hours',
          'memory_gb_hours',
          'storage_gb',
          'network_gb',
          'users',
          'projects',
        ]),
        price: z.number().min(0),
        includedUnits: z.number().min(0),
        overage: z.number().min(0),
      })
    ),
    discounts: z
      .array(
        z.object({
          type: z.enum(['percentage', 'fixed']),
          value: z.number().min(0),
          duration: z.number().optional(),
          code: z.string().optional(),
        })
      )
      .optional(),
  }),
  features: z.object({
    maxExecutions: z.union([z.number(), z.literal('unlimited')]),
    maxConcurrency: z.number().min(1),
    maxDuration: z.string(),
    features: z.array(z.string()),
    support: z.enum(['community', 'email', 'priority', 'dedicated']),
    sla: z
      .object({
        uptime: z.string(),
        responseTime: z.string(),
        resolution: z.string(),
      })
      .optional(),
  }),
  limits: z.object({
    cpu: z.number().min(0),
    memory: z.number().min(0),
    storage: z.number().min(0),
    bandwidth: z.number().min(0),
    users: z.number().min(1),
    projects: z.number().min(1),
    domains: z.number().min(1),
  }),
});

// const updatePlanSchema = createPlanSchema.partial().extend({
//   isActive: z.boolean().optional(),
// });

// Default plans configuration
const DEFAULT_PLANS: Partial<SubscriptionPlan>[] = [
  {
    name: 'Free',
    description: 'Perfect for getting started with workflow orchestration',
    tier: PlanTier.FREE,
    pricing: {
      basePrice: 0,
      currency: 'USD',
      billingInterval: 'monthly',
      usagePricing: [
        { metric: UsageMetric.EXECUTIONS, price: 0, includedUnits: 100, overage: 0.01 },
        { metric: UsageMetric.CPU_HOURS, price: 0, includedUnits: 10, overage: 0.05 },
        { metric: UsageMetric.MEMORY_GB_HOURS, price: 0, includedUnits: 20, overage: 0.01 },
      ],
    },
    features: {
      maxExecutions: 100,
      maxConcurrency: 2,
      maxDuration: '1h',
      features: ['basic-workflows', 'community-support'],
      support: 'community',
    },
    limits: {
      cpu: 2,
      memory: 4,
      storage: 10,
      bandwidth: 100,
      users: 3,
      projects: 1,
      domains: 2,
    },
    isActive: true,
  },
  {
    name: 'Starter',
    description: 'Ideal for small teams and growing projects',
    tier: PlanTier.STARTER,
    pricing: {
      basePrice: 49,
      currency: 'USD',
      billingInterval: 'monthly',
      usagePricing: [
        { metric: UsageMetric.EXECUTIONS, price: 0, includedUnits: 1000, overage: 0.008 },
        { metric: UsageMetric.CPU_HOURS, price: 0, includedUnits: 100, overage: 0.04 },
        { metric: UsageMetric.MEMORY_GB_HOURS, price: 0, includedUnits: 200, overage: 0.008 },
      ],
    },
    features: {
      maxExecutions: 1000,
      maxConcurrency: 5,
      maxDuration: '6h',
      features: ['advanced-workflows', 'scheduling', 'email-notifications', 'basic-analytics'],
      support: 'email',
    },
    limits: {
      cpu: 8,
      memory: 16,
      storage: 100,
      bandwidth: 1000,
      users: 10,
      projects: 5,
      domains: 10,
    },
    isActive: true,
  },
  {
    name: 'Professional',
    description: 'Perfect for professional teams with advanced needs',
    tier: PlanTier.PROFESSIONAL,
    pricing: {
      basePrice: 199,
      currency: 'USD',
      billingInterval: 'monthly',
      usagePricing: [
        { metric: UsageMetric.EXECUTIONS, price: 0, includedUnits: 10000, overage: 0.006 },
        { metric: UsageMetric.CPU_HOURS, price: 0, includedUnits: 500, overage: 0.03 },
        { metric: UsageMetric.MEMORY_GB_HOURS, price: 0, includedUnits: 1000, overage: 0.006 },
      ],
    },
    features: {
      maxExecutions: 10000,
      maxConcurrency: 20,
      maxDuration: '24h',
      features: [
        'all-workflow-types',
        'advanced-scheduling',
        'webhooks',
        'advanced-analytics',
        'custom-integrations',
        'priority-support',
      ],
      support: 'priority',
      sla: {
        uptime: '99.9%',
        responseTime: '< 4h',
        resolution: '< 24h',
      },
    },
    limits: {
      cpu: 32,
      memory: 64,
      storage: 500,
      bandwidth: 5000,
      users: 50,
      projects: 25,
      domains: 50,
    },
    isActive: true,
  },
  {
    name: 'Enterprise',
    description: 'For large organizations with enterprise requirements',
    tier: PlanTier.ENTERPRISE,
    pricing: {
      basePrice: 999,
      currency: 'USD',
      billingInterval: 'monthly',
      usagePricing: [
        { metric: UsageMetric.EXECUTIONS, price: 0, includedUnits: 100000, overage: 0.004 },
        { metric: UsageMetric.CPU_HOURS, price: 0, includedUnits: 2000, overage: 0.02 },
        { metric: UsageMetric.MEMORY_GB_HOURS, price: 0, includedUnits: 4000, overage: 0.004 },
      ],
    },
    features: {
      maxExecutions: 'unlimited',
      maxConcurrency: 100,
      maxDuration: 'unlimited',
      features: [
        'all-features',
        'dedicated-clusters',
        'multi-cloud',
        'compliance-suite',
        'advanced-security',
        'custom-sla',
        'dedicated-support',
      ],
      support: 'dedicated',
      sla: {
        uptime: '99.99%',
        responseTime: '< 1h',
        resolution: '< 4h',
      },
    },
    limits: {
      cpu: 1000,
      memory: 2000,
      storage: 10000,
      bandwidth: 50000,
      users: 500,
      projects: 100,
      domains: 200,
    },
    isActive: true,
  },
];

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: false, // Plans are public for viewing
      permissions: [],
    },
    rateLimit: rateLimitConfigs.lenient,
    allowedMethods: ['GET', 'POST'],
  },
  {
    // List subscription plans
    GET: async ({ query, context, auth }) => {
      try {
        const includeInactive = query?.includeInactive === 'true';
        const tier = query?.tier as PlanTier;

        // Build where clause
        const where: any = {};
        if (tier) {
          where.tier = tier.toUpperCase();
        }
        if (!includeInactive) {
          where.isActive = true;
        }

        // Get plans from database
        let plans = await prisma.subscriptionPlan.findMany({
          where,
          orderBy: [{ tier: 'asc' }, { createdAt: 'asc' }],
        });

        // If no plans in database, return defaults
        if (!plans || plans.length === 0) {
          plans = DEFAULT_PLANS.map((plan, index) => ({
            id: `plan-${index + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...plan,
          })) as any[];
        }

        // Filter out inactive plans for non-admin users
        const isAdmin =
          (auth.user as any)?.roles?.includes('admin') ||
          (auth.user as any)?.roles?.includes('billing-admin') ||
          (auth.user as any)?.roles?.includes('system-admin');

        if (!isAdmin && !includeInactive) {
          plans = plans.filter((plan) => plan.isActive);
        }

        logger.info('Subscription plans listed', {
          count: plans.length,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            plans,
            meta: {
              total: plans.length,
              activeCount: plans.filter((p) => p.isActive).length,
            },
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to list subscription plans', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to list subscription plans' },
          context.requestId
        );
      }
    },

    // Create subscription plan (admin only)
    POST: async ({ body, context, auth }) => {
      try {
        // Check admin permissions
        const isAdmin =
          (auth.user as any)?.roles?.includes('admin') ||
          (auth.user as any)?.roles?.includes('billing-admin');

        if (!isAdmin) {
          return createErrorResponse(
            'FORBIDDEN',
            { message: 'Admin access required to create plans' },
            context.requestId
          );
        }

        const validation = createPlanSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid plan data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const planData = validation.data;

        // Check if plan with same name exists
        const existingPlan = await prisma.subscriptionPlan.findFirst({
          where: { name: planData.name },
        });

        if (existingPlan) {
          return createErrorResponse(
            'RESOURCE_ALREADY_EXISTS',
            { message: 'Plan with this name already exists' },
            context.requestId
          );
        }

        // Create plan
        const plan = await prisma.subscriptionPlan.create({
          data: {
            name: planData.name,
            description: planData.description,
            tier: planData.tier.toUpperCase() as any,
            pricing: planData.pricing as any,
            features: planData.features as any,
            limits: planData.limits as any,
            isActive: true,
          },
        });

        logger.info('Subscription plan created', {
          planId: plan.id,
          name: plan.name,
          tier: plan.tier,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse({ plan }, 201, context.requestId);
      } catch (error) {
        logger.error('Failed to create subscription plan', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to create subscription plan' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
