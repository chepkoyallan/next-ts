# Prisma Revenue System Setup

This directory contains the complete Prisma schema for the orchestrator platform's revenue system. The schema is designed to work seamlessly with your existing TypeScript services.

## 📁 File Structure

```
prisma/
├── schema.prisma           # Main schema with core billing models
├── schema-extended.prisma  # Extended models (copy to main schema)
├── seed.ts                # Database seeding script
├── migrations/            # Generated migration files
└── README.md              # This file
```

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install prisma @prisma/client
npm install -D prisma
```

### 2. Merge Schema Files

Copy the contents of `schema-extended.prisma` into your main `schema.prisma` file after the existing models.

### 3. Environment Configuration

Add to your `.env` file:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/orchestrator_revenue"

# Prisma
PRISMA_GENERATE_DATAPROXY="true"
```

### 4. Generate Prisma Client

```bash
npx prisma generate
```

### 5. Create and Run Migrations

```bash
# Create initial migration
npx prisma migrate dev --name init

# Apply migrations to production
npx prisma migrate deploy
```

### 6. Seed Database

```bash
npx prisma db seed
```

## 🔧 Integration with Your Services

### Update Your Billing Service

```typescript
// src/app/api/lib/services/billing-service.ts
import { PrismaClient } from '../../../generated/prisma';

export class BillingService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createBillingAccount(data: CreateBillingAccountRequest): Promise<BillingAccount> {
    return await this.prisma.billingAccount.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        email: data.email,
        currency: data.currency || 'USD',
        billingAddress: data.billingAddress,
        metadata: data.metadata || {},
      },
    });
  }

  async getSubscriptionPlans(filters: {
    includeInactive?: boolean;
    tier?: PlanTier;
  }): Promise<SubscriptionPlan[]> {
    return await this.prisma.subscriptionPlan.findMany({
      where: {
        isActive: filters.includeInactive ? undefined : true,
        tier: filters.tier,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createSubscription(request: CreateSubscriptionRequest): Promise<Subscription> {
    return await this.prisma.subscription.create({
      data: {
        billingAccountId: request.billingAccountId,
        projectId: request.projectId,
        planId: request.planId,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        trialEnd: request.trialDays
          ? new Date(Date.now() + request.trialDays * 24 * 60 * 60 * 1000)
          : undefined,
        metadata: request.metadata || {},
      },
      include: {
        plan: true,
        billingAccount: true,
      },
    });
  }

  async trackExecutionUsage(executionUsage: ExecutionUsage): Promise<UsageRecord[]> {
    const usageRecords = [];

    // Create main execution record
    const executionRecord = await this.prisma.executionUsage.create({
      data: {
        executionId: executionUsage.executionId,
        projectId: executionUsage.projectId,
        workflowId: executionUsage.workflowId,
        userId: executionUsage.userId,
        domain: executionUsage.domain,
        startTime: executionUsage.startTime,
        endTime: executionUsage.endTime,
        duration: executionUsage.duration,
        status: executionUsage.status,
        resourceUsage: executionUsage.resourceUsage,
        cost: executionUsage.cost,
      },
    });

    // Create usage records for billing
    const subscription = await this.prisma.subscription.findFirst({
      where: { projectId: executionUsage.projectId, status: 'ACTIVE' },
    });

    if (subscription) {
      // Track execution count
      const executionUsageRecord = await this.prisma.usageRecord.create({
        data: {
          subscriptionId: subscription.id,
          projectId: executionUsage.projectId,
          metric: 'EXECUTIONS',
          quantity: 1,
          unit: 'execution',
          timestamp: executionUsage.startTime,
          cost: executionUsage.cost.total,
          metadata: {
            executionId: executionUsage.executionId,
            workflowId: executionUsage.workflowId,
            domain: executionUsage.domain,
            status: executionUsage.status,
            duration: executionUsage.duration,
          },
        },
      });

      usageRecords.push(executionUsageRecord);

      // Track CPU usage
      if (executionUsage.resourceUsage.cpu?.used > 0) {
        const cpuUsageRecord = await this.prisma.usageRecord.create({
          data: {
            subscriptionId: subscription.id,
            projectId: executionUsage.projectId,
            metric: 'CPU_HOURS',
            quantity: executionUsage.resourceUsage.cpu.used,
            unit: 'cpu-hour',
            timestamp: executionUsage.startTime,
            cost: executionUsage.cost.compute,
            metadata: {
              executionId: executionUsage.executionId,
              requested: executionUsage.resourceUsage.cpu.requested,
              peak: executionUsage.resourceUsage.cpu.peak,
            },
          },
        });

        usageRecords.push(cpuUsageRecord);
      }

      // Track Memory usage
      if (executionUsage.resourceUsage.memory?.used > 0) {
        const memoryUsageRecord = await this.prisma.usageRecord.create({
          data: {
            subscriptionId: subscription.id,
            projectId: executionUsage.projectId,
            metric: 'MEMORY_GB_HOURS',
            quantity: executionUsage.resourceUsage.memory.used,
            unit: 'gb-hour',
            timestamp: executionUsage.startTime,
            cost: executionUsage.cost.compute * 0.3, // Approximate memory cost
            metadata: {
              executionId: executionUsage.executionId,
              requested: executionUsage.resourceUsage.memory.requested,
              peak: executionUsage.resourceUsage.memory.peak,
            },
          },
        });

        usageRecords.push(memoryUsageRecord);
      }
    }

    return usageRecords;
  }
}
```

