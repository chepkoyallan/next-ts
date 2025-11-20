# Database Seeding Guide

This guide explains how to seed your database with comprehensive test data for the orchestrator platform.

## Quick Start

```bash
# Complete database setup (recommended for first time)
make db-setup

# Or just seed data into existing database
make db-seed
```

## Available Seeding Commands

### 🌱 **Full Seeding**

```bash
make db-seed
```

Creates comprehensive test data including:

- **3 Test Users**: system-admin, admin, developer with full profiles
- **RBAC System**: Complete roles, permissions, and assignments
- **Subscription Plans**: Free, Starter, Professional, Enterprise
- **Billing Data**: Active subscriptions, payment history, usage tracking
- **Marketplace**: Sample workflows, purchases, reviews, revenue
- **Feature Gates**: Usage tracking and limits
- **Alerts**: Billing alerts and cost optimization data

### 👥 **Minimal User Seeding**

```bash
make db-seed-users
```

Creates only basic user accounts for quick testing.

### 💳 **Billing Data Only**

```bash
make db-seed-billing
```

Seeds subscription plans, billing accounts, and payment data.

### 🔄 **Quick Reseed**

```bash
make db-reseed
```

Clears existing data and reseeds (faster than full reset).

### ✅ **Verify Seed Data**

```bash
make db-verify-seed
```

Checks if seed data is complete and shows counts.

## Test Credentials

After seeding, you can use these test accounts:

| Role             | Email                        | Description                       |
| ---------------- | ---------------------------- | --------------------------------- |
| **System Admin** | `system-admin@acme-corp.com` | Full platform access, 2FA enabled |
| **Org Admin**    | `admin@acme-corp.com`        | Organization administration       |
| **Developer**    | `developer@acme-corp.com`    | Standard developer access         |

> **Note**: Use your authentication system's default password or configure as needed.

## What Gets Created

### 🔐 **RBAC System**

- **5 System Roles**: system-admin, admin, manager, developer, viewer
- **20+ Permissions**: Covering users, organizations, projects, workflows, billing
- **Role Assignments**: Proper hierarchical role assignments

### 💰 **Revenue System**

- **4 Subscription Plans**: Complete pricing tiers with features and limits
- **Active Subscriptions**: Professional plan for admin, Starter for developer
- **Payment History**: Successful and failed payment examples
- **Usage Tracking**: 7 days of execution and CPU usage data
- **Billing Alerts**: Usage warnings and cost threshold notifications

### 🛒 **Marketplace**

- **3 Sample Workflows**: Data processing, ML training, monitoring
- **Workflow Purchases**: Different license types (unlimited, single-use)
- **Reviews & Ratings**: 4-5 star verified purchase reviews
- **Revenue Tracking**: Platform fee calculations (30% platform, 70% author)

### 📊 **Analytics Data**

- **Feature Usage**: Advanced analytics and API access tracking
- **Execution Data**: Sample workflow executions with costs
- **Usage Records**: Daily metrics for billing calculations

## Database Management

### 🔄 **Reset vs Reseed**

```bash
# Full reset (drops schema, recreates, seeds)
make db-reset

# Quick reseed (keeps schema, clears data, reseeds)
make db-reseed
```

### 🔍 **Verification**

```bash
# Check seed data completeness
make db-verify-seed

# Open database browser
make db-studio
```

### 🚨 **Emergency Recovery**

```bash
# Emergency reset (use with caution)
make db-emergency-reset
```

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: The seed file may show TypeScript warnings but will run correctly
2. **Missing Tables**: Run `make db-migrate` first if tables don't exist
3. **Connection Issues**: Check your `DATABASE_URL` environment variable
4. **Prisma Client**: Run `make db-generate` if you get client errors

### Verification Steps

1. **Check Database Connection**:

   ```bash
   make db-status
   ```

2. **Verify Tables Exist**:

   ```bash
   make db-studio
   ```

3. **Check Seed Completeness**:
   ```bash
   make db-verify-seed
   ```

## Development Workflow

### Typical Development Flow

```bash
# 1. Setup database (first time)
make db-setup

# 2. Make schema changes
# Edit prisma/schema.prisma

# 3. Apply changes
make db-migrate name=your_change

# 4. Reseed with new data
make db-reseed

# 5. Verify everything works
make db-verify-seed
```

### Testing Different Scenarios

```bash
# Test with minimal data
make db-seed-users

# Test billing features
make db-seed-billing

# Test complete platform
make db-seed
```

## Production Notes

- **Never run seeding commands in production**
- Use `make prod-setup` for production deployment
- Seed data is for development and testing only
- All test data uses mock payment IDs and credentials

## API Testing

The seed data provides comprehensive test scenarios for all API endpoints:

- **Authentication**: Test with different user roles
- **Billing**: Active subscriptions, payment history, usage tracking
- **Marketplace**: Workflow purchases, reviews, revenue calculations
- **Admin**: System administration with proper role-based access
- **Feature Gates**: Usage limits and feature access testing

Use `make db-studio` to explore the seeded data and understand the relationships between different entities.
