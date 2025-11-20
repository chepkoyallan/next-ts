// Workflow marketplace API endpoints
import { z } from 'zod';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';
import {
  LicenseType,
  PurchaseStatus,
  WorkflowPricing,
  WorkflowCategory,
  WorkflowPurchase,
  MarketplaceStatus,
  MarketplaceWorkflow,
} from '../../../lib/types/billing';

// Validation schemas
const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Workflow name is required').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  category: z.enum([
    'data_processing',
    'ml_training',
    'etl',
    'monitoring',
    'automation',
    'analytics',
  ]),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (x.y.z)'),
  pricing: z.object({
    model: z.enum(['free', 'one_time', 'subscription', 'usage_based']),
    price: z.number().min(0),
    currency: z.string().length(3).default('USD'),
    trialPeriod: z.number().min(0).max(90).optional(),
  }),
  tags: z.array(z.string()).max(10),
  workflowSpec: z.object({
    // This would contain the actual workflow definition
    // Structure depends on your orchestrator format
    version: z.string(),
    tasks: z.array(z.any()),
    dependencies: z.record(z.string(), z.any()).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  documentation: z.object({
    readme: z.string().min(50, 'README must be at least 50 characters'),
    examples: z
      .array(
        z.object({
          title: z.string(),
          description: z.string(),
          code: z.string(),
        })
      )
      .optional(),
    changelog: z.string().optional(),
  }),
  requirements: z
    .object({
      minCpu: z.number().min(0.1).optional(),
      minMemory: z.number().min(0.5).optional(),
      dependencies: z.array(z.string()).optional(),
      permissions: z.array(z.string()).optional(),
    })
    .optional(),
});

// const updateWorkflowSchema = createWorkflowSchema.partial().extend({
//   status: z.enum(['draft', 'pending_review', 'approved', 'rejected', 'suspended']).optional(),
// });

