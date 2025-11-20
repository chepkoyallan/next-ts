# Migration Checklist

## Phase 1: Setup ✅

- [x] Create workspace structure
- [x] Setup Turborepo
- [x] Create pnpm-workspace.yaml
- [x] Initialize core packages

## Phase 2: Move Types

- [ ] Copy src/config/types.ts → packages/core/types/src/
- [ ] Update imports in all files
- [ ] Test type checking

## Phase 3: Move Config

- [ ] Copy src/config/\* → packages/core/config/src/
- [ ] Copy src/plugins/\* → packages/core/config/src/plugins/
- [ ] Update imports

## Phase 4: Move Components

- [ ] Copy src/components/\* → packages/core/components/src/
- [ ] Update imports
- [ ] Test rendering

## Phase 5: Extract Features

- [ ] Auth: src/sections/auth → packages/features/auth
- [ ] Dashboard: src/sections/dashboard → packages/features/dashboard
- [ ] User: src/sections/user → packages/features/user
- [ ] Product: src/sections/product → packages/features/product
- [ ] (Continue for all features...)

## Phase 6: Update Routes

- [ ] Move src/app/(dashboard) routes to feature packages
- [ ] Update route imports
- [ ] Test routing

## Phase 7: Plugin Registration

- [ ] Create plugin.ts for each feature
- [ ] Register with plugin manager
- [ ] Test auto-discovery

## Phase 8: Testing

- [ ] Test all features work
- [ ] Test builds
- [ ] Test development mode
- [ ] Update CI/CD

## Phase 9: Documentation

- [ ] Update README
- [ ] Document package structure
- [ ] Create contribution guide

## Phase 10: Cleanup

- [ ] Remove old src/sections
- [ ] Remove old src/app routes
- [ ] Clean up unused files
