// Endpoint Configuration Wrapper
// Wraps existing endpoint handlers with configuration layer
// Allows runtime configuration of auth, rate limits, etc.
// ----------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { getConfigManager } from '@app/config';
import type { APIEndpointConfig } from '@app/types';

// Rate limit store (in-memory, consider Redis for production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Wraps an endpoint handler with configuration-based middleware
 */
export function withEndpointConfig(
  endpointId: string,
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async function (request: NextRequest, context?: any): Promise<NextResponse> {
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    // Find endpoint configuration by ID or path
    const routePath = request.nextUrl.pathname;
    const method = request.method;

    const endpointConfig = config.customEndpoints.find(
      (ep) => ep.id === endpointId || (matchRoute(ep.path, routePath) && ep.method === method)
    );

    // If no config found or config is disabled, proceed with handler
    if (!endpointConfig || !endpointConfig.enabled) {
      return handler(request, context);
    }

    // Check authentication if required
    if (endpointConfig.auth?.required) {
      const authResult = await checkAuth(request, endpointConfig);
      if (!authResult.authorized) {
        return NextResponse.json(
          {
            success: false,
            error: authResult.error || 'Unauthorized',
            code: 'UNAUTHORIZED',
          },
          { status: 401 }
        );
      }

      // Attach user to context if available
      if (authResult.user && context) {
        context.user = authResult.user;
      }
    }

    // Check rate limiting if enabled
    if (endpointConfig.rateLimit?.enabled) {
      const rateLimitResult = checkRateLimit(request, endpointConfig);
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: rateLimitResult.error || 'Rate limit exceeded',
            code: 'RATE_LIMIT_EXCEEDED',
          },
          { status: 429 }
        );
      }
    }

    // Add custom request headers
    if (endpointConfig.requestHeaders) {
      Object.entries(endpointConfig.requestHeaders).forEach(([key, value]) => {
        request.headers.set(key, value);
      });
    }

    // Call original handler
    const response = await handler(request, context);

    // Add custom response headers
    if (endpointConfig.responseHeaders) {
      Object.entries(endpointConfig.responseHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
    }

    return response;
  };
}

/**
 * Matches a route pattern with dynamic segments
 * Pattern: /api/v1/users/:id
 * Path: /api/v1/users/123
 */
function matchRoute(pattern: string, path: string): boolean {
  // Convert Next.js [id] syntax to regex pattern
  const regexPattern = pattern
    .replace(/\[([^\]]+)\]/g, '([^/]+)') // [id] -> ([^/]+)
    .replace(/\//g, '\\/'); // Escape slashes

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Checks authentication for the endpoint
 */
async function checkAuth(
  request: NextRequest,
  endpoint: APIEndpointConfig
): Promise<{ authorized: boolean; error?: string; user?: any }> {
  if (!endpoint.auth?.required) {
    return { authorized: true };
  }

  // Get token from Authorization header
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return { authorized: false, error: 'Authorization header required' };
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return { authorized: false, error: 'Invalid token format' };
  }

  // TODO: Implement actual JWT validation
  // For now, basic check
  try {
    // This should integrate with your existing auth system
    // Example: const user = await verifyJWT(token);

    const mockUser = {
      id: 'user-123',
      roles: ['admin'],
      permissions: ['*'],
    };

    // Check roles if specified
    if (endpoint.auth.roles && endpoint.auth.roles.length > 0) {
      const hasRole = endpoint.auth.roles.some((role) => mockUser.roles.includes(role));
      if (!hasRole) {
        return { authorized: false, error: 'Insufficient permissions' };
      }
    }

    return { authorized: true, user: mockUser };
  } catch (error) {
    return { authorized: false, error: 'Invalid token' };
  }
}

/**
 * Checks rate limiting for the endpoint
 */
function checkRateLimit(
  request: NextRequest,
  endpoint: APIEndpointConfig
): { allowed: boolean; error?: string } {
  if (!endpoint.rateLimit?.enabled) {
    return { allowed: true };
  }

  const ip =
    request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const key = `${endpoint.id}:${ip}`;
  const now = Date.now();

  const limit = rateLimitStore.get(key);

  if (!limit || now > limit.resetTime) {
    // Create new rate limit window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + endpoint.rateLimit.windowMs,
    });
    return { allowed: true };
  }

  if (limit.count >= endpoint.rateLimit.maxRequests) {
    return {
      allowed: false,
      error: `Rate limit exceeded. Try again in ${Math.ceil(
        (limit.resetTime - now) / 1000
      )} seconds`,
    };
  }

  limit.count += 1;
  return { allowed: true };
}

/**
 * Factory function to create configured handler
 * Use this in your route.ts files:
 *
 * const GET = createConfiguredHandler('users-list', originalGetHandler);
 * export { GET };
 */
export function createConfiguredHandler(
  endpointId: string,
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return withEndpointConfig(endpointId, handler);
}
