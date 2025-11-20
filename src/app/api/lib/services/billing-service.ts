// Comprehensive billing service for orchestrator platform
import { logger } from '../utils/logger';
import {
  Invoice,
  PlanTier,
  UsageMetric,
  UsageRecord,
  BillingAlert,
  Subscription,
  ExecutionCost,
  InvoiceStatus,
  ResourceUsage,
  BillingAccount,
  ExecutionUsage,
  UsageAnalytics,
  SubscriptionPlan,
  SubscriptionStatus,
  UsageReportRequest,
  UsageReportResponse,
  BillingAccountStatus,
  BillingDashboardData,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
} from '../types/billing';

export class BillingService {
  private db: any; // Replace with your database connection

  private paymentService: any; // Your existing payment service

  constructor(db: any, paymentService: any) {
    this.db = db;
    this.paymentService = paymentService;
  }

  // ============================================================================
  // BILLING ACCOUNT MANAGEMENT
  // ============================================================================

  async createBillingAccount(data: Partial<BillingAccount>): Promise<BillingAccount> {
    try {
      const billingAccount: BillingAccount = {
        id: BillingService.generateId(),
        organizationId: data.organizationId!,
        name: data.name!,
        email: data.email!,
        billingAddress: data.billingAddress!,
        paymentMethods: data.paymentMethods || [],
        currency: data.currency || 'USD',
        status: data.status || BillingAccountStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };

      // Store in database
      await this.db.billingAccounts.create(billingAccount);

      logger.info('Billing account created', {
        billingAccountId: billingAccount.id,
        organizationId: billingAccount.organizationId,
      });

      return billingAccount;
    } catch (error) {
      logger.error('Failed to create billing account', error as Error);
      throw error;
    }
  }

  async getBillingAccountById(id: string): Promise<BillingAccount | null> {
    try {
      return this.db.billingAccounts.findById(id);
    } catch (error) {
      logger.error('Failed to get billing account', error as Error);
      return null;
    }
  }

  async getBillingAccount(id: string): Promise<BillingAccount | null> {
    return this.getBillingAccountById(id);
  }

  async updateBillingAccount(
    id: string,
    updates: Partial<BillingAccount>
  ): Promise<BillingAccount> {
    try {
      const updatedAccount = await this.db.billingAccounts.update(id, {
        ...updates,
        updatedAt: new Date(),
      });

      logger.info('Billing account updated', { billingAccountId: id });
      return updatedAccount;
    } catch (error) {
      logger.error('Failed to update billing account', error as Error, { billingAccountId: id });
      throw error;
    }
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    try {
      const plan = await this.getSubscriptionPlan(request.planId);
      if (!plan) {
        throw new Error(`Plan not found: ${request.planId}`);
      }

      const now = new Date();
      const trialEnd = request.trialDays
        ? new Date(now.getTime() + request.trialDays * 24 * 60 * 60 * 1000)
        : undefined;

      const subscription: Subscription = {
        id: BillingService.generateId(),
        billingAccountId: request.billingAccountId,
        projectId: request.projectId,
        planId: request.planId,
        status: trialEnd ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: BillingService.calculatePeriodEnd(now, plan.pricing.billingInterval),
        trialStart: trialEnd ? now : undefined,
        trialEnd,
        metadata: request.metadata || {},
        createdAt: now,
        updatedAt: now,
      };

      await this.db.subscriptions.create(subscription);

      // Create initial invoice if not in trial
      if (!trialEnd) {
        await this.createInvoiceForSubscription(subscription.id);
      }

      logger.info('Subscription created', {
        subscriptionId: subscription.id,
        projectId: request.projectId,
        planId: request.planId,
      });

      return subscription;
    } catch (error) {
      logger.error('Failed to create subscription', error as Error);
      throw error;
    }
  }

  async updateSubscription(id: string, request: UpdateSubscriptionRequest): Promise<Subscription> {
    try {
      const subscription = await this.db.subscriptions.findById(id);
      if (!subscription) {
        throw new Error(`Subscription not found: ${id}`);
      }

      const updates: Partial<Subscription> = {
        ...request,
        updatedAt: new Date(),
      };

      // Handle plan changes
      if (request.planId && request.planId !== subscription.planId) {
        await BillingService.handlePlanChange(subscription, request.planId);
      }

      const updatedSubscription = await this.db.subscriptions.update(id, updates);

      logger.info('Subscription updated', { subscriptionId: id });
      return updatedSubscription;
    } catch (error) {
      logger.error('Failed to update subscription', error as Error, { subscriptionId: id });
      throw error;
    }
  }

