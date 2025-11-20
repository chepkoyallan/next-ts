# API Endpoint Discovery System

Automatically discovers and configures all API endpoints in `/api/v1/`.

## Features

- 🔍 **Auto-Discovery**: Scans all `route.ts` files in `/api/v1/`
- 📊 **Metadata Extraction**: Extracts HTTP methods, auth, rate limits, etc.
- ⚙️ **Configuration Layer**: Wraps endpoints with runtime configuration
- 🎯 **CRUD Interface**: Manage endpoints via UI in Configuration Dashboard

## Quick Start

### 1. Generate Endpoint Registry (Build Time)

```bash
# Generate registry JSON file
tsx scripts/generate-endpoint-registry.ts

# Or add to package.json scripts:
npm run discover:endpoints
```

This creates `/src/config/endpoint-registry.json` with all discovered endpoints.

### 2. Discover Endpoints (Runtime)

```bash
# Call API endpoint to discover on-the-fly
curl http://localhost:3000/api/discover-endpoints
```

Returns JSON with all discovered endpoints.

### 3. Import in Configuration UI

1. Navigate to `/dashboard/configuration`
2. Go to "API Endpoints" tab
3. Click "Import Discovered Endpoints"
4. Select endpoints to enable configuration for
5. Configure auth, rate limits, proxies, etc.

## How It Works

### File Structure Pattern

The scanner looks for this pattern:

```
/src/app/api/v1/
  ├── auth/
  │   ├── login/
  │   │   └── route.ts          → /api/v1/auth/login
  │   └── logout/
  │       └── route.ts          → /api/v1/auth/logout
  ├── users/
  │   ├── route.ts              → /api/v1/users
  │   └── [id]/
  │       └── route.ts          → /api/v1/users/:id
  └── billing/
      └── subscriptions/
          ├── route.ts          → /api/v1/billing/subscriptions
          └── [id]/
              └── route.ts      → /api/v1/billing/subscriptions/:id
```

### Metadata Extraction

The scanner extracts:

**1. HTTP Methods**

```typescript
export const GET = handler;        // ✅ Detected
export async function POST(...) { } // ✅ Detected
```

**2. Authentication**

```typescript
createApiHandler({
  auth: {
    required: true,
    roles: ['admin', 'user']
  }
}, { ... })
```

**3. Rate Limits**

```typescript
createApiHandler({
  rateLimit: rateLimitConfigs.strict  // ✅ Detected
}, { ... })
```

**4. Dynamic Segments**

```
/api/v1/users/[id]/posts/[postId]
→ Dynamic segments: ['id', 'postId']
```

**5. Tags & Domain**

```
/api/v1/auth/login → domain: 'auth', tags: ['auth']
/api/v1/billing/* → domain: 'billing', tags: ['billing', 'payment']
```

### Discovered Endpoint Structure

```typescript
interface DiscoveredEndpoint {
  id: string; // Unique ID
  filePath: string; // Source file path
  routePath: string; // API path
  methods: string[]; // ['GET', 'POST']
  auth: {
    required: boolean;
    roles?: string[];
    permissions?: string[];
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
    preset?: string; // 'strict', 'standard', etc.
  };
  isDynamic: boolean; // Has [id] segments
  dynamicSegments: string[]; // ['id', 'postId']
  tags: string[]; // ['auth', 'admin']
  domain: string; // 'auth', 'billing', etc.
  description?: string; // From JSDoc
  requiresAdmin?: boolean;
}
```

## Configuration Layer

### Wrapping Existing Endpoints

To add configuration to an existing endpoint:

```typescript
// Before:
export async function GET(request: NextRequest) {
  // handler logic
}

// After:
import { createConfiguredHandler } from 'src/app/api/lib/middleware/endpoint-config-wrapper';

const getHandler = async (request: NextRequest) => {
  // handler logic
};

export const GET = createConfiguredHandler('users-list-get', getHandler);
```

### What Gets Configured?

The wrapper checks configuration and applies:

1. **Authentication** - Validates JWT, checks roles/permissions
2. **Rate Limiting** - Enforces request limits per IP
3. **Custom Headers** - Adds request/response headers
4. **Enable/Disable** - Can disable endpoints entirely

### Configuration Priority

1. ✅ **Runtime Config** (from UI) - Highest priority
2. ✅ **Code Config** (in route.ts) - Fallback
3. ✅ **No Config** - Endpoint works normally

