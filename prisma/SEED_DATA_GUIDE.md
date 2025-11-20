# Prisma Seed Data Guide

This guide documents all the test users, roles, and subscription data created by the seed script for testing the RBAC integration.

## Test Users & Credentials

All passwords follow the format: `{role}123`

| Email                         | Password        | Role          | Hierarchy | Subscription Tier | Description                |
| ----------------------------- | --------------- | ------------- | --------- | ----------------- | -------------------------- |
| `super-admin@acme-corp.com`   | `superadmin123` | super-admin   | Level 6   | Enterprise        | Ultimate system access     |
| `system-admin@acme-corp.com`  | `sysadmin123`   | system-admin  | Level 5   | Professional      | Full system administration |
| `project-admin@acme-corp.com` | `projadmin123`  | project-admin | Level 4   | Professional      | Project management         |
| `operator@acme-corp.com`      | `operator123`   | operator      | Level 3   | Starter           | Operations & monitoring    |
| `developer@acme-corp.com`     | `dev123`        | developer     | Level 2   | Starter           | Development access         |
| `viewer@acme-corp.com`        | `viewer123`     | viewer        | Level 1   | Free              | Read-only access           |

## Organizations & Projects

### Acme Corporation (acme-corp)

- **Organization ID**: `acme-corp`
- **Members**: All 6 test users

#### Projects:

1. **Sample Project** (`project-sample`)

   - Domain: `development`
   - Public workflows: Enabled
   - Max workflows: 100

2. **Production Workflows** (`project-production`)

   - Domain: `production`
   - Public workflows: Disabled
   - Max workflows: 1000
   - Owner: super-admin

3. **Testing & QA** (`project-testing`)
   - Domain: `staging`
   - Public workflows: Enabled
   - Max workflows: 50

## Subscription Plans

### Free Plan

- **Tier**: FREE
- **Price**: $0/month
- **Limits**:
  - Executions: 100/month
  - CPU Hours: 10
  - Storage: 1 GB
  - Users: 1
  - Projects: 1
- **Assigned to**: viewer@acme-corp.com

### Starter Plan

- **Tier**: STARTER
- **Price**: $49/month
- **Limits**:
  - Executions: 1,000/month
  - CPU Hours: 100
  - Storage: 10 GB
  - Users: 5
  - Projects: 3
- **Assigned to**: developer@acme-corp.com, operator@acme-corp.com

### Professional Plan

- **Tier**: PROFESSIONAL
- **Price**: $199/month
- **Limits**:
  - Executions: 10,000/month
  - CPU Hours: 1,000
  - Storage: 100 GB
  - Users: 25
  - Projects: 10
- **Features**: Advanced analytics, API access, webhooks, marketplace publishing
- **Assigned to**: project-admin@acme-corp.com, system-admin@acme-corp.com

### Enterprise Plan

- **Tier**: ENTERPRISE
- **Price**: $999/month
- **Limits**: Unlimited (-1)
- **Features**: All features including SSO, audit logging, compliance, multi-cloud orchestration
- **Assigned to**: super-admin@acme-corp.com

## Permission Matrix

### Resource Permissions by Role

| Resource          | viewer | developer          | operator              | project-admin        | system-admin              | super-admin |
| ----------------- | ------ | ------------------ | --------------------- | -------------------- | ------------------------- | ----------- |
| **Projects**      | read   | read               | read                  | create/update/delete | full                      | full        |
| **Workflows**     | read   | create/read/update | create/read/update    | full                 | full                      | full        |
| **Executions**    | read   | create/read        | create/read/terminate | full                 | full                      | full        |
| **Tasks**         | read   | create/read/update | create/read/update    | full                 | full                      | full        |
| **Launch Plans**  | read   | create/read        | create/read           | full                 | full                      | full        |
| **Signals**       | -      | -                  | read/update           | read/update          | full                      | full        |
| **Users**         | -      | -                  | -                     | read/update          | create/read/update/delete | full        |
| **Organizations** | -      | -                  | -                     | read/update          | read/update               | full        |
| **Billing**       | -      | -                  | -                     | read                 | manage                    | full        |
| **System**        | -      | -                  | -                     | -                    | admin                     | full        |

## Sample Execution Data

### Execution Records Created:

1. **exec-sample-1** - Project Admin (Professional)

   - Workflow: Data Processing Pipeline
   - Status: SUCCEEDED
   - Duration: 30 minutes
   - Cost: $0.15

2. **exec-sample-2** - Developer (Starter)

   - Workflow: ML Model Training
   - Status: SUCCEEDED
   - Duration: 30 minutes
   - Cost: $0.08

3. **exec-enterprise-1** - Super Admin (Enterprise)

   - Workflow: ML Model Training
   - Status: SUCCEEDED
   - Duration: 2 hours
   - Cost: $12.45
   - Resources: High usage (8.5 CPU hours, 24 GB memory)

4. **exec-operator-1** - Operator (Starter)

   - Workflow: System Monitoring & Alerting
   - Status: RUNNING
   - Cost: $0.05

