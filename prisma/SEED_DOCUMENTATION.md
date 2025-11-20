# Production Seed Data Documentation

## Overview

This production-ready seed file creates comprehensive test data covering all edge cases for the iCodeAI platform. The data is designed to support thorough testing of billing, RBAC, multi-tenancy, workflow orchestration, marketplace, and compliance features.

## Files

- **`seed.production.ts`** - Main seed file (Organizations, Users, Subscriptions, Projects, RBAC)
- **`seed.production.extended.ts`** - Extended seed file (Workflows, Executions, Marketplace, Payments, Compliance)
- **`seed.backup.ts`** - Backup of original seed file

## Running the Seed

### Full Production Seed

```bash
# Option 1: Run both files sequentially
yarn db:generate
npx tsx prisma/seed.production.ts
npx tsx prisma/seed.production.extended.ts

# Option 2: Update package.json to use production seed
# Edit package.json:
# "prisma": {
#   "seed": "tsx prisma/seed.production.ts && tsx prisma/seed.production.extended.ts"
# }
yarn db:seed
```

### Reset and Reseed

```bash
# Complete reset (drops all data)
make db-reset

# Then run production seed
npx tsx prisma/seed.production.ts
npx tsx prisma/seed.production.extended.ts
```

## Data Structure

### Organizations (3 Total)

| Organization         | Slug            | Status    | Industry   | Size       | Description                                 |
| -------------------- | --------------- | --------- | ---------- | ---------- | ------------------------------------------- |
| **Acme Corporation** | `acme-corp`     | ACTIVE    | Technology | ENTERPRISE | Full-featured enterprise with 10 users      |
| **TechStart Inc**    | `techstart-inc` | ACTIVE    | Software   | SMALL      | Startup testing growth limits (6 users)     |
| **InactiveCorp**     | `inactive-corp` | SUSPENDED | Other      | MEDIUM     | Testing suspended/inactive states (2 users) |

### Users (18 Total)

#### Acme Corporation (10 users)

| Email                         | Name                | Role          | Plan         | 2FA | Status                     | Purpose                  |
| ----------------------------- | ------------------- | ------------- | ------------ | --- | -------------------------- | ------------------------ |
| `super-admin@acme-corp.com`   | Alice Super Admin   | Super Admin   | Enterprise   | ✅  | Active                     | Ultimate system access   |
| `sys-admin@acme-corp.com`     | Bob System Admin    | System Admin  | Professional | ❌  | Active                     | System management        |
| `project-admin@acme-corp.com` | Carol Project Admin | Project Admin | Professional | ❌  | Active                     | Project management       |
| `dev1@acme-corp.com`          | David Developer     | Developer     | Starter      | ❌  | Active                     | Active development       |
| `dev2@acme-corp.com`          | Eve Developer       | Developer     | Starter      | ❌  | Active                     | Near usage limits        |
| `operator1@acme-corp.com`     | Frank Operator      | Operator      | Starter      | ❌  | Active                     | Execution management     |
| `operator2@acme-corp.com`     | Grace Operator      | Operator      | Starter      | ❌  | Active                     | Monitoring specialist    |
| `viewer@acme-corp.com`        | Henry Viewer        | Viewer        | Free         | ❌  | Active                     | Read-only access         |
| `trial@acme-corp.com`         | Iris Trial User     | Developer     | Professional | ❌  | Trial (expiring in 3 days) | Testing trial expiration |
| `suspended@acme-corp.com`     | Jack Suspended      | Viewer        | N/A          | ❌  | Suspended                  | Testing auth failures    |

**Default Password:** Check role name (e.g., `superadmin123`, `dev123`)

#### TechStart Inc (6 users)

| Email                  | Name               | Role          | Plan         | Status              | Purpose              |
| ---------------------- | ------------------ | ------------- | ------------ | ------------------- | -------------------- |
| `owner@techstart.io`   | Karen Owner        | Project Admin | Professional | Active              | Startup founder      |
| `dev@techstart.io`     | Leo Developer      | Developer     | Starter      | Active, near limits | Testing usage limits |
| `ops@techstart.io`     | Maria Operator     | Operator      | Free         | Active, at limits   | Free tier limits     |
| `viewer@techstart.io`  | Nathan Viewer      | Viewer        | Free         | Active              | Contractor access    |
| `invited@techstart.io` | Olivia Invited     | Member        | N/A          | Pending invitation  | Testing invitations  |
| `expired@techstart.io` | Paul Expired Trial | Viewer        | Starter      | Past due            | Expired trial        |