const searchWorkflowsSchema = z.object({
  query: z.string().optional(),
  category: z
    .enum(['data_processing', 'ml_training', 'etl', 'monitoring', 'automation', 'analytics'])
    .optional(),
  pricing: z.enum(['free', 'paid']).optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  sortBy: z.enum(['popularity', 'rating', 'recent', 'price']).default('popularity'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().min(1).max(50).default(20),
  offset: z.number().min(0).default(0),
});

// const purchaseWorkflowSchema = z.object({
//   workflowId: z.string().min(1),
//   licenseType: z.enum(['single_use', 'unlimited', 'team', 'enterprise']).default('single_use'),
//   projectId: z.string().min(1),
//   paymentMethodId: z.string().optional(),
// });

// Mock marketplace service (replace with actual implementation)
class MarketplaceService {
  private db: any;

  private paymentService: any;

  constructor(db: any, paymentService: any) {
    this.db = db;
    this.paymentService = paymentService;
  }

  async createWorkflow(authorId: string, workflowData: any): Promise<MarketplaceWorkflow> {
    const workflow: MarketplaceWorkflow = {
      id: MarketplaceService.generateId(),
      name: workflowData.name,
      description: workflowData.description,
      category: workflowData.category,
      authorId,
      authorName: await MarketplaceService.getAuthorName(authorId),
      version: workflowData.version,
      pricing: workflowData.pricing,
      ratings: { average: 0, count: 0, distribution: {} },
      downloads: 0,
      revenue: 0,
      status: MarketplaceStatus.DRAFT,
      tags: workflowData.tags,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store workflow and spec separately
    await this.db.marketplaceWorkflows.create(workflow);
    await this.db.workflowSpecs.create({
      workflowId: workflow.id,
      spec: workflowData.workflowSpec,
      documentation: workflowData.documentation,
      requirements: workflowData.requirements,
    });

    return workflow;
  }

  async searchWorkflows(
    criteria: any
  ): Promise<{ workflows: MarketplaceWorkflow[]; total: number }> {
    // Implement search logic
    const workflows = await this.db.marketplaceWorkflows.search(criteria);
    const total = await this.db.marketplaceWorkflows.count(criteria);
    return { workflows, total };
  }

  async purchaseWorkflow(buyerId: string, purchaseData: any): Promise<WorkflowPurchase> {
    const workflow = await this.db.marketplaceWorkflows.findById(purchaseData.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Calculate pricing based on license type
    const price = MarketplaceService.calculatePrice(workflow.pricing, purchaseData.licenseType);
    const platformFee = price * 0.3; // 30% platform fee
    const sellerRevenue = price - platformFee;

    const purchase: WorkflowPurchase = {
      id: MarketplaceService.generateId(),
      workflowId: workflow.id,
      buyerId,
      sellerId: workflow.authorId,
      price,
      currency: workflow.pricing.currency,
      revenueShare: 30,
      platformFee,
      sellerRevenue,
      status: PurchaseStatus.PENDING,
      licenseType: purchaseData.licenseType,
      purchasedAt: new Date(),
    };

    // Process payment
    if (price > 0) {
      const paymentResult = await MarketplaceService.processPayment(
        purchase,
        purchaseData.paymentMethodId
      );
      if (!paymentResult.success) {
        throw new Error('Payment failed');
      }
    }

    purchase.status = PurchaseStatus.COMPLETED;
    await this.db.workflowPurchases.create(purchase);

    // Update workflow stats
    await this.updateWorkflowStats(workflow.id, { downloads: 1, revenue: sellerRevenue });

    return purchase;
  }

  private static generateId(): string {
    return `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private static async getAuthorName(authorId: string): Promise<string> {
    // Get author name from user service
    return 'Author Name'; // Placeholder
  }

  private static calculatePrice(pricing: WorkflowPricing, licenseType: LicenseType): number {
    let multiplier = 1;

    switch (licenseType) {
      case LicenseType.SINGLE_USE:
        multiplier = 1;
        break;
      case LicenseType.UNLIMITED:
        multiplier = 3;
        break;
      case LicenseType.TEAM:
        multiplier = 5;
        break;
      case LicenseType.ENTERPRISE:
        multiplier = 10;
        break;
      default:
        multiplier = 1;
        break;
    }

    return pricing.price * multiplier;
  }

  private static async processPayment(
    purchase: WorkflowPurchase,
    paymentMethodId?: string
  ): Promise<{ success: boolean }> {
    // Integrate with your payment service
    return { success: true };
  }

  private async updateWorkflowStats(workflowId: string, updates: any): Promise<void> {
    await this.db.marketplaceWorkflows.updateStats(workflowId, updates);
  }
}

const marketplaceService = new MarketplaceService(null, null); // Inject dependencies

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: false, // Some endpoints are public
      permissions: [],
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'POST'],
  },
  {
    // Search/list workflows
    GET: async ({ query, context, auth }) => {
      try {
        const validation = searchWorkflowsSchema.safeParse(query);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid search parameters',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const searchCriteria = validation.data;

        // Only show approved workflows to non-admin users
        const isAdmin =
          (auth.user as any)?.roles?.includes('admin') ||
          (auth.user as any)?.roles?.includes('marketplace-admin');

        if (!isAdmin) {
          (searchCriteria as any).status = MarketplaceStatus.APPROVED;
        }

        const { workflows, total } = await marketplaceService.searchWorkflows(searchCriteria);

        logger.info('Workflows searched', {
          query: searchCriteria.query,
          category: searchCriteria.category,
          resultCount: workflows.length,
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            workflows,
            pagination: {
              limit: searchCriteria.limit,
              offset: searchCriteria.offset,
              total,
              hasMore: searchCriteria.offset + searchCriteria.limit < total,
            },
            filters: {
              categories: Object.values(WorkflowCategory),
              pricingModels: ['free', 'one_time', 'subscription', 'usage_based'],
            },
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to search workflows', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to search workflows' },
          context.requestId
        );
      }
    },

    // Create new workflow
    POST: async ({ body, context, auth }) => {
      try {
        if (!auth.user) {
          return createErrorResponse(
            'UNAUTHORIZED',
            { message: 'Authentication required to create workflows' },
            context.requestId
          );
        }

        const validation = createWorkflowSchema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid workflow data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const workflowData = validation.data!;

        // Check if user can create workflows (might require specific plan)
        // const canCreateWorkflows = await this.checkWorkflowCreationPermission(auth.user.id);
        const canCreateWorkflows = true; // Simplified for now
        if (!canCreateWorkflows) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'Workflow creation requires Professional plan or higher',
              upgradeUrl: '/dashboard/billing/plans?feature=marketplace-seller',
            },
            context.requestId
          );
        }

        // Create workflow
        const workflow = await marketplaceService.createWorkflow(auth.user.id, workflowData);

        logger.info('Workflow created', {
          workflowId: workflow.id,
          name: workflow.name,
          category: workflow.category,
          authorId: auth.user.id,
          requestId: context.requestId,
        });

        return createSuccessResponse(
          {
            workflow,
            message: 'Workflow created successfully. It will be reviewed before being published.',
          },
          201,
          context.requestId
        );
      } catch (error) {
        logger.error('Failed to create workflow', error as Error, {
          userId: auth.user?.id,
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to create workflow' },
          context.requestId
        );
      }
    },
  }
);

// Helper method to check workflow creation permission
// async function checkWorkflowCreationPermission(userId: string): Promise<boolean> {
//   // This would integrate with your feature gating system
//   // For now, allow all authenticated users
//   return true;
// }

export const GET = handler;
export const POST = handler;
