// Endpoint Discovery System
// Scans /api/v1/ directory and extracts endpoint metadata
// ----------------------------------------------------------------------

import fs from 'fs';
import path from 'path';

export interface DiscoveredEndpoint {
  id: string; // Unique identifier
  filePath: string; // Relative to project root
  routePath: string; // API path (e.g., /api/v1/auth/login)
  methods: string[]; // HTTP methods supported
  auth: {
    required: boolean;
    roles?: string[];
    permissions?: string[];
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
    preset?: string;
  };
  isDynamic: boolean; // Has dynamic segments [id], [token]
  dynamicSegments: string[]; // ['id', 'token']
  tags: string[]; // Categorization (auth, admin, billing, etc.)
  description?: string;
  requiresAdmin?: boolean;
  domain: string; // auth, billing, admin, etc.
}

/**
 * Scans the /api/v1/ directory and discovers all route.ts files
 */
export async function scanEndpoints(
  apiDir: string = 'src/app/api/v1'
): Promise<DiscoveredEndpoint[]> {
  const endpoints: DiscoveredEndpoint[] = [];
  const baseDir = path.join(process.cwd(), apiDir);

  function scanDirectory(dir: string) {
    if (!fs.existsSync(dir)) {
      console.warn(`Directory not found: ${dir}`);
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        scanDirectory(fullPath);
      } else if (entry.name === 'route.ts') {
        // Found a route file
        const endpoint = analyzeRouteFile(fullPath, baseDir);
        if (endpoint) {
          endpoints.push(endpoint);
        }
      }
    }
  }

  scanDirectory(baseDir);
  return endpoints;
}

/**
 * Analyzes a route.ts file and extracts metadata
 */
function analyzeRouteFile(filePath: string, baseDir: string): DiscoveredEndpoint | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract relative path from base directory
    const relativePath = path.relative(baseDir, filePath);

    // Convert file path to route path
    // src/app/api/v1/auth/login/route.ts -> /api/v1/auth/login
    const routePath = filePathToRoutePath(relativePath);

    // Extract HTTP methods from exports
    const methods = extractHttpMethods(content);

    if (methods.length === 0) {
      return null; // Not a valid route file
    }

    // Extract auth requirements
    const auth = extractAuthConfig(content);

    // Extract rate limit config
    const rateLimit = extractRateLimitConfig(content);

    // Check for dynamic segments [id], [token], etc.
    const dynamicSegments = extractDynamicSegments(routePath);

    // Extract domain/category from path
    const domain = extractDomain(routePath);

    // Extract tags
    const tags = extractTags(content, domain);

    // Extract description from comments
    const description = extractDescription(content);

    // Check if requires admin
    const requiresAdmin = content.includes('requireAdmin') || content.includes('system-admin');

    // Generate unique ID
    const id = generateEndpointId(routePath, methods);

    return {
      id,
      filePath: path.relative(process.cwd(), filePath),
      routePath,
      methods,
      auth,
      rateLimit,
      isDynamic: dynamicSegments.length > 0,
      dynamicSegments,
      tags,
      domain,
      description,
      requiresAdmin,
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error);
    return null;
  }
}

/**
 * Converts file path to API route path
 * auth/login/route.ts -> /api/v1/auth/login
 * billing/subscriptions/[id]/route.ts -> /api/v1/billing/subscriptions/[id]
 */
function filePathToRoutePath(relativePath: string): string {
  // Remove route.ts from end
  let routePath = relativePath.replace(/route\.ts$/, '');

  // Remove trailing slash
  routePath = routePath.replace(/\/$/, '');

  // Add /api/v1 prefix
  routePath = `/api/v1/${routePath}`;

  // Clean up double slashes
  routePath = routePath.replace(/\/+/g, '/');

  // Remove trailing slash if exists
  routePath = routePath.replace(/\/$/, '');

  return routePath || '/api/v1';
}

/**
 * Extracts HTTP methods from export statements
 */
function extractHttpMethods(content: string): string[] {
  const methods: string[] = [];
  const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

  for (const method of httpMethods) {
    // Check for: export const GET = ...
    // or: export async function GET(...) { }
    const exportPattern = new RegExp(
      `export\\s+(const|async\\s+function)\\s+${method}\\s*[=(]`,
      'i'
    );

    if (exportPattern.test(content)) {
      methods.push(method);
    }
  }

  return methods;
}

/**
 * Extracts authentication configuration
 */