#### InactiveCorp (2 users)

| Email                       | Name                  | Role         | Plan | Status       | Purpose               |
| --------------------------- | --------------------- | ------------ | ---- | ------------ | --------------------- |
| `admin@inactive-corp.com`   | Quinn Suspended Admin | System Admin | N/A  | Suspended    | Suspended org testing |
| `deleted@inactive-corp.com` | Rachel Deleted        | Viewer       | N/A  | Soft-deleted | GDPR testing          |

### Subscription Plans

| Plan             | Tier         | Price   | Executions | Users     | Projects  | Features                                                      |
| ---------------- | ------------ | ------- | ---------- | --------- | --------- | ------------------------------------------------------------- |
| **Free**         | FREE         | $0/mo   | 100        | 1         | 1         | Basic workflows, community support                            |
| **Starter**      | STARTER      | $49/mo  | 1,000      | 5         | 3         | Advanced workflows, email support, team collaboration         |
| **Professional** | PROFESSIONAL | $199/mo | 10,000     | 25        | 10        | Enterprise workflows, priority support, analytics, API access |
| **Enterprise**   | ENTERPRISE   | $999/mo | Unlimited  | Unlimited | Unlimited | All features, dedicated support, SSO, compliance              |

### Subscriptions (11 Total)

| ID                        | Organization | Project       | Plan         | Status       | Period Ends | Special Notes               |
| ------------------------- | ------------ | ------------- | ------------ | ------------ | ----------- | --------------------------- |
| `sub-acme-enterprise-001` | Acme         | Production    | Enterprise   | ACTIVE       | +15 days    | High usage, annual contract |
| `sub-acme-pro-001`        | Acme         | Dev Lab       | Professional | ACTIVE       | +20 days    | Normal usage                |
| `sub-acme-starter-001`    | Acme         | ML Pipelines  | Starter      | ACTIVE       | +25 days    | Active development          |
| `sub-acme-starter-002`    | Acme         | ETL Pipelines | Starter      | ACTIVE       | +10 days    | 95% usage (near limit)      |
| `sub-acme-free-001`       | Acme         | Dev Lab       | Free         | ACTIVE       | +2 days     | Testing free tier           |
| `sub-acme-trial-001`      | Acme         | Dev Lab       | Professional | TRIALING     | +19 days    | **Trial ends in 3 days**    |
| `sub-tech-pro-001`        | TechStart    | Main App      | Professional | ACTIVE       | +23 days    | Normal usage                |
| `sub-tech-starter-001`    | TechStart    | Testing       | Starter      | ACTIVE       | +5 days     | 88% usage                   |
| `sub-tech-free-001`       | TechStart    | Testing       | Free         | ACTIVE       | +2 days     | **100% usage (at limit)**   |
| `sub-tech-pastdue-001`    | TechStart    | Main App      | Starter      | **PAST_DUE** | -5 days     | Payment failed (3 attempts) |
| `sub-tech-canceled-001`   | TechStart    | Testing       | Free         | ACTIVE       | +10 days    | Scheduled cancellation      |

### Projects (7 Total)

| ID                  | Organization | Name                  | Domain      | Status       | Workflows | Purpose                |
| ------------------- | ------------ | --------------------- | ----------- | ------------ | --------- | ---------------------- |
| `acme-prod-001`     | Acme         | Production Workflows  | production  | Active       | 1000      | Production workloads   |
| `acme-dev-001`      | Acme         | Development Lab       | development | Active       | 100       | Testing & development  |
| `acme-ml-001`       | Acme         | ML Training Pipelines | production  | Active       | 500       | Machine learning       |
| `acme-etl-001`      | Acme         | Data ETL Pipelines    | production  | Active       | 200       | ETL workflows          |
| `acme-archived-001` | Acme         | Archived Project      | development | **Archived** | 50        | Testing archived state |
| `tech-main-001`     | TechStart    | Main Application      | development | Active       | 50        | Primary app workflows  |
| `tech-test-001`     | TechStart    | Testing Sandbox       | development | Active       | 20        | Experimentation        |

