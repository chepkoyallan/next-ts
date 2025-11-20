// Dynamic API Handler - Catch-all route for custom endpoints
import { NextRequest, NextResponse } from 'next/server';

import { getConfigManager } from '@app/config';
import type { APIEndpointConfig } from '@app/types';

// Helper to create error response
function createError(message: string, status: number = 400) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

// Helper to create success response
function createSuccess(data: any, status: number = 200, headers?: Record<string, string>) {
  const response = NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );

  // Add custom headers
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

// Find matching endpoint configuration
function findEndpointConfig(
  path: string,
  method: string,
  endpoints: APIEndpointConfig[]
): APIEndpointConfig | null {
  // Normalize path (remove /api/dynamic prefix)
  const normalizedPath = path.replace('/api/dynamic', '') || '/';

  return (
    endpoints.find(
      (endpoint) =>
        endpoint.enabled &&
        endpoint.path === normalizedPath &&
        endpoint.method === method.toUpperCase()
    ) || null
  );
}

// Check authentication
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

  // Basic JWT validation (you should use your actual JWT validation)
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return { authorized: false, error: 'Invalid token format' };
  }

  // TODO: Implement actual JWT validation with your auth system
  // For now, we'll just check if token exists
  const mockUser = {
    id: 'user-123',
    roles: ['admin'], // This should come from JWT
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
}

// Check rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

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

// Proxy request to external API
async function proxyRequest(
  request: NextRequest,
  endpoint: APIEndpointConfig
): Promise<NextResponse> {
  if (!endpoint.proxy?.enabled || !endpoint.proxy.targetUrl) {
    return createError('Proxy not configured', 500);
  }

  try {
    const url = new URL(request.url);
    const targetUrl = new URL(endpoint.proxy.targetUrl);

    // Preserve query parameters
    targetUrl.search = url.search;

    // Prepare headers
    const headers: HeadersInit = {};

    // Copy relevant headers from original request
    const headersToForward = ['content-type', 'accept', 'user-agent'];
    headersToForward.forEach((header) => {
      const value = request.headers.get(header);
      if (value) {
        headers[header] = value;
      }
    });

    // Add custom headers from endpoint config
    if (endpoint.proxy.headers) {
      Object.assign(headers, endpoint.proxy.headers);
    }

    // Add request headers from endpoint config
    if (endpoint.requestHeaders) {
      Object.assign(headers, endpoint.requestHeaders);
    }

    // Prepare request options
    const options: RequestInit = {
      method: endpoint.method,
      headers,
      redirect: endpoint.proxy.followRedirects ? 'follow' : 'manual',
    };

    // Add body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      const body = await request.text();
      if (body) {
        options.body = body;
      }
    }

    // Add timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), endpoint.proxy.timeout || 30000);
    options.signal = controller.signal;

    // Make the request
    const response = await fetch(targetUrl.toString(), options);
    clearTimeout(timeout);

    // Get response data
    const contentType = response.headers.get('content-type');
    let data;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Create response with custom headers
    const responseHeaders: Record<string, string> = {};
    if (endpoint.responseHeaders) {
      Object.assign(responseHeaders, endpoint.responseHeaders);
    }

    return createSuccess(data, response.status, responseHeaders);
  } catch (error: any) {
    console.error('Proxy error:', error);

    if (error.name === 'AbortError') {
      return createError('Request timeout', 504);
    }

    return createError(`Proxy error: ${error.message}`, 502);
  }
}

// Main handler
async function handleRequest(request: NextRequest): Promise<NextResponse> {
  const configManager = getConfigManager();
  const config = configManager.getConfig();

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Find matching endpoint
  const endpoint = findEndpointConfig(path, method, config.customEndpoints);

  if (!endpoint) {
    return createError(`Endpoint not found: ${method} ${path}`, 404);
  }

  if (!endpoint.enabled) {
    return createError('Endpoint is disabled', 403);
  }

  // Check authentication
  const authResult = await checkAuth(request, endpoint);
  if (!authResult.authorized) {
    return createError(authResult.error || 'Unauthorized', 401);
  }

  // Check rate limiting
  const rateLimitResult = checkRateLimit(request, endpoint);
  if (!rateLimitResult.allowed) {
    return createError(rateLimitResult.error || 'Rate limit exceeded', 429);
  }

  // Handle proxy
  if (endpoint.proxy?.enabled) {
    return proxyRequest(request, endpoint);
  }

  // If no proxy, return a default response
  return createSuccess({
    message: 'Endpoint configured but no proxy target set',
    endpoint: {
      name: endpoint.name,
      path: endpoint.path,
      method: endpoint.method,
    },
  });
}

// Export HTTP methods
export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

export async function PUT(request: NextRequest) {
  return handleRequest(request);
}

export async function PATCH(request: NextRequest) {
  return handleRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request);
}