5. **exec-viewer-1** - Viewer (Free)
   - Workflow: Data Processing Pipeline
   - Status: SUCCEEDED
   - Duration: 30 minutes
   - Cost: $0.02 (minimal resources)

## Marketplace Workflows

Three sample workflows available:

1. **Data Processing Pipeline** (`workflow-data-pipeline`)

   - Category: DATA_PROCESSING
   - Pricing: $9.99 - $299.99
   - Featured: Yes

2. **ML Model Training Pipeline** (`workflow-ml-training`)

   - Category: ML_TRAINING
   - Pricing: $19.99 - $499.99
   - Featured: Yes

3. **System Monitoring & Alerting** (`workflow-monitoring-alerts`)
   - Category: MONITORING
   - Pricing: $14.99 - $399.99
   - Featured: No

## Feature Gates

Key features with tier requirements:

- **basic_workflows**: FREE+
- **advanced_workflows**: STARTER+
- **enterprise_workflows**: PROFESSIONAL+
- **custom_workflows**: ENTERPRISE only
- **real_time_monitoring**: PROFESSIONAL+
- **advanced_analytics**: PROFESSIONAL+
- **predictive_analytics**: ENTERPRISE only
- **marketplace_publishing**: PROFESSIONAL+ (10/month limit)
- **api_access**: PROFESSIONAL+ (1000/day limit)
- **multi_cloud_orchestration**: ENTERPRISE only
- **sso_integration**: ENTERPRISE only

## Testing Scenarios

### 1. Test RBAC Access Control

```bash
# Test viewer (read-only)
curl -H "Authorization: Bearer {viewer_token}" \
  http://localhost:3000/api/v1/engine/workflows

# Should succeed: 200 OK

curl -X POST -H "Authorization: Bearer {viewer_token}" \
  http://localhost:3000/api/v1/engine/workflows \
  -d '{...}'

# Should fail: 403 Forbidden - Insufficient permissions
```

### 2. Test Subscription Tier Limits

```bash
# Test free tier user trying to create 6th workflow (limit is 5)
curl -X POST -H "Authorization: Bearer {viewer_token}" \
  http://localhost:3000/api/v1/engine/workflows \
  -d '{...}'

# Should fail: 402 Payment Required - Subscription upgrade needed
```

### 3. Test Hierarchical Permissions

```bash
# Developer creating a workflow
curl -X POST -H "Authorization: Bearer {dev_token}" \
  http://localhost:3000/api/v1/engine/workflows \
  -d '{...}'

# Should succeed: 200 OK

# Developer trying to delete a user
curl -X DELETE -H "Authorization: Bearer {dev_token}" \
  http://localhost:3000/api/v1/users/{userId}

# Should fail: 403 Forbidden - Requires system-admin (level 5)
```

### 4. Test Usage Tracking

```bash
# Project admin creates a workflow (tracked for billing)
curl -X POST -H "Authorization: Bearer {projectadmin_token}" \
  http://localhost:3000/api/v1/engine/workflows \
  -d '{...}'

# Check usage record was created
curl -H "Authorization: Bearer {projectadmin_token}" \
  http://localhost:3000/api/v1/billing/usage
```

### 5. Test Audit Logging

```bash
# System admin creates a project (audited)
curl -X POST -H "Authorization: Bearer {sysadmin_token}" \
  http://localhost:3000/api/v1/engine/projects \
  -d '{...}'

# Check audit log was created
curl -H "Authorization: Bearer {superadmin_token}" \
  http://localhost:3000/api/v1/admin/audit-logs
```

## Running the Seed Script

```bash
# Reset and seed the database
npx prisma migrate reset --force

# Or just run the seed script
npx prisma db seed
```

## Billing & Payment Data

### Billing Account

- **ID**: `billing-acme-corp`
- **Organization**: Acme Corporation
- **Email**: billing@acme-corp.com
- **Status**: ACTIVE
- **Payment Method**: pm_stripe_example_123

### Payment History

1. **Professional Plan Payment** - $199.00 (SUCCEEDED)
2. **Starter Plan Payment** - $49.00 (SUCCEEDED)
3. **Enterprise Upgrade Attempt** - $999.00 (FAILED - insufficient_funds)

### Billing Alerts

1. **Usage Warning** - 80% of monthly execution limit reached
2. **Cost Threshold** - Approaching $150 spending threshold

## Usage Records

7 days of historical usage data created for:

- Execution counts (20-70 per day)
- CPU hours (2-7 per day)
- Associated costs ($1-15 per day)

## Feature Usage Tracking

Sample feature usage:

- **advanced_analytics** by project-admin: 45 uses this month
- **api_access** by developer: 150 uses today (of 1000 daily limit)

## Notes

- All subscriptions have a 30-day billing period (except Enterprise: 365 days)
- Stripe test IDs are used (pm*stripe*_, sub*stripe*_, cus*stripe*\*)
- All users are members of the same organization for simplicity
- Email verification is enabled for all users
- Super-admin is the organization owner

## Support & Troubleshooting

If seeding fails:

1. Check database connection
2. Ensure Prisma schema is up to date: `npx prisma generate`
3. Reset database: `npx prisma migrate reset --force`
4. Check for unique constraint violations