### Workflows (6 Total)

| ID                     | Project   | Name                     | Version | Status       | Domain      | Creator       |
| ---------------------- | --------- | ------------------------ | ------- | ------------ | ----------- | ------------- |
| `wf-data-pipeline-001` | acme-prod | data_processing_pipeline | v1.0.0  | ACTIVE       | production  | Super Admin   |
| `wf-ml-training-001`   | acme-ml   | ml_training_workflow     | v2.0.0  | ACTIVE       | production  | Developer 1   |
| `wf-monitoring-001`    | acme-prod | monitoring_alerts        | v1.2.0  | ACTIVE       | production  | Operator 1    |
| `wf-dev-test-001`      | acme-dev  | test_workflow            | v0.1.0  | ACTIVE       | development | Developer 2   |
| `wf-archived-001`      | acme-dev  | old_workflow             | v1.0.0  | **ARCHIVED** | development | Developer 1   |
| `wf-tech-main-001`     | tech-main | api_workflow             | v1.0.0  | ACTIVE       | development | TechStart Dev |

### Workflow Executions (8 Total)

| ID              | Workflow      | Phase         | Duration | Started | Cost   | Purpose               |
| --------------- | ------------- | ------------- | -------- | ------- | ------ | --------------------- |
| `exec-001`      | data_pipeline | SUCCEEDED     | 30 min   | 2h ago  | $0.52  | Recent successful run |
| `exec-002`      | ml_training   | **RUNNING**   | -        | 1h ago  | -      | Currently executing   |
| `exec-003`      | data_pipeline | **FAILED**    | 10 min   | 4h ago  | $0.18  | Validation error      |
| `exec-004`      | ml_training   | SUCCEEDED     | 4 hours  | 6h ago  | $24.80 | Long-running success  |
| `exec-005`      | test_workflow | **ABORTED**   | 5 min    | 8h ago  | -      | User canceled         |
| `exec-006`      | monitoring    | **TIMED_OUT** | 1 hour   | 10h ago | -      | Exceeded timeout      |
| `exec-007`      | data_pipeline | **QUEUED**    | -        | -       | -      | Waiting to start      |
| `exec-tech-001` | api_workflow  | SUCCEEDED     | 2 min    | 3h ago  | $0.05  | TechStart execution   |

### Marketplace Workflows (4 Total)

| ID                     | Name                     | Category        | Price          | Status         | Downloads | Rating | Reviews |
| ---------------------- | ------------------------ | --------------- | -------------- | -------------- | --------- | ------ | ------- |
| `mkt-wf-data-pipeline` | Advanced Data Processing | DATA_PROCESSING | $19.99-$499.99 | APPROVED ⭐    | 342       | 4.7/5  | 28      |
| `mkt-wf-ml-training`   | ML Model Training        | ML_TRAINING     | $29.99-$799.99 | APPROVED ⭐    | 589       | 4.9/5  | 67      |
| `mkt-wf-monitoring`    | System Monitoring        | MONITORING      | $14.99-$399.99 | APPROVED       | 156       | 4.3/5  | 19      |
| `mkt-wf-pending`       | Experimental Analytics   | ANALYTICS       | $9.99-$249.99  | PENDING_REVIEW | 0         | -      | 0       |

⭐ = Featured workflow

### Purchases (3 Total)

| ID             | Workflow      | Buyer           | License    | Price   | Status    | Date        |
| -------------- | ------------- | --------------- | ---------- | ------- | --------- | ----------- |
| `purchase-001` | Data Pipeline | Alice (Acme)    | UNLIMITED  | $99.99  | COMPLETED | 30 days ago |
| `purchase-002` | ML Training   | David (Acme)    | TEAM       | $299.99 | COMPLETED | 15 days ago |
| `purchase-003` | Monitoring    | Leo (TechStart) | SINGLE_USE | $14.99  | COMPLETED | 7 days ago  |

