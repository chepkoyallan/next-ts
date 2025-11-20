// Comprehensive billing system types for orchestrator platform
// import { Identifier } from '../../gen/orchestrator/admin/common';
import { Identifier } from 'src/gen/index.orchestrator.core';

// ============================================================================
// CORE BILLING TYPES
// ============================================================================

export interface BillingAccount {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  billingAddress: BillingAddress;
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId?: string;
  taxId?: string;
  currency: string;
  status: BillingAccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'wire_transfer';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  status: 'active' | 'expired' | 'failed';
}

export enum BillingAccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELINQUENT = 'delinquent',
  CLOSED = 'closed',
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

export interface Subscription {
  id: string;
  billingAccountId: string;
  projectId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialStart?: Date;
  trialEnd?: Date;
  cancelAt?: Date;
  canceledAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  tier: PlanTier;
  pricing: PlanPricing;
  features: PlanFeatures;
  limits: ResourceLimits;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum PlanTier {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export interface PlanPricing {
  basePrice: number; // Monthly base price
  currency: string;
  billingInterval: 'monthly' | 'yearly';
  usagePricing: UsagePricing[];
  discounts?: PlanDiscount[];
}

export interface UsagePricing {
  metric: UsageMetric;
  price: number; // Price per unit
  includedUnits: number; // Free tier included
  overage: number; // Price per unit over included
}

export enum UsageMetric {
  EXECUTIONS = 'executions',
  CPU_HOURS = 'cpu_hours',
  MEMORY_GB_HOURS = 'memory_gb_hours',
  STORAGE_GB = 'storage_gb',
  NETWORK_GB = 'network_gb',
  USERS = 'users',
  PROJECTS = 'projects',
}

export interface PlanDiscount {
  type: 'percentage' | 'fixed';
  value: number;
  duration?: number; // months
  code?: string;
}

export interface PlanFeatures {
  maxExecutions: number | 'unlimited';
  maxConcurrency: number;
  maxDuration: string; // e.g., '24h'
  features: string[];
  support: 'community' | 'email' | 'priority' | 'dedicated';
  sla?: ServiceLevelAgreement;
}

export interface ServiceLevelAgreement {
  uptime: string; // e.g., '99.9%'
  responseTime: string; // e.g., '< 1h'
  resolution: string; // e.g., '< 24h'
}

export interface ResourceLimits {
  cpu: number; // vCPUs
  memory: number; // GB
  storage: number; // GB
  bandwidth: number; // GB/month
  users: number;
  projects: number;
  domains: number;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

export interface UsageRecord {
  id: string;
  subscriptionId: string;
  projectId: string;
  executionId?: string;
  metric: UsageMetric;
  quantity: number;
  unit: string;
  timestamp: Date;
  metadata: UsageMetadata;
  cost: number;
  currency: string;
}

export interface UsageMetadata {
  executionId?: string;
  workflowId?: string;
  taskId?: string;
  domain?: string;
  resourceType?: string;
  clusterId?: string;
  region?: string;
  [key: string]: any;
}

export interface ExecutionUsage {
  executionId: string;
  projectId: string;
  domain: string;
  workflowId: Identifier;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  status: ExecutionStatus;
  resourceUsage: ResourceUsage;
  cost: ExecutionCost;
}

export enum ExecutionStatus {
  RUNNING = 'running',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  ABORTED = 'aborted',
  TIMED_OUT = 'timed_out',
}

export interface ResourceUsage {
  cpu: {
    requested: number; // vCPUs
    used: number; // vCPU-hours
    peak: number; // Peak vCPUs
  };
  memory: {
    requested: number; // GB
    used: number; // GB-hours
    peak: number; // Peak GB
  };
  storage: {
    input: number; // GB
    output: number; // GB
    temporary: number; // GB
  };
  network: {
    ingress: number; // GB
    egress: number; // GB
  };
}

export interface ExecutionCost {
  compute: number;
  storage: number;
  network: number;
  total: number;
  currency: string;
  breakdown: CostBreakdown[];
}

export interface CostBreakdown {
  component: string;
  quantity: number;
  unit: string;
  rate: number;
  cost: number;
}

// ============================================================================
// INVOICING
// ============================================================================

export interface Invoice {
  id: string;
  number: string;
  billingAccountId: string;
  subscriptionId?: string;
  status: InvoiceStatus;
  periodStart: Date;
  periodEnd: Date;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  dueDate: Date;
  paidAt?: Date;
  lineItems: InvoiceLineItem[];
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible',
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// ANALYTICS & REPORTING
// ============================================================================

export interface UsageAnalytics {
  period: AnalyticsPeriod;
  projectId?: string;
  organizationId?: string;
  metrics: AnalyticsMetrics;
  trends: AnalyticsTrends;
  forecasts: AnalyticsForecasts;
}

export interface AnalyticsPeriod {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface AnalyticsMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalCost: number;
  averageCost: number;
  resourceUtilization: ResourceUtilization;
  topWorkflows: WorkflowMetrics[];
  costByCategory: CategoryCost[];
}

export interface ResourceUtilization {
  cpu: UtilizationMetric;
  memory: UtilizationMetric;
  storage: UtilizationMetric;
  network: UtilizationMetric;
}

export interface UtilizationMetric {
  average: number;
  peak: number;
  efficiency: number; // percentage
  waste: number; // unused resources
}

export interface WorkflowMetrics {
  workflowId: string;
  name: string;
  executions: number;
  successRate: number;
  averageDuration: number;
  totalCost: number;
}

export interface CategoryCost {
  category: string;
  cost: number;
  percentage: number;
}

export interface AnalyticsTrends {
  executionTrend: TrendData[];
  costTrend: TrendData[];
  utilizationTrend: TrendData[];
}

export interface TrendData {
  timestamp: Date;
  value: number;
  change: number; // percentage change from previous period
}

export interface AnalyticsForecasts {
  nextMonthCost: ForecastData;
  nextMonthExecutions: ForecastData;
  resourceNeeds: ResourceForecast;
}

export interface ForecastData {
  predicted: number;
  confidence: number; // percentage
  range: {
    min: number;
    max: number;
  };
}

export interface ResourceForecast {
  cpu: ForecastData;
  memory: ForecastData;
  storage: ForecastData;
}

// ============================================================================
// MARKETPLACE
// ============================================================================

export interface MarketplaceWorkflow {
  id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  authorId: string;
  authorName: string;
  version: string;
  pricing: WorkflowPricing;
  ratings: WorkflowRatings;
  downloads: number;
  revenue: number;
  status: MarketplaceStatus;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export enum WorkflowCategory {
  DATA_PROCESSING = 'data_processing',
  ML_TRAINING = 'ml_training',
  ETL = 'etl',
  MONITORING = 'monitoring',
  AUTOMATION = 'automation',
  ANALYTICS = 'analytics',
}

export interface WorkflowPricing {
  model: 'free' | 'one_time' | 'subscription' | 'usage_based';
  price: number;
  currency: string;
  trialPeriod?: number; // days
}

export interface WorkflowRatings {
  average: number;
  count: number;
  distribution: {
    [rating: number]: number;
  };
}

export enum MarketplaceStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

export interface WorkflowPurchase {
  id: string;
  workflowId: string;
  buyerId: string;
  sellerId: string;
  price: number;
  currency: string;
  revenueShare: number; // Platform fee percentage
  platformFee: number;
  sellerRevenue: number;
  status: PurchaseStatus;
  licenseType: LicenseType;
  purchasedAt: Date;
}

export enum PurchaseStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
  DISPUTED = 'disputed',
}

export enum LicenseType {
  SINGLE_USE = 'single_use',
  UNLIMITED = 'unlimited',
  TEAM = 'team',
  ENTERPRISE = 'enterprise',
}

// ============================================================================
// FEATURE GATING
// ============================================================================

export interface FeatureGate {
  feature: string;
  requiredPlans: PlanTier[];
  requiredPermissions?: string[];
  usageLimit?: number;
  description: string;
  isActive: boolean;
}

export interface FeatureUsage {
  userId: string;
  projectId: string;
  feature: string;
  usageCount: number;
  lastUsed: Date;
  resetPeriod: 'daily' | 'weekly' | 'monthly';
}

// ============================================================================
// COMPLIANCE & GOVERNANCE
// ============================================================================

export interface ComplianceFeatures {
  auditLogging: boolean;
  dataLineage: boolean;
  accessLogs: boolean;
  piiDetection: boolean;
  dataClassification: boolean;
  retentionPolicies: boolean;
  encryptionAtRest: boolean;
  networkIsolation: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  projectId: string;
  action: string;
  resource: string;
  resourceId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, any>;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateSubscriptionRequest {
  billingAccountId: string;
  projectId: string;
  planId: string;
  trialDays?: number;
  metadata?: Record<string, any>;
}

export interface UpdateSubscriptionRequest {
  planId?: string;
  cancelAt?: Date;
  metadata?: Record<string, any>;
}

export interface UsageReportRequest {
  projectId?: string;
  startDate: Date;
  endDate: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
  metrics?: UsageMetric[];
}

export interface UsageReportResponse {
  period: AnalyticsPeriod;
  usage: UsageRecord[];
  analytics: UsageAnalytics;
  cost: {
    total: number;
    breakdown: CostBreakdown[];
    currency: string;
  };
}

export interface BillingDashboardData {
  currentUsage: UsageAnalytics;
  upcomingInvoice: Invoice;
  paymentHistory: Invoice[];
  subscription: Subscription;
  plan: SubscriptionPlan;
  alerts: BillingAlert[];
}

export interface BillingAlert {
  id: string;
  type: 'usage_limit' | 'cost_threshold' | 'payment_failed' | 'trial_ending';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  threshold?: number;
  current?: number;
  createdAt: Date;
}
