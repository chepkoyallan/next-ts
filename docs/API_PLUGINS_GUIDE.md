## API Plugins Guide

Complete guide for registering and managing API routes through the plugin system.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [API Registry](#api-registry)
- [Registering API Routes](#registering-api-routes)
- [Middleware](#middleware)
- [Authentication & Authorization](#authentication--authorization)
- [Rate Limiting](#rate-limiting)
- [CORS Configuration](#cors-configuration)
- [API Versioning](#api-versioning)
- [Request Validation](#request-validation)
- [OpenAPI/Swagger](#openapiswagger)
- [Examples](#examples)
- [Best Practices](#best-practices)

---

## Overview

The API Registry enables plugins to register API endpoints dynamically with:

- ✅ Dynamic route registration
- ✅ Middleware support
- ✅ Role-based access control
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Request validation
- ✅ OpenAPI/Swagger generation
- ✅ API versioning

---

## Quick Start

### 1. Register an API Route

```typescript
// packages/features/my-plugin/index.ts
import { apiRegistry } from '@app/config/registry';
import type { Plugin } from '@app/config/types';

export const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    onInit: () => {
      // Register API route
      apiRegistry.registerRoute({
        id: 'my-plugin.get-users',
        path: '/api/users',
        method: 'GET',
        handler: async (req, res) => {
          const users = await getUsers();
          res.status(200).json({ users });
        },
        pluginId: 'my-plugin',
        description: 'Get all users',
        tags: ['users']
      });
    }
  }
};
```

### 2. Create Next.js API Route

Create `src/app/api/users/route.ts`:

```typescript
import { apiRegistry } from '@app/config/registry';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const route = apiRegistry.getRouteByPath('/api/users', 'GET');

  if (!route) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Execute handler
  const mockRes = {
    status: (code: number) => ({
      json: (data: any) => NextResponse.json(data, { status: code })
    })
  };

  return await route.handler(request, mockRes);
}
```

### 3. Use the API

```typescript
// Client-side
const response = await fetch('/api/users');
const data = await response.json();
console.log(data.users);
```

---

## API Registry

### Methods

#### `registerRoute(route: ApiRouteDefinition)`

Register a new API endpoint.

```typescript
apiRegistry.registerRoute({
  id: 'plugin.endpoint-name',
  path: '/api/endpoint',
  method: 'POST',
  handler: async (req, res) => {
    // Handle request
  },
  pluginId: 'my-plugin',
  description: 'Endpoint description',
  protected: true,
  roles: ['admin'],
  middleware: [authMiddleware, loggingMiddleware],
  rateLimit: 100, // requests per minute
  tags: ['category']
});
```

#### `registerRoutes(routes: ApiRouteDefinition[])`

Register multiple routes at once.

```typescript
apiRegistry.registerRoutes([
  { id: 'get-users', path: '/api/users', method: 'GET', ... },
  { id: 'create-user', path: '/api/users', method: 'POST', ... },
  { id: 'update-user', path: '/api/users/:id', method: 'PUT', ... },
]);
```

#### `getRoute(routeId: string)`

Get a route by ID.

```typescript
const route = apiRegistry.getRoute('my-plugin.get-users');
```

#### `getRouteByPath(path: string, method: HttpMethod)`

Get a route by path and HTTP method.

```typescript
const route = apiRegistry.getRouteByPath('/api/users', 'GET');
```

#### `unregisterRoute(routeId: string)`

Remove a route.

```typescript
apiRegistry.unregisterRoute('my-plugin.get-users');
```

---

## Registering API Routes

### Basic Route

```typescript
apiRegistry.registerRoute({
  id: 'products.list',
  path: '/api/products',
  method: 'GET',
  handler: async (req, res) => {
    const products = await db.products.findMany();
    res.status(200).json({ products });
  },
  pluginId: 'products-plugin',
  description: 'List all products'
});
```

### Route with Parameters

```typescript
apiRegistry.registerRoute({
  id: 'products.get',
  path: '/api/products/:id',
  method: 'GET',
  handler: async (req, res) => {
    const { id } = req.params;
    const product = await db.products.findUnique({ where: { id } });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ product });
  },
  pluginId: 'products-plugin'
});
```

### POST Route with Body

```typescript
apiRegistry.registerRoute({
  id: 'products.create',
  path: '/api/products',
  method: 'POST',
  handler: async (req, res) => {
    const body = await req.json();
    const product = await db.products.create({ data: body });
    res.status(201).json({ product });
  },
  pluginId: 'products-plugin',
  validation: {
    body: {
      type: 'object',
      required: ['name', 'price'],
      properties: {
        name: { type: 'string' },
        price: { type: 'number' }
      }
    }
  }
});
```

---

## Middleware

### Creating Middleware

```typescript
// middleware/auth.ts
export const authMiddleware = async (req, res, next) => {
  const token = req.headers.get('authorization');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Using Middleware

```typescript
apiRegistry.registerRoute({
  id: 'admin.users',
  path: '/api/admin/users',
  method: 'GET',
  middleware: [authMiddleware, adminMiddleware],
  handler: async (req, res) => {
    // req.user is available from authMiddleware
    const users = await db.users.findMany();
    res.status(200).json({ users });
  },
  pluginId: 'admin-plugin'
});
```

### Global Middleware

Apply to all routes:

```typescript
apiRegistry.registerGlobalMiddleware(async (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
```

---

## Authentication & Authorization

### Protected Routes

```typescript
apiRegistry.registerRoute({
  id: 'profile.get',
  path: '/api/profile',
  method: 'GET',
  protected: true, // Requires authentication
  handler: async (req, res) => {
    const user = req.user; // From auth middleware
    res.status(200).json({ user });
  },
  pluginId: 'auth-plugin'
});
```

### Role-Based Access

```typescript
apiRegistry.registerRoute({
  id: 'admin.dashboard',
  path: '/api/admin/dashboard',
  method: 'GET',
  protected: true,
  roles: ['admin', 'super-admin'], // Only these roles
  handler: async (req, res) => {
    const stats = await getAdminStats();
    res.status(200).json({ stats });
  },
  pluginId: 'admin-plugin'
});
```

### Check Access

```typescript
const hasAccess = apiRegistry.hasAccess('admin.dashboard', ['admin']);
// true if user has admin role
```

---

## Rate Limiting

```typescript
apiRegistry.registerRoute({
  id: 'api.public-search',
  path: '/api/search',
  method: 'GET',
  rateLimit: 60, // 60 requests per minute
  handler: async (req, res) => {
    const { q } = req.query;
    const results = await search(q);
    res.status(200).json({ results });
  },
  pluginId: 'search-plugin'
});
```

---

## CORS Configuration

```typescript
apiRegistry.registerRoute({
  id: 'api.public-endpoint',
  path: '/api/public/data',
  method: 'GET',
  cors: {
    origin: ['https://example.com', 'https://app.example.com'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  handler: async (req, res) => {
    res.status(200).json({ data: 'public' });
  },
  pluginId: 'public-api-plugin'
});
```

---

## API Versioning

### Version 1

```typescript
apiRegistry.registerRoute({
  id: 'users.list.v1',
  path: '/api/v1/users',
  method: 'GET',
  version: 'v1',
  handler: async (req, res) => {
    // V1 implementation
    res.status(200).json({ users: [] });
  },
  pluginId: 'users-plugin'
});
```

### Version 2

```typescript
apiRegistry.registerRoute({
  id: 'users.list.v2',
  path: '/api/v2/users',
  method: 'GET',
  version: 'v2',
  handler: async (req, res) => {
    // V2 implementation with new fields
    res.status(200).json({ users: [], pagination: {} });
  },
  pluginId: 'users-plugin'
});
```

---

## Request Validation

### Query Validation

```typescript
apiRegistry.registerRoute({
  id: 'products.search',
  path: '/api/products/search',
  method: 'GET',
  validation: {
    query: {
      type: 'object',
      required: ['q'],
      properties: {
        q: { type: 'string', minLength: 3 },
        limit: { type: 'number', minimum: 1, maximum: 100 }
      }
    }
  },
  handler: async (req, res) => {
    const { q, limit = 10 } = req.query;
    // Query is validated
  },
  pluginId: 'products-plugin'
});
```

### Body Validation

```typescript
apiRegistry.registerRoute({
  id: 'users.create',
  path: '/api/users',
  method: 'POST',
  validation: {
    body: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 8 },
        name: { type: 'string' }
      }
    }
  },
  handler: async (req, res) => {
    const body = await req.json();
    // Body is validated
  },
  pluginId: 'users-plugin'
});
```

---

## OpenAPI/Swagger

### Generate Documentation

```typescript
const openApiSpec = apiRegistry.generateOpenApiSpec({
  title: 'My API',
  version: '1.0.0',
  description: 'API documentation'
});

// Serve at /api/docs
```

### Swagger UI Integration

```typescript
// src/app/api/docs/route.ts
import { apiRegistry } from '@app/config/registry';
import { NextResponse } from 'next/server';

export async function GET() {
  const spec = apiRegistry.generateOpenApiSpec({
    title: 'My API',
    version: '1.0.0'
  });

  return NextResponse.json(spec);
}
```

---

## Examples

### Complete CRUD Plugin

```typescript
import { apiRegistry } from '@app/config/registry';
import type { Plugin } from '@app/config/types';

export const productsPlugin: Plugin = {
  id: 'products',
  name: 'Products API',
  version: '1.0.0',
  enabled: true,

  hooks: {
    onInit: () => {
      // List products
      apiRegistry.registerRoute({
        id: 'products.list',
        path: '/api/products',
        method: 'GET',
        handler: async (req, res) => {
          const products = await db.products.findMany();
          res.status(200).json({ products });
        },
        pluginId: 'products',
        tags: ['products'],
        description: 'Get all products'
      });

      // Get single product
      apiRegistry.registerRoute({
        id: 'products.get',
        path: '/api/products/:id',
        method: 'GET',
        handler: async (req, res) => {
          const product = await db.products.findUnique({
            where: { id: req.params.id }
          });
          res.status(200).json({ product });
        },
        pluginId: 'products',
        tags: ['products']
      });

      // Create product
      apiRegistry.registerRoute({
        id: 'products.create',
        path: '/api/products',
        method: 'POST',
        protected: true,
        roles: ['admin'],
        validation: {
          body: {
            type: 'object',
            required: ['name', 'price'],
            properties: {
              name: { type: 'string' },
              price: { type: 'number' },
              description: { type: 'string' }
            }
          }
        },
        handler: async (req, res) => {
          const body = await req.json();
          const product = await db.products.create({ data: body });
          res.status(201).json({ product });
        },
        pluginId: 'products',
        tags: ['products']
      });

      // Update product
      apiRegistry.registerRoute({
        id: 'products.update',
        path: '/api/products/:id',
        method: 'PUT',
        protected: true,
        roles: ['admin'],
        handler: async (req, res) => {
          const body = await req.json();
          const product = await db.products.update({
            where: { id: req.params.id },
            data: body
          });
          res.status(200).json({ product });
        },
        pluginId: 'products',
        tags: ['products']
      });

      // Delete product
      apiRegistry.registerRoute({
        id: 'products.delete',
        path: '/api/products/:id',
        method: 'DELETE',
        protected: true,
        roles: ['admin'],
        handler: async (req, res) => {
          await db.products.delete({
            where: { id: req.params.id }
          });
          res.status(204).send();
        },
        pluginId: 'products',
        tags: ['products']
      });
    },

    onDestroy: () => {
      // Cleanup
      apiRegistry.unregisterPluginRoutes('products');
    }
  }
};
```

### React Hooks Usage

```typescript
'use client';

import {
  useApiRoutes,
  useApiRoutesByMethod,
  useApiStats
} from '@app/config/registry';

export default function ApiExplorer() {
  const routes = useApiRoutes();
  const getRoutes = useApiRoutesByMethod('GET');
  const stats = useApiStats();

  return (
    <div>
      <h1>API Explorer</h1>

      <div>
        <h2>Statistics</h2>
        <p>Total Routes: {stats.totalRoutes}</p>
        <p>GET: {stats.methods.GET}</p>
        <p>POST: {stats.methods.POST}</p>
      </div>

      <div>
        <h2>All Routes</h2>
        {routes.map(route => (
          <div key={route.id}>
            <strong>{route.method}</strong> {route.path}
            {route.protected && <span> 🔒</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Best Practices

### 1. Use Consistent Naming

```typescript
// Good
'products.list'
'products.get'
'products.create'
'products.update'
'products.delete'

// Bad
'getProducts'
'productList'
'createNewProduct'
```

### 2. Group Related Endpoints

```typescript
const productRoutes = [
  { id: 'products.list', path: '/api/products', method: 'GET', ... },
  { id: 'products.get', path: '/api/products/:id', method: 'GET', ... },
  { id: 'products.create', path: '/api/products', method: 'POST', ... },
];

apiRegistry.registerRoutes(productRoutes);
```

### 3. Use Tags

```typescript
apiRegistry.registerRoute({
  // ...
  tags: ['public', 'read-only', 'v1']
});
```

### 4. Add Descriptions

```typescript
apiRegistry.registerRoute({
  // ...
  description: 'Retrieves a paginated list of products with optional filters'
});
```

### 5. Validate Input

Always validate request data to prevent security issues.

### 6. Handle Errors

```typescript
handler: async (req, res) => {
  try {
    const data = await riskyOperation();
    res.status(200).json({ data });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 7. Use Middleware for Common Logic

```typescript
const [authMiddleware, loggingMiddleware, rateLimitMiddleware]
```

### 8. Version Your APIs

Use `/api/v1/`, `/api/v2/` for breaking changes.

---

## Summary

The API Registry provides:

- ✅ **Dynamic API registration** - Add endpoints via plugins
- ✅ **Middleware support** - Reusable request processing
- ✅ **RBAC** - Role-based access control
- ✅ **Validation** - Request/response schemas
- ✅ **Documentation** - Auto-generated OpenAPI specs
- ✅ **Versioning** - Multiple API versions
- ✅ **React Hooks** - Easy access in components

Build powerful, modular APIs with the plugin system! 🚀