### Payment History (5 Records)

| ID                    | Account   | Amount  | Status       | Method | Date        | Notes                          |
| --------------------- | --------- | ------- | ------------ | ------ | ----------- | ------------------------------ |
| `pay-acme-001`        | Acme      | $999.00 | SUCCEEDED    | Card   | 15 days ago | Enterprise plan                |
| `pay-acme-002`        | Acme      | $199.00 | SUCCEEDED    | Card   | 10 days ago | Professional plan              |
| `pay-tech-001`        | TechStart | $199.00 | SUCCEEDED    | Card   | 7 days ago  | Professional plan              |
| `pay-tech-failed-001` | TechStart | $49.00  | **FAILED**   | Card   | 2 days ago  | Insufficient funds (attempt 3) |
| `pay-tech-refund-001` | TechStart | -$49.00 | **REFUNDED** | Card   | 5 days ago  | Customer request               |

### Billing Alerts (4 Active)

| ID                         | Account   | Type           | Severity    | Message                         | Status |
| -------------------------- | --------- | -------------- | ----------- | ------------------------------- | ------ |
| `alert-usage-warning-001`  | Acme      | USAGE_LIMIT    | ⚠️ WARNING  | 95% of monthly executions used  | Active |
| `alert-usage-critical-001` | TechStart | USAGE_LIMIT    | 🔴 CRITICAL | Free tier limit exceeded        | Active |
| `alert-payment-failed-001` | TechStart | PAYMENT_FAILED | 🔴 CRITICAL | Payment failed after 3 attempts | Active |
| `alert-trial-ending-001`   | Acme      | TRIAL_ENDING   | ⚠️ WARNING  | Trial ending in 3 days          | Active |

### Feature Gates (14 Total)

| Feature                  | Name                   | Required Plans  | Usage Limit | Period  |
| ------------------------ | ---------------------- | --------------- | ----------- | ------- |
| `basic_workflows`        | Basic Workflows        | All tiers       | None        | -       |
| `advanced_workflows`     | Advanced Workflows     | Starter+        | None        | -       |
| `enterprise_workflows`   | Enterprise Workflows   | Professional+   | None        | -       |
| `custom_workflows`       | Custom Workflows       | Enterprise only | None        | -       |
| `real_time_monitoring`   | Real-time Monitoring   | Professional+   | None        | -       |
| `advanced_analytics`     | Advanced Analytics     | Professional+   | None        | -       |
| `predictive_analytics`   | Predictive Analytics   | Enterprise only | None        | -       |
| `marketplace_publishing` | Marketplace Publishing | Professional+   | 10          | monthly |
| `api_access`             | API Access             | Professional+   | 1,000       | daily   |
| `webhook_support`        | Webhook Support        | Professional+   | 100         | daily   |
| `sso_integration`        | SSO Integration        | Enterprise only | None        | -       |
| `audit_logging`          | Audit Logging          | Professional+   | None        | -       |
| `compliance_reporting`   | Compliance Reporting   | Enterprise only | None        | -       |
| `team_collaboration`     | Team Collaboration     | Starter+        | None        | -       |

### Feature Usage (4 Records with Edge Cases)

| User            | Project      | Feature            | Usage | Limit | Status          | Reset Period |
| --------------- | ------------ | ------------------ | ----- | ----- | --------------- | ------------ |
| Alice (Acme)    | Production   | advanced_analytics | 245   | None  | ✅ Normal       | monthly      |
| David (Acme)    | ML Pipelines | api_access         | 892   | 1000  | ✅ Normal       | daily        |
| Eve (Acme)      | Dev Lab      | api_access         | 950   | 1000  | ⚠️ **95% used** | daily        |
| Leo (TechStart) | Main App     | api_access         | 1000  | 1000  | 🔴 **At limit** | daily        |

### Audit Logs (5 Sample Records)