  // ============================================================================
  // USAGE TRACKING
  // ============================================================================

  async trackExecutionUsage(executionUsage: ExecutionUsage): Promise<UsageRecord[]> {
    try {
      const subscription = await this.getSubscriptionByProject(executionUsage.projectId);
      if (!subscription) {
        logger.warn('No subscription found for project', { projectId: executionUsage.projectId });
        return [];
      }

      const usageRecords: UsageRecord[] = [];
      const timestamp = new Date();

      // Track execution count
      usageRecords.push({
        id: BillingService.generateId(),
        subscriptionId: subscription.id,
        projectId: executionUsage.projectId,
        executionId: executionUsage.executionId,
        metric: UsageMetric.EXECUTIONS,
        quantity: 1,
        unit: 'execution',
        timestamp,
        metadata: {
          executionId: executionUsage.executionId,
          workflowId: executionUsage.workflowId.name,
          domain: executionUsage.domain,
          status: executionUsage.status,
          duration: executionUsage.duration,
        },
        cost: executionUsage.cost.total,
        currency: executionUsage.cost.currency,
      });

      // Track CPU usage
      if (executionUsage.resourceUsage.cpu.used > 0) {
        usageRecords.push({
          id: BillingService.generateId(),
          subscriptionId: subscription.id,
          projectId: executionUsage.projectId,
          executionId: executionUsage.executionId,
          metric: UsageMetric.CPU_HOURS,
          quantity: executionUsage.resourceUsage.cpu.used,
          unit: 'cpu-hour',
          timestamp,
          metadata: {
            executionId: executionUsage.executionId,
            requested: executionUsage.resourceUsage.cpu.requested,
            peak: executionUsage.resourceUsage.cpu.peak,
          },
          cost: executionUsage.cost.compute,
          currency: executionUsage.cost.currency,
        });
      }

      // Track memory usage
      if (executionUsage.resourceUsage.memory.used > 0) {
        usageRecords.push({
          id: BillingService.generateId(),
          subscriptionId: subscription.id,
          projectId: executionUsage.projectId,
          executionId: executionUsage.executionId,
          metric: UsageMetric.MEMORY_GB_HOURS,
          quantity: executionUsage.resourceUsage.memory.used,
          unit: 'gb-hour',
          timestamp,
          metadata: {
            executionId: executionUsage.executionId,
            requested: executionUsage.resourceUsage.memory.requested,
            peak: executionUsage.resourceUsage.memory.peak,
          },
          cost: executionUsage.cost.compute * 0.3, // Approximate memory cost
          currency: executionUsage.cost.currency,
        });
      }

      // Store usage records
      await this.db.usageRecords.createMany(usageRecords);

      logger.info('Execution usage tracked', {
        executionId: executionUsage.executionId,
        recordCount: usageRecords.length,
        totalCost: executionUsage.cost.total,
      });

      return usageRecords;
    } catch (error) {
      logger.error('Failed to track execution usage', error as Error);
      throw error;
    }
  }

