# Converting Sections to Plugins Strategy

**Date**: November 17, 2025
**Purpose**: Analyze `src/sections/` directories and determine plugin conversion strategy

---

## 📊 Current Sections Analysis

| Section           | Files | Plugin Candidate    | Priority | Type               |
| ----------------- | ----- | ------------------- | -------- | ------------------ |
| **\_examples**    | 149   | ❌ Keep as examples | N/A      | Demo/Documentation |
| **about**         | 7     | ✅ Yes              | Low      | Page Content       |
| **account**       | 11    | 🟡 Partial          | Medium   | Core Feature       |
| **address**       | 4     | ✅ Yes              | Medium   | Feature Module     |
| **admin**         | 0     | ⚠️ Empty            | N/A      | -                  |
| **auth-demo**     | 12    | ❌ Keep as demo     | N/A      | Demo/Documentation |
| **blank**         | 1     | ❌ Keep             | N/A      | Template           |
| **checkout**      | 16    | ✅ Yes              | High     | Feature Module     |
| **coming-soon**   | 1     | ❌ Keep             | N/A      | Utility Page       |
| **configuration** | 34    | ❌ Keep             | N/A      | Core System        |
| **contact**       | 5     | ✅ Yes              | Low      | Page Content       |
| **error**         | 4     | ❌ Keep             | N/A      | Core System        |
| **faqs**          | 6     | ✅ Yes              | Low      | Page Content       |
| **file-manager**  | 20    | ✅ Yes              | High     | Feature Module     |
| **home**          | 12    | ❌ Keep             | N/A      | Core Landing       |
| **job**           | 15    | ✅ Yes              | High     | Feature Module     |
| **maintenance**   | 1     | ❌ Keep             | N/A      | Utility Page       |
| **order**         | 10    | ✅ Yes              | High     | Feature Module     |
| **overview**      | 45    | 🟡 Partial          | Low      | Dashboard Core     |
| **payment**       | 8     | ✅ Yes              | High     | Feature Module     |
| **permission**    | 1     | ❌ Keep             | N/A      | Core System        |
| **pricing**       | 2     | ✅ Yes              | Low      | Page Content       |
| **tour**          | 15    | ✅ Yes              | High     | Feature Module     |

**Legend**:

- ✅ **Yes**: Good plugin candidate, self-contained feature
- 🟡 **Partial**: Some parts could be plugins, some should stay
- ❌ **Keep**: Should remain in app core

---

## 🎯 Plugin Conversion Categories

### Category 1: High Priority Feature Modules (Convert to Plugins)

These are self-contained, feature-complete modules that can be enabled/disabled:

#### 1. **checkout** (16 files) → `@app/checkout` plugin

- **Type**: `full` (UI + potential API)
- **Description**: E-commerce checkout flow
- **Routes**: `/product/checkout`
- **Navigation**: Add to e-commerce section
- **Dependencies**: May depend on cart, payment
- **Settings**: Payment methods, shipping options

#### 2. **order** (10 files) → `@app/order` plugin

- **Type**: `full`
- **Description**: Order management and tracking
- **Routes**: `/dashboard/order`, `/dashboard/order/[id]`
- **Navigation**: Add to e-commerce section
- **Dependencies**: None
- **Settings**: Order statuses, notifications

#### 3. **payment** (8 files) → `@app/payment` plugin

- **Type**: `full`
- **Description**: Payment processing and methods
- **Routes**: `/payment`
- **Navigation**: Admin section
- **Dependencies**: None
- **Settings**: Payment gateways, currencies

#### 4. **file-manager** (20 files) → `@app/file-manager` plugin

- **Type**: `ui`
- **Description**: File upload, management, preview
- **Routes**: `/dashboard/file-manager`
- **Navigation**: Tools section
- **Dependencies**: None
- **Settings**: Max file size, allowed types

#### 5. **job** (15 files) → `@app/job` plugin

- **Type**: `full`
- **Description**: Job board and applications
- **Routes**: `/dashboard/job`, `/dashboard/job/[id]`, `/dashboard/job/new`
- **Navigation**: Business section
- **Dependencies**: None
- **Settings**: Job categories, application forms

#### 6. **tour** (15 files) → `@app/tour` plugin

- **Type**: `full`
- **Description**: Tour/trip management
- **Routes**: `/dashboard/tour`, `/dashboard/tour/[id]`, `/dashboard/tour/new`
- **Navigation**: Business section
- **Dependencies**: None
- **Settings**: Tour categories, pricing

#### 7. **address** (4 files) → `@app/address` plugin

- **Type**: `ui`
- **Description**: Address management forms
- **Routes**: Embedded in checkout/account
- **Dependencies**: None
- **Settings**: Address formats, validation