| User  | Action   | Resource             | Timestamp   | IP Address    | Details                                 |
| ----- | -------- | -------------------- | ----------- | ------------- | --------------------------------------- |
| Alice | CREATE   | workflow             | 30 days ago | 192.168.1.100 | Created data_processing_pipeline v1.0.0 |
| David | EXECUTE  | workflow             | 6 hours ago | 192.168.1.101 | Executed ML training (14400s duration)  |
| Bob   | UPDATE   | subscription         | 15 days ago | 192.168.1.102 | Upgraded professional → enterprise      |
| Eve   | DELETE   | workflow             | 5 days ago  | 192.168.1.103 | Archived old_workflow                   |
| Leo   | PURCHASE | marketplace_workflow | 7 days ago  | 10.0.0.50     | Purchased monitoring workflow ($14.99)  |

### GDPR Requests (2 Records)

| User             | Type    | Status      | Due Date    | Completed   | Details                            |
| ---------------- | ------- | ----------- | ----------- | ----------- | ---------------------------------- |
| Rachel (deleted) | ERASURE | COMPLETED   | 25 days ago | 28 days ago | Deleted 150 records, anonymized 45 |
| Iris (trial)     | ACCESS  | IN_PROGRESS | +5 days     | -           | Data access request (JSON format)  |

### Usage Records (90+ Records)

- 30 days of daily metrics for Acme Corp (Enterprise plan)

  - Executions: 100-300 per day
  - CPU Hours: 20-70 per day
  - Cost: $25-75 per day

- 15 days of metrics for TechStart (Starter plan)
  - Executions: 30-80 per day
  - Cost: $2-7 per day

## Edge Cases Covered

### Authentication & Authorization

- ✅ 2FA enabled user (Alice)
- ✅ Email unverified user (Jack, Olivia)
- ✅ Suspended user (Jack)
- ✅ Soft-deleted user (Rachel)
- ✅ Users with multiple organization memberships
- ✅ Inactive organization member (Olivia)

### Subscription States

- ✅ Active subscriptions (multiple tiers)
- ✅ Trialing subscription expiring soon (3 days)
- ✅ Past due subscription (payment failed)
- ✅ Canceled subscription (scheduled)
- ✅ Subscription at usage limits (100%)
- ✅ Subscription near limits (95%, 88%)

### Billing & Payments

- ✅ Successful payments
- ✅ Failed payments (insufficient funds)
- ✅ Refunded payments
- ✅ Multiple payment methods
- ✅ Billing alerts (usage, payment failure, trial ending)
- ✅ Cost spike detection

### Workflows & Executions

- ✅ All execution phases (QUEUED, RUNNING, SUCCEEDED, FAILED, ABORTED, TIMED_OUT)
- ✅ Long-running executions (4+ hours)
- ✅ Failed executions with error details
- ✅ Archived workflows
- ✅ Active workflows across multiple domains

### Marketplace

- ✅ Featured workflows
- ✅ Workflows pending review
- ✅ Completed purchases (multiple license types)
- ✅ Revenue tracking and payouts
- ✅ Workflow ratings and reviews

### Feature Gates

- ✅ Feature at usage limit (100%)
- ✅ Feature near limit (95%)
- ✅ Daily vs monthly reset periods
- ✅ Unlimited features (Enterprise)
- ✅ Plan-based feature access

### Compliance & Governance

- ✅ Audit logs for all critical actions
- ✅ GDPR erasure request (completed)
- ✅ GDPR access request (in progress)
- ✅ Data retention policies
- ✅ Soft delete vs hard delete

### Multi-tenancy

- ✅ 3 organizations with different statuses
- ✅ Organization isolation (separate projects, users)
- ✅ Suspended organization (InactiveCorp)
- ✅ Shared Flyte project strategy (domain isolation)

## Testing Scenarios

### 1. Free Tier Limits

**User:** `ops@techstart.io` / `operator123`

- At 100% of free tier execution limit
- Test overage billing
- Test upgrade prompts

### 2. Trial Expiration

**User:** `trial@acme-corp.com` / `trial123`

- Professional trial expires in 3 days
- Test trial expiration workflow
- Test conversion to paid

### 3. Payment Failure

**User:** `expired@techstart.io` / `trial123`

- Subscription past due
- 3 failed payment attempts
- Test payment recovery flow

### 4. Near Usage Limits

**User:** `dev2@acme-corp.com` / `dev123`

- At 95% of Starter plan limits
- Test usage warnings
- Test overage charges