  static async calculateExecutionCost(
    resourceUsage: ResourceUsage,
    duration: number,
    planTier: PlanTier
  ): Promise<ExecutionCost> {
    try {
      const pricing = BillingService.getPricingForTier(planTier);

      const computeCost =
        resourceUsage.cpu.used * pricing.cpuHourRate +
        resourceUsage.memory.used * pricing.memoryGBHourRate;

      const storageCost =
        (resourceUsage.storage.input +
          resourceUsage.storage.output +
          resourceUsage.storage.temporary) *
        pricing.storageGBRate;

      const networkCost =
        (resourceUsage.network.ingress + resourceUsage.network.egress) * pricing.networkGBRate;

      const total = computeCost + storageCost + networkCost;

      return {
        compute: computeCost,
        storage: storageCost,
        network: networkCost,
        total,
        currency: 'USD',
        breakdown: [
          {
            component: 'CPU',
            quantity: resourceUsage.cpu.used,
            unit: 'cpu-hour',
            rate: pricing.cpuHourRate,
            cost: resourceUsage.cpu.used * pricing.cpuHourRate,
          },
          {
            component: 'Memory',
            quantity: resourceUsage.memory.used,
            unit: 'gb-hour',
            rate: pricing.memoryGBHourRate,
            cost: resourceUsage.memory.used * pricing.memoryGBHourRate,
          },
          {
            component: 'Storage',
            quantity:
              resourceUsage.storage.input +
              resourceUsage.storage.output +
              resourceUsage.storage.temporary,
            unit: 'gb',
            rate: pricing.storageGBRate,
            cost: storageCost,
          },
          {
            component: 'Network',
            quantity: resourceUsage.network.ingress + resourceUsage.network.egress,
            unit: 'gb',
            rate: pricing.networkGBRate,
            cost: networkCost,
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to calculate execution cost', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // ANALYTICS & REPORTING
  // ============================================================================

  async getBillingDashboard(billingAccountId: string): Promise<BillingDashboardData> {
    try {
      const subscription = await this.getActiveSubscriptionByBillingAccount(billingAccountId);
      const plan = subscription ? await this.getSubscriptionPlan(subscription.planId) : null;

      const currentUsage = await this.getCurrentUsageAnalytics(subscription?.projectId || '');
      const upcomingInvoice = await this.getUpcomingInvoice(billingAccountId);
      const paymentHistory = await this.getPaymentHistory(billingAccountId);
      const alerts = await this.getBillingAlerts(billingAccountId);

      return {
        currentUsage,
        upcomingInvoice,
        paymentHistory,
        subscription: subscription!,
        plan: plan!,
        alerts,
      };
    } catch (error) {
      logger.error('Failed to get billing dashboard', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // INVOICING
  // ============================================================================

  async createInvoiceForSubscription(subscriptionId: string): Promise<Invoice> {
    try {
      const subscription = await this.db.subscriptions.findById(subscriptionId);
      const plan = await this.getSubscriptionPlan(subscription.planId);
      const usageRecords = await this.getUsageForBillingPeriod(subscription.projectId, {
        startDate: subscription.currentPeriodStart,
        endDate: subscription.currentPeriodEnd,
      });

      const invoice: Invoice = {
        id: BillingService.generateId(),
        number: BillingService.generateInvoiceNumber(),
        billingAccountId: subscription.billingAccountId,
        subscriptionId,
        status: InvoiceStatus.OPEN,
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        subtotal: 0,
        tax: 0,
        total: 0,
        currency: plan!.pricing.currency,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        lineItems: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add base subscription fee
      invoice.lineItems.push({
        id: BillingService.generateId(),
        description: `${plan!.name} - ${BillingService.formatPeriod(
          subscription.currentPeriodStart,
          subscription.currentPeriodEnd
        )}`,
        quantity: 1,
        unitPrice: plan!.pricing.basePrice,
        amount: plan!.pricing.basePrice,
      });

      // Add usage charges
      const usageCharges = BillingService.calculateUsageCharges(usageRecords, plan!);
      invoice.lineItems.push(...usageCharges);

      // Calculate totals
      invoice.subtotal = invoice.lineItems.reduce((sum, item) => sum + item.amount, 0);
      invoice.tax = invoice.subtotal * 0.1; // 10% tax (adjust based on jurisdiction)
      invoice.total = invoice.subtotal + invoice.tax;

      await this.db.invoices.create(invoice);

      logger.info('Invoice created', {
        invoiceId: invoice.id,
        subscriptionId,
        total: invoice.total,
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to create invoice', error as Error);
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private static generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `INV-${year}${month}-${random}`;
  }

  private static calculatePeriodEnd(start: Date, interval: 'monthly' | 'yearly'): Date {
    const end = new Date(start);
    if (interval === 'monthly') {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setFullYear(end.getFullYear() + 1);
    }
    return end;
  }

  private static formatPeriod(start: Date, end: Date): string {
    const startStr = start.toLocaleDateString();
    const endStr = end.toLocaleDateString();
    return `${startStr} - ${endStr}`;
  }

  private static getPricingForTier(tier: PlanTier) {
    const pricing = {
      [PlanTier.FREE]: {
        cpuHourRate: 0,
        memoryGBHourRate: 0,
        storageGBRate: 0,
        networkGBRate: 0,
      },
      [PlanTier.STARTER]: {
        cpuHourRate: 0.05,
        memoryGBHourRate: 0.01,
        storageGBRate: 0.001,
        networkGBRate: 0.001,
      },
      [PlanTier.PROFESSIONAL]: {
        cpuHourRate: 0.04,
        memoryGBHourRate: 0.008,
        storageGBRate: 0.0008,
        networkGBRate: 0.0008,
      },
      [PlanTier.ENTERPRISE]: {
        cpuHourRate: 0.03,
        memoryGBHourRate: 0.006,
        storageGBRate: 0.0006,
        networkGBRate: 0.0006,
      },
    };

    return pricing[tier];
  }

  // Placeholder methods - implement based on your database structure

  async getSubscriptionByProject(projectId: string): Promise<Subscription | null> {
    return this.db.subscriptions.findOne({ projectId });
  }

  private static async handlePlanChange(
    subscription: Subscription,
    newPlanId: string
  ): Promise<void> {
    // Implement plan change logic (prorations, etc.)
    logger.info('Plan change initiated', {
      subscriptionId: subscription.id,
      oldPlan: subscription.planId,
      newPlan: newPlanId,
    });
  }

  private static async calculateUsageAnalytics(
    usageRecords: UsageRecord[],
    request: UsageReportRequest
  ): Promise<UsageAnalytics> {
    // Implement analytics calculation
    return {} as UsageAnalytics;
  }

  private static calculateCostBreakdown(usageRecords: UsageRecord[]) {
    // Implement cost breakdown calculation
    return [];
  }

  async getActiveSubscriptionByBillingAccount(
    billingAccountId: string
  ): Promise<Subscription | null> {
    return this.db.subscriptions.findActiveByBillingAccount(billingAccountId);
  }

  private async getUpcomingInvoice(billingAccountId: string): Promise<Invoice> {
    return this.db.invoices.findUpcoming(billingAccountId);
  }

  private async getPaymentHistory(billingAccountId: string): Promise<Invoice[]> {
    return this.db.invoices.findByBillingAccount(billingAccountId);
  }

  private async getBillingAlerts(billingAccountId: string): Promise<BillingAlert[]> {
    return this.db.billingAlerts.findByBillingAccount(billingAccountId);
  }

  async getBillingAccountByOrganization(organizationId: string): Promise<BillingAccount | null> {
    try {
      return this.db.billingAccounts.findByOrganization(organizationId);
    } catch (error) {
      logger.error('Failed to get billing account by organization', error as Error);
      return null;
    }
  }

  async getActiveSubscriptionByProject(projectId: string): Promise<Subscription | null> {
    try {
      return this.db.subscriptions.findActiveByProject(projectId);
    } catch (error) {
      logger.error('Failed to get active subscription by project', error as Error);
      return null;
    }
  }

  async getSubscriptionPlan(planId: string): Promise<SubscriptionPlan | null> {
    try {
      return this.db.subscriptionPlans.findById(planId);
    } catch (error) {
      logger.error('Failed to get subscription plan', error as Error);
      return null;
    }
  }

  async getSubscriptionPlans(
    options: {
      includeInactive?: boolean;
      tier?: string;
    } = {}
  ): Promise<SubscriptionPlan[]> {
    try {
      const filters: Record<string, any> = {};

      if (!options.includeInactive) {
        filters.active = true;
      }

      if (options.tier) {
        filters.tier = options.tier;
      }

      return this.db.subscriptionPlans.findMany(filters);
    } catch (error) {
      logger.error('Failed to get subscription plans', error as Error);
      return [];
    }
  }

  async getPlanByName(name: string): Promise<SubscriptionPlan | null> {
    try {
      return this.db.subscriptionPlans.findOne({ name });
    } catch (error) {
      logger.error('Failed to get plan by name', error as Error);
      return null;
    }
  }

  async createSubscriptionPlan(planData: any): Promise<SubscriptionPlan> {
    try {
      const plan: SubscriptionPlan = {
        id: BillingService.generateId(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...planData,
        tier: planData.tier as PlanTier, // Convert string to enum
      };

      const createdPlan = await this.db.subscriptionPlans.create(plan);

      logger.info('Subscription plan created', {
        planId: plan.id,
        name: plan.name,
        tier: plan.tier,
      });

      return createdPlan;
    } catch (error) {
      logger.error('Failed to create subscription plan', error as Error);
      throw error;
    }
  }

  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      return this.db.subscriptions.findById(subscriptionId);
    } catch (error) {
      logger.error('Failed to get subscription', error as Error);
      return null;
    }
  }

  async getCurrentUsageForSubscription(subscriptionId: string): Promise<any> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) return null;

      return await this.getCurrentUsageAnalytics(subscription.projectId);
    } catch (error) {
      logger.error('Failed to get current usage for subscription', error as Error);
      return null;
    }
  }

  static async logSubscriptionEvent(
    subscriptionId: string,
    event: string,
    metadata?: any
  ): Promise<void> {
    try {
      logger.info('Subscription event logged', {
        subscriptionId,
        event,
        metadata,
        timestamp: new Date(),
      });

      // In production, this would log to audit system
    } catch (error) {
      logger.error('Failed to log subscription event', error as Error);
    }
  }

  async listSubscriptions(filters: {
    billingAccountId?: string;
    projectId?: string;
    status?: SubscriptionStatus;
    limit: number;
    offset: number;
  }): Promise<Subscription[]> {
    try {
      const queryFilters: Record<string, any> = {};

      if (filters.billingAccountId) {
        queryFilters.billingAccountId = filters.billingAccountId;
      }

      if (filters.projectId) {
        queryFilters.projectId = filters.projectId;
      }

      if (filters.status) {
        queryFilters.status = filters.status;
      }

      return this.db.subscriptions.findMany({
        where: queryFilters,
        limit: filters.limit,
        offset: filters.offset,
        orderBy: 'createdAt DESC',
      });
    } catch (error) {
      logger.error('Failed to list subscriptions', error as Error);
      return [];
    }
  }

  async countSubscriptions(filters: {
    billingAccountId?: string;
    projectId?: string;
    status?: SubscriptionStatus;
  }): Promise<number> {
    try {
      const queryFilters: Record<string, any> = {};

      if (filters.billingAccountId) {
        queryFilters.billingAccountId = filters.billingAccountId;
      }

      if (filters.projectId) {
        queryFilters.projectId = filters.projectId;
      }

      if (filters.status) {
        queryFilters.status = filters.status;
      }

      return this.db.subscriptions.count({ where: queryFilters });
    } catch (error) {
      logger.error('Failed to count subscriptions', error as Error);
      return 0;
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAt?: Date): Promise<Subscription> {
    try {
      const subscription = await this.getSubscription(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const cancelDate = cancelAt || new Date();
      const updatedSubscription = {
        ...subscription,
        status: SubscriptionStatus.CANCELED,
        canceledAt: cancelDate,
        updatedAt: new Date(),
      };

      const result = await this.db.subscriptions.update(subscriptionId, updatedSubscription);

      logger.info('Subscription canceled', {
        subscriptionId,
        canceledAt: cancelDate,
      });

      return result;
    } catch (error) {
      logger.error('Failed to cancel subscription', error as Error);
      throw error;
    }
  }

  async getCurrentUsageAnalytics(projectId?: string, organizationId?: string): Promise<any> {
    try {
      const filters: Record<string, any> = {};

      if (projectId) {
        filters.projectId = projectId;
      }

      if (organizationId) {
        filters.organizationId = organizationId;
      }

      // Get usage records for the current period
      const usageRecords = await this.db.usageRecords.findMany({
        where: filters,
        orderBy: 'createdAt DESC',
        limit: 1000, // Reasonable limit for analytics
      });

      // Calculate analytics from usage records
      const totalExecutions = usageRecords.length;
      const successfulExecutions = usageRecords.filter(
        (record: any) => record.status === 'succeeded'
      ).length;
      const totalCost = usageRecords.reduce(
        (sum: number, record: any) => sum + (record.cost || 0),
        0
      );

      return {
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date(),
          granularity: 'day',
        },
        metrics: {
          totalExecutions,
          successfulExecutions,
          failedExecutions: totalExecutions - successfulExecutions,
          averageCost: totalExecutions > 0 ? totalCost / totalExecutions : 0,
          totalCost,
          resourceUtilization: {} as any,
          topWorkflows: [],
          costByCategory: [],
        },
        trends: {
          executionTrend: [] as any,
          costTrend: [] as any,
          successRateTrend: [] as any,
        },
        breakdown: {
          byProject: [],
          byWorkflow: [],
          byUser: [],
        },
      };
    } catch (error) {
      logger.error('Failed to get current usage analytics', error as Error);
      // Return default analytics on error
      return {
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date(),
        },
        metrics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          averageCost: 0,
          totalCost: 0,
        },
        trends: {
          executionTrend: 0,
          costTrend: 0,
          successRateTrend: 0,
        },
        breakdown: {
          byProject: [],
          byWorkflow: [],
          byUser: [],
        },
      };
    }
  }

  async getUsageReport(request: UsageReportRequest): Promise<UsageReportResponse> {
    try {
      const filters: Record<string, any> = {
        createdAt: {
          gte: request.startDate,
          lte: request.endDate,
        },
      };

      if (request.projectId) {
        filters.projectId = request.projectId;
      }

      // Get usage records for the period
      const usageRecords = await this.db.usageRecords.findMany({
        where: filters,
        orderBy: 'createdAt ASC',
      });

      // Calculate analytics
      const analytics = await this.getCurrentUsageAnalytics(request.projectId);

      // Calculate cost breakdown
      const totalCost = usageRecords.reduce(
        (sum: number, record: any) => sum + (record.cost || 0),
        0
      );

      return {
        period: {
          start: request.startDate,
          end: request.endDate,
          granularity: request.granularity || 'day',
        },
        analytics: {
          ...analytics,
          trends: {
            executionTrend: 0, // Calculate based on comparison period
            costTrend: 0,
            successRateTrend: 0,
          },
        },
        cost: {
          total: totalCost,
          breakdown: [],
          currency: 'USD',
        },
        usage: usageRecords,
      };
    } catch (error) {
      logger.error('Failed to get usage report', error as Error);
      throw error;
    }
  }

  async getCostBreakdown(
    projectId?: string,
    organizationId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    try {
      const filters: Record<string, any> = {};

      if (projectId) {
        filters.projectId = projectId;
      }

      if (organizationId) {
        filters.organizationId = organizationId;
      }

      if (startDate && endDate) {
        filters.createdAt = {
          gte: startDate,
          lte: endDate,
        };
      }

      const usageRecords = await this.db.usageRecords.findMany({
        where: filters,
      });

      // Group by metric type and calculate costs
      const breakdown = usageRecords.reduce((acc: any, record: any) => {
        const metric = record.metric || 'executions';
        if (!acc[metric]) {
          acc[metric] = {
            metric,
            totalCost: 0,
            totalUsage: 0,
            count: 0,
          };
        }
        acc[metric].totalCost += record.cost || 0;
        acc[metric].totalUsage += record.quantity || 0;
        acc[metric].count += 1;
        return acc;
      }, {});

      return Object.values(breakdown);
    } catch (error) {
      logger.error('Failed to get cost breakdown', error as Error);
      return [];
    }
  }

  async getUsageByGroup(
    groupBy: string,
    projectId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    try {
      const filters: Record<string, any> = {};

      if (projectId) {
        filters.projectId = projectId;
      }

      if (startDate && endDate) {
        filters.createdAt = {
          gte: startDate,
          lte: endDate,
        };
      }

      const usageRecords = await this.db.usageRecords.findMany({
        where: filters,
      });

      // Group by the specified field
      const grouped = usageRecords.reduce((acc: any, record: any) => {
        const key = record[groupBy] || 'unknown';
        if (!acc[key]) {
          acc[key] = {
            [groupBy]: key,
            totalCost: 0,
            totalExecutions: 0,
            records: [],
          };
        }
        acc[key].totalCost += record.cost || 0;
        acc[key].totalExecutions += 1;
        acc[key].records.push(record);
        return acc;
      }, {});

      return Object.values(grouped);
    } catch (error) {
      logger.error('Failed to get usage by group', error as Error);
      return [];
    }
  }

  static async generateUsageForecasts(
    projectId?: string,
    organizationId?: string,
    forecastDate?: Date
  ): Promise<any[]> {
    try {
      // Simple forecast implementation
      return [];
    } catch (error) {
      logger.error('Failed to generate usage forecasts', error as Error);
      return [];
    }
  }

  private async getUsageForBillingPeriod(
    projectId: string,
    filters: { startDate: Date; endDate: Date }
  ): Promise<UsageRecord[]> {
    return this.db.usageRecords.findByProject(projectId, filters);
  }

  private static calculateUsageCharges(usageRecords: UsageRecord[], plan: SubscriptionPlan) {
    // Implement usage charge calculation
    return [];
  }
}