function extractAuthConfig(content: string): {
  required: boolean;
  roles?: string[];
  permissions?: string[];
} {
  const auth: { required: boolean; roles?: string[]; permissions?: string[] } = {
    required: false,
  };

  // Check for auth: { required: true }
  const authRequiredMatch = content.match(/auth:\s*{\s*required:\s*(true|false)/);
  if (authRequiredMatch) {
    auth.required = authRequiredMatch[1] === 'true';
  }

  // Check for requireAdmin
  if (content.includes('requireAdmin')) {
    auth.required = true;
    auth.roles = ['admin', 'system-admin'];
  }

  // Check for role requirements
  const rolesMatch = content.match(/roles:\s*\[(.*?)\]/s);
  if (rolesMatch) {
    const rolesStr = rolesMatch[1];
    const roles = rolesStr.match(/'([^']+)'|"([^"]+)"/g)?.map((r) => r.replace(/['"]/g, '')) || [];
    auth.roles = roles;
  }

  // Check for permission requirements
  const permissionsMatch = content.match(/permissions:\s*\[(.*?)\]/s);
  if (permissionsMatch) {
    const permsStr = permissionsMatch[1];
    const permissions =
      permsStr.match(/'([^']+)'|"([^"]+)"/g)?.map((p) => p.replace(/['"]/g, '')) || [];
    auth.permissions = permissions;
  }

  return auth;
}

/**
 * Extracts rate limit configuration
 */
function extractRateLimitConfig(
  content: string
): { windowMs: number; maxRequests: number; preset?: string } | undefined {
  // Check for rate limit preset: rateLimitConfigs.strict
  const presetMatch = content.match(/rateLimitConfigs\.(\w+)/);
  if (presetMatch) {
    const preset = presetMatch[1];
    const presets: Record<string, { windowMs: number; maxRequests: number }> = {
      strict: { windowMs: 15 * 60 * 1000, maxRequests: 5 },
      standard: { windowMs: 15 * 60 * 1000, maxRequests: 100 },
      lenient: { windowMs: 15 * 60 * 1000, maxRequests: 1000 },
      perMinute: { windowMs: 60 * 1000, maxRequests: 60 },
      perSecond: { windowMs: 1000, maxRequests: 10 },
      payment: { windowMs: 15 * 60 * 1000, maxRequests: 20 },
    };

    if (presets[preset]) {
      return { ...presets[preset], preset };
    }
  }

  // Check for inline rate limit config
  const rateLimitMatch = content.match(
    /rateLimit:\s*{\s*windowMs:\s*(\d+),?\s*maxRequests:\s*(\d+)/
  );
  if (rateLimitMatch) {
    return {
      windowMs: parseInt(rateLimitMatch[1], 10),
      maxRequests: parseInt(rateLimitMatch[2], 10),
    };
  }

  return undefined;
}

/**
 * Extracts dynamic segments from route path
 * /api/v1/billing/subscriptions/[id] -> ['id']
 * /api/v1/users/[userId]/posts/[postId] -> ['userId', 'postId']
 */
function extractDynamicSegments(routePath: string): string[] {
  const matches = routePath.match(/\[([^\]]+)\]/g);
  if (!matches) return [];

  return matches.map((m) => m.replace(/[\[\]]/g, ''));
}

/**
 * Extracts domain/category from route path
 * /api/v1/auth/login -> auth
 * /api/v1/billing/subscriptions -> billing
 */
function extractDomain(routePath: string): string {
  const segments = routePath.split('/').filter(Boolean);
  // Skip 'api', 'v1'
  if (segments.length > 2) {
    return segments[2];
  }
  return 'general';
}

/**
 * Extracts tags from content and domain
 */
function extractTags(content: string, domain: string): string[] {
  const tags: string[] = [domain];

  if (content.includes('requireAdmin') || content.includes('system-admin')) {
    tags.push('admin');
  }

  if (content.includes('Stripe') || content.includes('payment')) {
    tags.push('payment');
  }

  if (content.includes('createApiHandler')) {
    tags.push('rest-api');
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Extracts description from JSDoc comment
 */
function extractDescription(content: string): string | undefined {
  // Look for comment at top of file
  const commentMatch = content.match(/^\/\*\*?\s*\n?\s*(.+?)\s*\n/);
  if (commentMatch) {
    return commentMatch[1].replace(/\*/g, '').trim();
  }

  // Look for @description tag
  const descMatch = content.match(/@description\s+(.+)/);
  if (descMatch) {
    return descMatch[1].trim();
  }

  return undefined;
}

/**
 * Generates unique ID for endpoint
 */
function generateEndpointId(routePath: string, methods: string[]): string {
  const pathId = routePath.replace(/\//g, '-').replace(/^\-/, '');
  const methodId = methods.join('-');
  return `${pathId}-${methodId}`.toLowerCase();
}

/**
 * Generates endpoint registry JSON file
 */
export async function generateEndpointRegistry(
  outputPath: string = 'src/config/endpoint-registry.json'
): Promise<void> {
  const endpoints = await scanEndpoints();

  const fullPath = path.join(process.cwd(), outputPath);
  const dir = path.dirname(fullPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write JSON file
  fs.writeFileSync(fullPath, JSON.stringify(endpoints, null, 2), 'utf-8');

  console.log(`✅ Generated endpoint registry: ${outputPath}`);
  console.log(`   Discovered ${endpoints.length} endpoints`);
}