---

### Category 2: Low Priority Content Modules (Optional Plugins)

Simple page content that could be plugins for easy enable/disable:

#### 8. **about** (7 files) → `@app/about` plugin

- **Type**: `ui`
- **Description**: About us page content
- **Routes**: `/about-us`
- **Navigation**: Footer/utility links

#### 9. **contact** (5 files) → `@app/contact` plugin

- **Type**: `ui`
- **Description**: Contact form and info
- **Routes**: `/contact-us`
- **Navigation**: Footer/utility links

#### 10. **faqs** (6 files) → `@app/faqs` plugin

- **Type**: `ui`
- **Description**: FAQ accordion
- **Routes**: `/faqs`
- **Navigation**: Help section

#### 11. **pricing** (2 files) → `@app/pricing` plugin

- **Type**: `ui`
- **Description**: Pricing page
- **Routes**: `/pricing`
- **Navigation**: Marketing section

---

### Category 3: Partial Conversion (Split into Plugin + Core)

Some components should be plugins, others should stay:

#### 12. **account** (11 files) → Partial

- **Keep Core**: Basic account settings, profile
- **Plugin Options**:
  - Advanced settings → `@app/account-advanced` plugin
  - Billing management → `@app/billing` plugin

#### 13. **overview** (45 files) → Partial

- **Keep Core**: Basic dashboard overview
- **Plugin Options**:
  - Analytics widgets → `@app/analytics-widgets` plugin
  - Custom dashboard sections → Individual plugins

---

### Category 4: Keep in Core (Do Not Convert)

These should remain in the application core:

#### System/Core Components

- **\_examples** (149 files): Demo/documentation, reference material
- **auth-demo** (12 files): Authentication examples for developers
- **blank** (1 file): Template for new pages
- **configuration** (34 files): Core configuration UI (uses plugin system)
- **error** (4 files): Error pages (404, 500, etc.)
- **home** (12 files): Landing page (core marketing)
- **maintenance** (1 file): Maintenance mode page
- **permission** (1 file): Permission management (core security)
- **coming-soon** (1 file): Coming soon page

---

## 🏗️ Recommended Plugin Structure

### High Priority Plugins (Phase 1)

```
packages/features/
├── checkout/
│   ├── src/
│   │   ├── components/          # Checkout forms, steps
│   │   ├── hooks/               # useCheckout, useCart
│   │   ├── plugin.tsx           # Plugin definition
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── order/
│   ├── src/
│   │   ├── components/          # Order list, details
│   │   ├── hooks/               # useOrders
│   │   ├── plugin.tsx
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── payment/
│   ├── src/
│   │   ├── components/          # Payment methods, forms
│   │   ├── hooks/               # usePayment
│   │   ├── plugin.tsx
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── file-manager/
│   ├── src/
│   │   ├── components/          # File upload, browser
│   │   ├── hooks/               # useFileManager
│   │   ├── plugin.tsx
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── job/
├── tour/
└── address/
```

---

## 📝 Plugin Definition Example

### Checkout Plugin

```typescript
// packages/features/checkout/src/plugin.tsx

import type { Plugin } from '@app/config/types';
import { CheckoutPage } from './components/checkout-page';

export const checkoutPlugin: Plugin = {
  id: 'checkout',
  name: 'Checkout',
  version: '1.0.0',
  description: 'E-commerce checkout flow with payment integration',
  author: 'Your Team',
  enabled: true,
  type: 'full',
  status: 'active',

  // Routes
  routes: [
    {
      path: '/product/checkout',
      component: CheckoutPage,
      protected: true,
      layout: 'dashboard',
      meta: {
        title: 'Checkout',
        description: 'Complete your purchase',
      },
    },
  ],

  // Navigation
  navigation: [
    {
      id: 'checkout',
      title: 'Checkout',
      path: '/product/checkout',
      icon: 'solar:cart-check-bold-duotone',
      section: 'ecommerce',
      order: 20,
    },
  ],

  // Lifecycle hooks
  hooks: {
    onInit: async () => {
      console.log('[Checkout Plugin] Initialized');
    },
  },

  // Settings
  settings: {
    paymentGateways: ['stripe', 'paypal'],
    shippingMethods: ['standard', 'express'],
    taxCalculation: 'automatic',
    guestCheckout: true,
  },

  // Dependencies
  dependencies: [], // or ['payment', 'cart'] if those exist

  // Metadata
  metadata: {
    tags: ['ecommerce', 'checkout', 'payment'],
    license: 'MIT',
  },

  installDate: new Date().toISOString(),
  source: 'local',
  isSystem: false,
};
```

---

## 🔄 Migration Steps