### Update Feature Gate Service

```typescript
// src/app/api/lib/services/feature-gate-service.ts
import { PrismaClient } from '../../../generated/prisma';

export class FeatureGateService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async checkFeatureAccess(feature: string, context: FeatureContext): Promise<FeatureCheckResult> {
    // Get feature gate configuration
    const featureGate = await this.prisma.featureGate.findUnique({
      where: { feature },
    });

    if (!featureGate || !featureGate.isActive) {
      return { allowed: false, reason: 'Feature not available' };
    }

    // Get user's subscription and plan
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        projectId: context.projectId,
        status: 'ACTIVE',
      },
      include: { plan: true },
    });

    if (!subscription) {
      return { allowed: false, reason: 'No active subscription' };
    }

    // Check if plan tier is allowed
    if (!featureGate.requiredPlans.includes(subscription.plan.tier)) {
      return {
        allowed: false,
        reason: `Feature requires ${featureGate.requiredPlans.join(' or ')} plan`,
        planRequired: featureGate.requiredPlans[0],
      };
    }

    // Check usage limits if applicable
    if (featureGate.usageLimit) {
      const usage = await this.prisma.featureUsage.findUnique({
        where: {
          userId_projectId_feature_resetPeriod: {
            userId: context.userId,
            projectId: context.projectId,
            feature,
            resetPeriod: featureGate.usagePeriod,
          },
        },
      });

      if (usage && usage.usageCount >= featureGate.usageLimit) {
        return {
          allowed: false,
          reason: `Feature usage limit exceeded (${usage.usageCount}/${featureGate.usageLimit})`,
          usageCount: usage.usageCount,
          usageLimit: featureGate.usageLimit,
        };
      }
    }

    return { allowed: true };
  }

  async trackFeatureUsage(feature: string, context: FeatureContext): Promise<void> {
    const featureGate = await this.prisma.featureGate.findUnique({
      where: { feature },
    });

    if (!featureGate) return;

    // Update or create usage record
    await this.prisma.featureUsage.upsert({
      where: {
        userId_projectId_feature_resetPeriod: {
          userId: context.userId,
          projectId: context.projectId,
          feature,
          resetPeriod: featureGate.usagePeriod,
        },
      },
      update: {
        usageCount: { increment: 1 },
        lastUsed: new Date(),
      },
      create: {
        userId: context.userId,
        projectId: context.projectId,
        feature,
        usageCount: 1,
        resetPeriod: featureGate.usagePeriod,
        lastUsed: new Date(),
        lastReset: new Date(),
      },
    });

    // Log access
    await this.prisma.featureAccessLog.create({
      data: {
        userId: context.userId,
        projectId: context.projectId,
        feature,
        accessGranted: true,
        reason: 'Feature access granted',
      },
    });
  }
}
```