## Usage Examples

### Example 1: Import Discovered Endpoints

```typescript
import { useDiscoveredEndpoints, discoveredToConfig } from 'src/app/api/lib/discovery/use-discovered-endpoints';

function MyComponent() {
  const { endpoints, loading } = useDiscoveredEndpoints();

  const handleImport = (endpoint) => {
    const config = discoveredToConfig(endpoint);
    // Add to customEndpoints in config
  };

  return (
    <div>
      {endpoints.map(ep => (
        <div key={ep.id}>
          <h3>{ep.routePath}</h3>
          <p>Methods: {ep.methods.join(', ')}</p>
          <button onClick={() => handleImport(ep)}>Import</button>
        </div>
      ))}
    </div>
  );
}
```

### Example 2: Generate Registry in CI/CD

```yaml
# .github/workflows/build.yml
- name: Generate Endpoint Registry
  run: tsx scripts/generate-endpoint-registry.ts

- name: Commit Registry
  run: |
    git add src/config/endpoint-registry.json
    git commit -m "chore: update endpoint registry"
```

### Example 3: Dynamic Configuration

```typescript
// In your route.ts
import { withEndpointConfig } from 'src/app/api/lib/middleware/endpoint-config-wrapper';

export const GET = withEndpointConfig(
  'api-v1-users-get', // Endpoint ID
  async (request) => {
    // Your handler logic
    return NextResponse.json({ users: [] });
  }
);
```

## API Reference

### `scanEndpoints(apiDir?: string): Promise<DiscoveredEndpoint[]>`

Scans directory and returns discovered endpoints.

**Parameters:**

- `apiDir` - Directory to scan (default: `'src/app/api/v1'`)

**Returns:** Array of discovered endpoints

### `generateEndpointRegistry(outputPath?: string): Promise<void>`

Generates JSON registry file.

**Parameters:**

- `outputPath` - Output file path (default: `'src/config/endpoint-registry.json'`)

### `withEndpointConfig(endpointId, handler): Function`

Wraps handler with configuration layer.

**Parameters:**

- `endpointId` - Unique endpoint identifier
- `handler` - Original route handler

**Returns:** Wrapped handler function

### `useDiscoveredEndpoints(): Object`

React hook to load discovered endpoints.

**Returns:**

```typescript
{
  endpoints: DiscoveredEndpoint[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}
```

## Configuration UI

Access at: **Dashboard → Configuration → API Endpoints**

Features:

- 📋 View all endpoints
- ➕ Create custom endpoints
- 🔄 Import discovered endpoints
- ⚙️ Configure auth, rate limits, proxies
- 🧪 Test endpoints
- 🔐 Enable/disable endpoints

## Best Practices

1. **Generate Registry at Build Time**

   - Run `tsx scripts/generate-endpoint-registry.ts` before deploy
   - Commit `endpoint-registry.json` to version control

2. **Use Wrapper for Sensitive Endpoints**

   - Apply `withEndpointConfig` to endpoints that need runtime config
   - Keep configuration minimal for performance

3. **Document Endpoints**

   - Add JSDoc comments to route files
   - Scanner extracts descriptions automatically

4. **Tag Endpoints**

   - Use consistent naming for domains
   - Scanner auto-tags based on path structure

5. **Monitor Rate Limits**
   - Check rate limit hits in logs
   - Adjust limits based on usage patterns

## Troubleshooting

### Endpoints Not Discovered

- ✅ Ensure file is named `route.ts`
- ✅ Check exports: `export const GET` or `export async function GET`
- ✅ Verify file is in `/src/app/api/v1/` directory

### Configuration Not Applied

- ✅ Ensure endpoint is enabled in config
- ✅ Check `endpointId` matches in wrapper
- ✅ Verify configuration is saved to localStorage

### Rate Limits Not Working

- ✅ Check `rateLimit.enabled` is `true`
- ✅ Verify IP address is extracted correctly
- ✅ Consider using Redis for production (in-memory store resets)

## Future Enhancements

- [ ] Redis-based rate limiting
- [ ] OpenAPI/Swagger generation from discovered endpoints
- [ ] Endpoint versioning support
- [ ] A/B testing for endpoints
- [ ] Request/response logging
- [ ] Analytics and metrics
- [ ] Cost tracking for proxied endpoints
- [ ] Automatic endpoint documentation

## License

MIT