### Phase 1: High Priority Feature Modules (Immediate Value)

1. **Create plugin packages**:

   ```bash
   mkdir -p packages/features/{checkout,order,payment,file-manager,job,tour,address}
   ```

2. **For each plugin**:

   - Create package structure (src/, package.json, tsconfig.json)
   - Move section files from `src/sections/[name]/` to `packages/features/[name]/src/components/`
   - Create plugin definition file
   - Export plugin from package
   - Add TypeScript path mapping
   - Update imports

3. **Register plugins**:

   ```typescript
   // In config or app initialization
   import { checkoutPlugin } from '@app/checkout';
   import { orderPlugin } from '@app/order';
   // ... etc

   pluginManager.registerPlugin(checkoutPlugin);
   pluginManager.registerPlugin(orderPlugin);
   // ... etc
   ```

4. **Use plugin routes in app**:

   ```typescript
   // In app router
   import { usePluginRoutes } from '@app/config';

   const pluginRoutes = usePluginRoutes();

   // Render plugin routes dynamically
   ```

### Phase 2: Content Modules (Optional)

Convert about, contact, faqs, pricing to plugins following the same pattern.

### Phase 3: Partial Conversions

Split account and overview into core + optional plugins.

---

## ✅ Benefits of Plugin Conversion

### 1. **Modularity**

- Enable/disable features per deployment
- Reduce bundle size by disabling unused features
- Clean separation of concerns

### 2. **Customization**

- Different clients can have different features enabled
- Multi-tenant support with per-tenant plugin configuration
- Feature flags become plugin enable/disable

### 3. **Maintainability**

- Each feature is self-contained
- Clear boundaries and dependencies
- Easier testing (test plugin in isolation)

### 4. **Scalability**

- Add new features as plugins without modifying core
- Plugins can be developed independently
- Can be extracted to separate npm packages later

### 5. **Code Organization**

```
Before:
src/sections/checkout/     # Mixed with all other sections

After:
packages/features/checkout/  # Self-contained plugin package
```

---

## ⚠️ Considerations

### Keep in Mind

1. **Dependencies**: Some plugins may depend on others (e.g., checkout depends on payment)
2. **Shared Components**: Extract truly shared components to `@app/components`
3. **API Integration**: Plugin APIs need to be registered with the app
4. **Database Schemas**: Plugins needing DB changes should document their schema requirements
5. **Migration Path**: Existing data/routes need migration strategy

### What NOT to Convert

- **Core System**: auth, config, error pages, permissions
- **Landing Page**: Home page should remain core
- **Examples/Demos**: Keep as reference material
- **Templates**: Blank pages, maintenance, coming-soon

---

## 🎯 Recommended Priority Order

### Phase 1 (High Priority - Week 1-2)

1. **file-manager** - Self-contained, no dependencies
2. **payment** - Core e-commerce, needed by checkout
3. **order** - Core e-commerce, frequently customized

### Phase 2 (Medium Priority - Week 3-4)

4. **checkout** - Depends on payment
5. **job** - Complete feature, good plugin candidate
6. **tour** - Complete feature, good plugin candidate

### Phase 3 (Low Priority - Week 5-6)

7. **address** - Small utility module
8. **about** - Simple content page
9. **contact** - Simple content page
10. **faqs** - Simple content page
11. **pricing** - Simple content page

---

## 📊 Impact Summary

### Sections to Convert to Plugins: **11-13** (depending on partial conversions)

### Sections to Keep in Core: **10**

### Total Plugin Packages: **7-9 high priority + 4-5 low priority = 11-14 plugins**

### Estimated Effort:

- **High Priority Plugins**: 2-3 days each (6 plugins = 12-18 days)
- **Low Priority Plugins**: 1 day each (5 plugins = 5 days)
- **Total**: ~3-4 weeks for complete conversion

### Benefits:

- ✅ Modular, pluggable architecture
- ✅ Per-client feature customization
- ✅ Reduced bundle size for deployments
- ✅ Clear separation of features
- ✅ Easier testing and maintenance
- ✅ Foundation for future marketplace/plugin ecosystem

---

## 🚀 Next Steps

1. **Decision**: Choose which plugins to create first (recommended: Phase 1)
2. **Create Package Structure**: Set up plugin package skeletons
3. **Migrate First Plugin**: Start with file-manager (simplest, no dependencies)
4. **Test & Validate**: Ensure plugin system works end-to-end
5. **Document Pattern**: Create plugin creation guide based on first plugin
6. **Scale Up**: Convert remaining high-priority plugins
7. **Iterate**: Convert low-priority plugins as needed

---

**Date**: November 17, 2025
**Status**: Strategy Document
**Next Action**: Decide on Phase 1 plugins and create package structure