### 5. Feature Access Control

**User:** `viewer@acme-corp.com` / `viewer123`

- Free tier with minimal permissions
- Test feature gate denials
- Test upgrade prompts

### 6. Suspended Account

**User:** `suspended@acme-corp.com` / `suspended123`

- Account suspended
- Test login prevention
- Test reactivation flow

### 7. Enterprise Features

**User:** `super-admin@acme-corp.com` / `superadmin123`

- Enterprise plan with all features
- 2FA enabled
- Test unlimited usage
- Test advanced features (SSO, audit logs, compliance)

### 8. Marketplace Purchases

**User:** `dev1@acme-corp.com` / `dev123`

- Has purchased ML training workflow
- Test workflow deployment
- Test license management

### 9. GDPR Requests

**User:** `deleted@inactive-corp.com`

- Soft-deleted user
- Test data portability
- Test erasure verification

### 10. Cross-Org Isolation

- Test that TechStart users cannot access Acme data
- Test organization-scoped queries
- Test project isolation

## Login Credentials

### Quick Reference

| Role          | Email Pattern                | Password Pattern |
| ------------- | ---------------------------- | ---------------- |
| Super Admin   | `super-admin@acme-corp.com`  | `superadmin123`  |
| System Admin  | `sys-admin@*`                | `sysadmin123`    |
| Project Admin | `project-admin@*`, `owner@*` | `projadmin123`   |
| Developer     | `dev*@*`                     | `dev123`         |
| Operator      | `operator*@*`, `ops@*`       | `operator123`    |
| Viewer        | `viewer@*`                   | `viewer123`      |
| Trial         | `trial@*`                    | `trial123`       |
| Suspended     | `suspended@*`                | `suspended123`   |

### Recommended Test Users

**For general testing:**

- `dev1@acme-corp.com` / `dev123` (Developer with normal usage)

**For edge case testing:**

- `super-admin@acme-corp.com` / `superadmin123` (Enterprise features, 2FA)
- `dev2@acme-corp.com` / `dev123` (Near limits)
- `ops@techstart.io` / `operator123` (At limits)
- `trial@acme-corp.com` / `trial123` (Trial expiring)
- `expired@techstart.io` / `trial123` (Past due)

## Maintenance

### Updating the Seed

1. Edit `prisma/seed.production.ts` for core data
2. Edit `prisma/seed.production.extended.ts` for extended data
3. Run: `make db-reseed` (faster than full reset)

### Reverting to Original Seed

```bash
cp prisma/seed.backup.ts prisma/seed.ts
yarn db:seed
```

### Generating New Test Data

To add more data to existing seed:

```bash
# Run extended seed multiple times
npx tsx prisma/seed.production.extended.ts
```

## Troubleshooting

### Seed Fails with "Unique Constraint Violation"

**Solution:** Reset the database first

```bash
make db-reset
npx tsx prisma/seed.production.ts
npx tsx prisma/seed.production.extended.ts
```

### "Base seed data not found" Error

**Cause:** Extended seed ran before main seed

**Solution:** Run main seed first

```bash
npx tsx prisma/seed.production.ts
npx tsx prisma/seed.production.extended.ts
```

### Database Connection Issues

```bash
# Check database status
make db-status

# Regenerate Prisma client
yarn db:generate
```

## Performance Notes

- **Main seed:** ~15-30 seconds (core data)
- **Extended seed:** ~10-20 seconds (workflows, executions, metrics)
- **Total records:** ~350+ database records
- **Memory usage:** ~200MB during seeding

## Next Steps

After seeding:

1. **Verify data:** `make db-studio` (opens Prisma Studio)
2. **Test authentication:** Login with test users
3. **Test API endpoints:** Use Postman/Insomnia with seed data
4. **Run E2E tests:** Use seed data for integration tests
5. **Test edge cases:** Follow testing scenarios above

## Support

For issues or questions about the seed data:

1. Check this documentation
2. Review seed file comments
3. Check Prisma Studio for actual data
4. Consult `CLAUDE.md` for project architecture

---

**Last Updated:** 2024
**Version:** 1.0.0
**Maintainer:** iCodeAI Team