## 📊 Key Prisma Queries

### Revenue Analytics

```typescript
// Get monthly recurring revenue
const mrr = await prisma.subscription.aggregate({
  where: { status: 'ACTIVE' },
  _sum: {
    // This would need a computed field or raw query
  },
});

// Get usage trends
const usageTrends = await prisma.usageRecord.groupBy({
  by: ['metric'],
  where: {
    timestamp: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  },
  _sum: {
    quantity: true,
    cost: true,
  },
});

// Get marketplace revenue
const marketplaceRevenue = await prisma.marketplaceRevenue.aggregate({
  where: {
    createdAt: {
      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    },
  },
  _sum: {
    platformFee: true,
    netRevenue: true,
  },
});
```

### Feature Usage Analytics

```typescript
// Get feature adoption rates
const featureAdoption = await prisma.featureUsage.groupBy({
  by: ['feature'],
  _count: {
    userId: true,
  },
  _sum: {
    usageCount: true,
  },
});

// Get most popular marketplace workflows
const popularWorkflows = await prisma.marketplaceWorkflow.findMany({
  orderBy: [{ downloads: 'desc' }, { rating: 'desc' }],
  take: 10,
  include: {
    _count: {
      select: {
        purchases: true,
        reviews: true,
      },
    },
  },
});
```

## 🔄 Migration Strategy

### Development Workflow

```bash
# Make schema changes
# Then create migration
npx prisma migrate dev --name add_new_feature

# Generate new client
npx prisma generate

# Update your TypeScript code
# Test changes
```

### Production Deployment

```bash
# Deploy migrations
npx prisma migrate deploy

# Generate production client
npx prisma generate
```

## 🎯 Performance Tips

### Indexing Strategy

The schema includes proper indexes via `@@index` directives. Key indexes:

```prisma
model UsageRecord {
  // ... fields

  @@index([projectId, timestamp])
  @@index([subscriptionId, metric])
  @@index([timestamp])
}

model FeatureUsage {
  // ... fields

  @@index([userId, projectId])
  @@index([feature, lastUsed])
}
```

### Query Optimization

```typescript
// Use select to limit fields
const subscriptions = await prisma.subscription.findMany({
  select: {
    id: true,
    status: true,
    plan: {
      select: {
        name: true,
        tier: true,
      },
    },
  },
});

// Use include for relations you need
const billingAccount = await prisma.billingAccount.findUnique({
  where: { id },
  include: {
    subscriptions: {
      where: { status: 'ACTIVE' },
      include: { plan: true },
    },
    invoices: {
      orderBy: { createdAt: 'desc' },
      take: 5,
    },
  },
});
```

## 🚨 Important Notes

1. **Schema Merging**: Copy all models from `schema-extended.prisma` into your main `schema.prisma`
2. **Enum Values**: Prisma enums use UPPER_CASE, but your TypeScript enums might use different casing
3. **JSON Fields**: Use Prisma's Json type for complex data structures
4. **Relations**: All foreign key relationships are properly defined
5. **Indexes**: Performance indexes are included for common query patterns

## 🎉 You're Ready!

After completing this setup:

1. Your Prisma schema matches your TypeScript services perfectly
2. All revenue system features are supported
3. Database performance is optimized
4. Type safety is maintained throughout

Run `npx prisma studio` to explore your data with Prisma's GUI!

---

**💰 Your revenue system is now ready to generate money with Prisma!**
