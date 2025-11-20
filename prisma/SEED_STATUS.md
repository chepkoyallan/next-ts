# Seed Data Status

## Summary

Enhanced Prisma seed data has been created with comprehensive test users for all RBAC roles and subscription tiers.

## What Was Added

### 1. **Users with Different Roles** (Already existed, but now documented)

- **super-admin@acme-corp.com** - Enterprise tier
- **system-admin@acme-corp.com** - Professional tier
- **project-admin@acme-corp.com** - Professional tier
- **operator@acme-corp.com** - Starter tier
- **developer@acme-corp.com** - Starter tier
- **viewer@acme-corp.com** - Free tier

### 2. **New Subscriptions Created** (Lines 1012-1092)

Added individual subscriptions for each user tier:

- Enterprise subscription for super-admin (1-year billing)
- Professional subscription for system-admin
- Professional subscription for project-admin (existing)
- Starter subscription for operator
- Starter subscription for developer
- Free subscription for viewer

### 3. **Additional Projects** (Lines 459-491)

- **project-production** - Production workflows domain
- **project-testing** - Testing/QA staging domain
- Original **project-sample** - Development domain

### 4. **Enhanced Execution Usage Data** (Lines 1187-1275)

Added execution records for different user tiers:

- **exec-enterprise-1** - Super-admin with high resource usage (8.5 CPU hours, $12.45)
- **exec-operator-1** - Operator with monitoring workflow (RUNNING status)
- **exec-viewer-1** - Viewer with minimal free-tier usage ($0.02)
- Existing records for project-admin and developer

## How to Run the Seed

### ⚠️ Important: Node Version Issue

The current Node version (v12.22.4) is **too old** to run the TypeScript seed script. You need Node v14+ or preferably v16+.

### Option 1: Upgrade Node (Recommended)

```bash
# Using nvm (recommended)
nvm install 16
nvm use 16

# Then run the seed
yarn db:reset
```

### Option 2: Manual Database Setup

If you cannot upgrade Node, you can:

1. **Compile the TypeScript seed file** first:

   ```bash
   npx tsc prisma/seed.ts --outDir prisma/dist --module commonjs --target es2017
   node prisma/dist/seed.js
   ```

2. **Or use the existing seed.js** (if it exists):

   ```bash
   node prisma/seed.js
   ```

3. **Or run migrations only** and manually insert data via Prisma Studio:
   ```bash
   npx prisma migrate deploy
   npx prisma studio
   ```

## Testing the RBAC Integration

Once seeded, you can test the RBAC integration with these user credentials:

| User                        | Password        | Can Test                                                |
| --------------------------- | --------------- | ------------------------------------------------------- |
| viewer@acme-corp.com        | `viewer123`     | Read-only access, should fail on create/update/delete   |
| developer@acme-corp.com     | `dev123`        | Can create workflows/tasks, cannot terminate executions |
| operator@acme-corp.com      | `operator123`   | Can terminate executions, manage operations             |
| project-admin@acme-corp.com | `projadmin123`  | Full project management                                 |
| system-admin@acme-corp.com  | `sysadmin123`   | User/role management, billing                           |
| super-admin@acme-corp.com   | `superadmin123` | Unlimited access                                        |

## Test Scenarios

### 1. Free Tier Limits (viewer@acme-corp.com)

- Try to create 6th workflow (limit is 5) → Should get 402 Payment Required
- Try to execute 101st execution → Should get limit error

### 2. RBAC Permissions (developer@acme-corp.com)

- Create workflow → Should succeed (200 OK)
- Delete user → Should fail (403 Forbidden - needs system-admin)
- Terminate execution → Should fail (403 Forbidden - needs operator)

### 3. Subscription Features (operator@acme-corp.com)

- Access advanced analytics → Should fail (needs Professional tier)
- Terminate execution → Should succeed

### 4. Usage Tracking

- Any create operation should create a usage record in the database
- Check `ExecutionUsage` table for tracked operations

### 5. Audit Logging

- All create/delete operations should create audit logs
- Check for audit records when super-admin performs operations

## Files Modified

1. **prisma/seed.ts** - Enhanced with:

   - 6 subscriptions (one for each tier/user)
   - 3 projects (development, production, staging)
   - 5 execution usage records (covering all user types)

2. **prisma/SEED_DATA_GUIDE.md** - Comprehensive documentation of:

   - All test users and credentials
   - Permission matrix
   - Subscription tier details
   - Testing scenarios
   - API endpoint examples

3. **prisma/SEED_STATUS.md** (this file) - Current status and next steps

## Next Steps

1. **Upgrade Node.js** to v16+ (required)
2. **Run the seed script**: `yarn db:reset`
3. **Start the application**: `yarn dev`
4. **Test authentication**: Use `/api/v1/auth/login` with test credentials
5. **Test RBAC endpoints**: Try accessing `/api/v1/engine/*` routes with different user tokens
6. **Check usage tracking**: Query the database for `ExecutionUsage` records
7. **Verify audit logs**: Check for operation logs in audit tables

## Database Schema Notes

The seed data assumes your Prisma schema has these models:

- `User` - with email, passwordHash, roles
- `Role` - with name, hierarchy, isSystemRole
- `UserRole` - junction table
- `Organization`, `OrganizationMember`
- `Project`
- `SubscriptionPlan`, `Subscription`
- `BillingAccount`, `PaymentHistory`
- `ExecutionUsage`, `UsageRecord`
- `FeatureGate`, `FeatureUsage`
- `MarketplaceWorkflow`, `WorkflowSpecification`
- `BillingAlert`

## Troubleshooting

### If seed fails with "Unexpected token '?'":

- This is due to old Node.js version
- Upgrade to Node v16+ or v18+

### If seed fails with unique constraint violations:

- Run: `npx prisma migrate reset --force`
- This will drop and recreate all tables

### If TypeScript compilation fails:

- Run: `npx prisma generate`
- Ensure @prisma/client is installed

### If bcrypt fails:

- Run: `npm rebuild bcryptjs`
- Or use: `npm install bcrypt@latest`

## Success Indicators

When the seed completes successfully, you should see:

```
🌱 Starting database seeding...
🔐 Creating permissions and roles...
✅ Created 70 permissions and 6 system roles
🏢 Creating sample organization and users...
✅ Created organization, 6 users (all role types), and 3 projects
📋 Creating subscription plans...
✅ Created 4 subscription plans
✅ Created 6 subscriptions across all tiers (Free, Starter, Professional, Enterprise)
💳 Creating sample billing data...
✅ Created billing account and sample usage data for all user tiers
💳 Creating sample payment data...
🚨 Creating billing alerts...
📊 Creating usage records...
✅ Created comprehensive test data covering all API endpoints
🎉 Database seeding completed successfully!
```

## Current Status

✅ Seed file enhanced with multi-tier subscription data
✅ Documentation created (SEED_DATA_GUIDE.md)
✅ Additional projects added for multi-project testing
✅ Execution usage data added for all user types
⚠️ **Blocked by Node.js version** - Need v16+ to run
⏳ **Pending**: Actual database seeding (requires Node upgrade)

## Contact

For issues with seeding, check:

1. Node version: `node --version` (should be v16+)
2. Database connection in `.env`
3. Prisma schema is up to date: `npx prisma generate`
4. Database migrations are applied: `npx prisma migrate deploy`
