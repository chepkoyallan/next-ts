// Base API handler with middleware composition
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { rateLimit } from '../middleware/rate-limit';
import { ApiHandler, AuthContext, RequestContext } from '../types/api';
import { withLogging, createRequestContext } from '../middleware/logger';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { validateQueryParams, validateRouteParams } from '../utils/validation';
import { handleApiError, createMethodNotAllowedResponse } from '../utils/response';

export interface HandlerConfig {
  auth?: {
    required: boolean;
    permissions?: string[];
    roles?: string[];
  };
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  validation?: {
    body?: z.ZodSchema;
    query?: z.ZodSchema;
    params?: z.ZodSchema;
  };
  allowedMethods?: string[];
}

export interface HandlerContext {
  request: NextRequest;
  context: RequestContext;
  auth: AuthContext;
  params?: Record<string, string>;
  body?: any;
  query?: any;
  routeParams?: any;
}

/**
 * Base API handler with comprehensive middleware
 */
export function createApiHandler(
  config: HandlerConfig,
  handlers: Partial<Record<string, (ctx: HandlerContext) => Promise<NextResponse>>>
): ApiHandler {
  return withLogging(
    async (request: NextRequest, routeContext?: { params?: Record<string, string> }) => {
      const context = createRequestContext(request);

      try {
        // Check allowed methods
        if (config.allowedMethods && !config.allowedMethods.includes(request.method)) {
          return createMethodNotAllowedResponse(config.allowedMethods, context.requestId);
        }

        // Apply rate limiting
        if (config.rateLimit) {
          const rateLimitResponse = await rateLimit(config.rateLimit)(request);
          if (rateLimitResponse) {
            return rateLimitResponse;
          }
        }

        // Handle authentication
        let auth: AuthContext = { isAuthenticated: false };
        if (config.auth?.required) {
          const authResult = await authMiddleware(request, config.auth.permissions);
          if (authResult instanceof NextResponse) {
            return authResult;
          }
          auth = {
            user: authResult.user,
            token: authResult.token,
            isAuthenticated: true,
          };
        } else {
          auth = await optionalAuthMiddleware(request);
        }

        // Validate request data
        let body;
        let query;
        let routeParams;

        // Parse body for POST, PUT, PATCH requests
        if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
          try {
            body = await request.json();
          } catch (error) {
            // If JSON parsing fails, body remains undefined
            console.warn('Failed to parse request body as JSON:', error);
          }
        }

        if (config.validation?.query) {
          query = validateQueryParams(request, config.validation.query);
        }

        if (config.validation?.params && routeContext?.params) {
          routeParams = validateRouteParams(routeContext.params, config.validation.params);
        }

        // Create handler context
        const handlerContext: HandlerContext = {
          request,
          context,
          auth,
          params: routeContext?.params,
          body,
          query,
          routeParams,
        };

        // Execute the appropriate handler
        const handler = handlers[request.method];
        if (!handler) {
          return createMethodNotAllowedResponse(Object.keys(handlers), context.requestId);
        }

        return await handler(handlerContext);
      } catch (error) {
        return handleApiError(error, context.requestId);
      }
    }
  );
}

/**
 * Simple handler for single method endpoints
 */
export function createSingleMethodHandler(
  method: string,
  config: HandlerConfig,
  handler: (ctx: HandlerContext) => Promise<NextResponse>
): ApiHandler {
  return createApiHandler(
    {
      ...config,
      allowedMethods: [method],
    },
    {
      [method]: handler,
    }
  );
}

/**
 * CRUD handler factory
 */
export function createCrudHandler(config: {
  auth?: HandlerConfig['auth'];
  rateLimit?: HandlerConfig['rateLimit'];
  validation?: {
    create?: z.ZodSchema;
    update?: z.ZodSchema;
    query?: z.ZodSchema;
    params?: z.ZodSchema;
  };
  handlers: {
    list?: (ctx: HandlerContext) => Promise<NextResponse>;
    create?: (ctx: HandlerContext) => Promise<NextResponse>;
    get?: (ctx: HandlerContext) => Promise<NextResponse>;
    update?: (ctx: HandlerContext) => Promise<NextResponse>;
    delete?: (ctx: HandlerContext) => Promise<NextResponse>;
  };
}): ApiHandler {
  return createApiHandler(
    {
      auth: config.auth,
      rateLimit: config.rateLimit,
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      validation: {
        body: config.validation?.create, // Will be overridden per method
        query: config.validation?.query,
        params: config.validation?.params,
      },
    },
    {
      GET: async (ctx) => {
        if (ctx.params?.id) {
          return config.handlers.get?.(ctx) || createMethodNotAllowedResponse(['GET']);
        }
        return config.handlers.list?.(ctx) || createMethodNotAllowedResponse(['GET']);
      },
      POST: config.handlers.create || (async () => createMethodNotAllowedResponse(['POST'])),
      PUT: config.handlers.update || (async () => createMethodNotAllowedResponse(['PUT'])),
      DELETE: config.handlers.delete || (async () => createMethodNotAllowedResponse(['DELETE'])),
    }
  );
}

/**
 * Health check handler
 */
export const healthCheckHandler = createSingleMethodHandler(
  'GET',
  {
    allowedMethods: ['GET'],
    rateLimit: { windowMs: 60000, maxRequests: 100 },
  },
  async () => {
    const { createSuccessResponse } = await import('../utils/response');
    return createSuccessResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  }
);

/**
 * Metrics handler
 */
export const metricsHandler = createSingleMethodHandler(
  'GET',
  {
    auth: { required: true, permissions: ['admin'] },
    allowedMethods: ['GET'],
    rateLimit: { windowMs: 60000, maxRequests: 10 },
  },
  async () => {
    const { createSuccessResponse } = await import('../utils/response');
    const { PerformanceMonitor } = await import('../middleware/logger');

    return createSuccessResponse({
      performance: PerformanceMonitor.getMetrics(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    });
  }
);
