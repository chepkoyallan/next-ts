# Modular Prisma Schema Architecture

This directory contains the modular Prisma schema files organized by domain. The schema is automatically built from these files before running Prisma commands.

## Structure

```
prisma/
├── schema/                    # Modular schema source files
│   ├── _base.prisma          # Generator and datasource config
│   ├── _shared.prisma        # Shared enums and types
│   ├── auth.prisma           # Authentication, users, roles
│   ├── organizations.prisma  # Multi-tenancy
│   ├── projects.prisma       # Project management
│   ├── workflows.prisma      # Workflow orchestration
│   ├── billing.prisma        # Billing and subscriptions
│   ├── marketplace.prisma    # Workflow marketplace
│   ├── features.prisma       # Feature gates and flags
│   ├── audit.prisma          # Audit logs and compliance
│   ├── monitoring.prisma     # Metrics and alerts
│   ├── forms.prisma          # Dynamic forms
│   ├── connectors.prisma     # External integrations
│   ├── tasks.prisma          # Task definitions
│   ├── config.prisma         # Configuration
│   └── bmaas.prisma          # Bare Metal as a Service
├── schema.prisma             # Auto-generated combined schema (DO NOT EDIT)
└── schema.prisma.backup      # Backup of original monolithic schema
```

## How It Works

### Automatic Schema Building

All Prisma commands automatically build the combined schema from modular files:

```bash
pnpm db:generate     # Builds schema → Generates Prisma Client
pnpm db:migrate      # Builds schema → Creates migration
pnpm db:validate     # Builds schema → Validates schema
pnpm db:push         # Builds schema → Pushes to database
```

### Manual Schema Building

To manually build the schema without running Prisma:

```bash
pnpm schema:build    # Combines modular files into schema.prisma
```

### Splitting a Monolithic Schema

If you need to split a monolithic schema into domains:

```bash
pnpm schema:split    # Splits schema.prisma.backup into domain files
```

## Adding New Models

### 1. Choose the Right Domain File

Add your model to the appropriate domain file based on its business logic:

- **auth.prisma** - User authentication, roles, permissions
- **organizations.prisma** - Tenancy, members, invitations
- **billing.prisma** - Subscriptions, invoices, payments
- **workflows.prisma** - Workflow definitions, executions, tasks
- **marketplace.prisma** - Workflow listings, purchases, reviews
- **features.prisma** - Feature flags, gates, usage tracking
- etc.

### 2. Add Your Model

Edit the domain file directly:

```prisma
// prisma/schema/billing.prisma

model MyNewBillingModel {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Your fields here

  @@map("my_new_billing_model")
}
```

### 3. Add Enums (if needed)

Enums can be added to their respective domain files or to `_shared.prisma` if used across domains.

### 4. Update Dependencies

If your model references models from other domains, ensure the domain files are in the correct order in `scripts/prisma/build-schema.js`:

```javascript
const FILE_ORDER = [
  '_shared.prisma',      // Enums first
  'auth.prisma',         // User model (foundation)
  'organizations.prisma', // Organization model
  // ... your dependencies must come before dependent models
];
```

### 5. Generate and Migrate

```bash
pnpm db:generate     # Generate Prisma Client
pnpm db:migrate      # Create migration
```

## Domain Dependencies

Models are organized in dependency order:

1. **_shared.prisma** - Enums (no dependencies)
2. **auth.prisma** - User model (foundation)
3. **organizations.prisma** - Depends on User
4. **projects.prisma** - Depends on User, Organization
5. **workflows.prisma** - Depends on User, Organization, Project
6. **billing.prisma** - Depends on User, Organization
7. **marketplace.prisma** - Depends on User, Workflow
8. **features.prisma** - Depends on User, Organization
9. **audit.prisma** - Depends on User
10. **monitoring.prisma** - Depends on Organization
11. **forms.prisma** - Depends on Organization
12. **connectors.prisma** - Depends on Organization
13. **tasks.prisma** - Depends on Organization
14. **config.prisma** - Depends on User, Organization
15. **bmaas.prisma** - Depends on Organization, Billing

## Benefits

### ✅ Maintainability
- Smaller, focused files (50-250 lines each)
- Clear domain boundaries
- Easy to locate specific models

### ✅ Extensibility
- Add new domains by creating new files
- Easy to add models to existing domains
- No need to edit massive single file

### ✅ Team Collaboration
- Different developers can work on different domains
- Reduced merge conflicts
- Clear ownership boundaries

### ✅ Organization
- Models grouped by business logic
- Related enums near their models
- Clear dependencies

## Scripts

### build-schema.js
Located at `scripts/prisma/build-schema.js`

- Reads `_base.prisma` for configuration
- Merges domain files in dependency order
- Outputs combined `schema.prisma`
- Run automatically before Prisma commands

### split-schema.js
Located at `scripts/prisma/split-schema.js`

- Parses monolithic schema.prisma.backup
- Extracts models and enums
- Distributes to domain files based on DOMAIN_MAP
- Used for initial setup only

## Important Notes

⚠️ **DO NOT** edit `prisma/schema.prisma` directly - it's auto-generated!

✅ **DO** edit files in `prisma/schema/` directory

✅ **DO** run `pnpm schema:build` after changes to see combined output

✅ **DO** commit modular files in `prisma/schema/` to version control

## Troubleshooting

### Schema validation fails
```bash
pnpm db:validate
```
This will show which domain file has the error.

### Models not found
Check the FILE_ORDER in `scripts/prisma/build-schema.js` to ensure dependencies come before dependent models.

### Circular dependencies
Prisma requires unidirectional relationships. Check your relation fields and ensure proper dependency order.

### Migration fails
```bash
pnpm schema:build    # Verify combined schema
pnpm db:validate     # Check for errors
pnpm db:migrate      # Create migration
```

## Migration from Monolithic Schema

The original monolithic schema is backed up at:
- `prisma/schema.prisma.backup` (2,533 lines)

To revert to monolithic schema (not recommended):
```bash
cp prisma/schema.prisma.backup prisma/schema.prisma
```

## Statistics

- **Original schema**: 2,533 lines (1 file)
- **Modular schema**: ~2,570 lines (15 files)
- **Average file size**: ~170 lines per domain
- **Models**: 65 total
- **Enums**: 35 total
- **Domains**: 14 domains
