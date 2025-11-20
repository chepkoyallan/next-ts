// RBAC Middleware - Production-Ready Integration
import { NextRequest, NextResponse } from 'next/server';

import { isHeadlessMode } from '../../headless-mode';
import { PermissionChecker } from './permission-checker';
import { createErrorResponse } from '../../utils/response';

/**
 * RBAC Configuration for route handlers
 */
export interface RBACConfig {
  permissions?: Array<{
    resource: string;
    action: string;
  }>;
  roles?: string[];
  requireAll?: boolean; // If true, user must have ALL permissions/roles
  contextExtractor?: (request: NextRequest, params?: any) => Record<string, any>;
}

/**
 * Enhanced authentication middleware with RBAC
 */
export async function rbacMiddleware(
  request: NextRequest,
  config: RBACConfig,
  params?: any
): Promise<{ userId: string; allowed: boolean } | NextResponse> {
  try {
    // In headless mode, bypass RBAC and return mock superuser
    if (isHeadlessMode()) {
      return { userId: 'headless-user', allowed: true };
    }

    const userId = await extractUserIdFromRequest(request);
    console.log('[RBAC Middleware] Extracted userId:', userId);

    if (!userId) {
      return createErrorResponse('UNAUTHORIZED', { message: 'Authentication required' });
    }

    // Note: Context extraction via config.contextExtractor is available for future
    // contextual permission checks, but not yet implemented in the current RBAC logic.
    // To use it, call: const context = config.contextExtractor?.(request, params) ?? {};

    // Check role-based access if roles are specified
    if (config.roles && config.roles.length > 0) {
      const hasRole = await checkUserRoles(userId, config.roles, config.requireAll);
      if (!hasRole) {
        return createErrorResponse('FORBIDDEN', {
          message: 'Insufficient role permissions',
          requiredRoles: config.roles,
        });
      }
    }

    // Check permission-based access if permissions are specified
    if (config.permissions && config.permissions.length > 0) {
      const hasPermission = config.requireAll
        ? await PermissionChecker.hasAllPermissions(userId, config.permissions)
        : await PermissionChecker.hasAnyPermission(userId, config.permissions);

      if (!hasPermission) {
        return createErrorResponse('FORBIDDEN', {
          message: 'Insufficient permissions',
          requiredPermissions: config.permissions.map((p) => `${p.resource}:${p.action}`),
        });
      }
    }

    return { userId, allowed: true };
  } catch (error) {
    console.error('RBAC middleware error:', error);
    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'Access control error',
    });
  }
}

/**
 * Extract user ID from request (implement based on your auth system)
 */
async function extractUserIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // ✅ SECURITY: Read access token from HTTPOnly cookie first
    const { cookies } = await import('next/headers');
    const cookieStore = cookies();
    const accessToken = cookieStore.get('accessToken')?.value;

    // Fallback: Check Authorization header for API requests
    const authHeader = request.headers.get('authorization');
    const token =
      accessToken || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      return null;
    }

    // For JWT tokens (default auth method)
    if (process.env.AUTH_METHOD === 'jwt' || !process.env.AUTH_METHOD) {
      const { verify } = await import('jsonwebtoken');
      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        console.error('[RBAC] JWT_SECRET not configured');
        return null;
      }

      const decoded = verify(token, jwtSecret) as any;
      return decoded.userId || decoded.sub;
    }

    // For API keys, you might map keys to user IDs
    if (process.env.AUTH_METHOD === 'api_key') {
      // Implement API key to user ID mapping
      return await mapApiKeyToUserId(token);
    }

    // For OAuth2 tokens
    if (process.env.AUTH_METHOD === 'oauth2') {
      // Implement OAuth2 token introspection
      return await introspectOAuth2Token(token);
    }

    return null;
  } catch (error) {
    console.error('Error extracting user ID:', error);
    return null;
  }
}

/**
 * Check if user has required roles
 */
async function checkUserRoles(
  userId: string,
  requiredRoles: string[],
  requireAll: boolean = false
): Promise<boolean> {
  const { AccessControlEngine } = await import('./access-control');
  const context = await AccessControlEngine.buildRBACContext(userId);

  const userRoleIds = context.roles.map((role: any) => role.id);

  if (requireAll) {
    return requiredRoles.every((roleId) => userRoleIds.includes(roleId));
  }
  return requiredRoles.some((roleId) => userRoleIds.includes(roleId));
}

/**
 * API Key to User ID mapping (implement based on your system)
 */
async function mapApiKeyToUserId(apiKey: string): Promise<string | null> {
  // In production, this would query your database
  // For demo purposes, we'll use environment variables
  const keyMappings = process.env.API_KEY_USER_MAPPINGS;
  if (keyMappings) {
    const mappings = JSON.parse(keyMappings);
    return mappings[apiKey] || null;
  }

  // Default mapping for demo
  return `user_${apiKey.substring(0, 8)}`;
}

/**
 * OAuth2 token introspection (implement based on your OAuth2 provider)
 */
async function introspectOAuth2Token(token: string): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.OAUTH2_ISSUER_URL}/oauth/introspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.OAUTH2_CLIENT_ID}:${process.env.OAUTH2_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: `token=${token}`,
    });

    const result = await response.json();
    return result.active ? result.sub : null;
  } catch (error) {
    console.error('OAuth2 token introspection error:', error);
    return null;
  }
}

/**
 * Convenience decorators for common RBAC patterns
 */
export const RBACDecorators = {
  /**
   * Require specific permission
   */
  requirePermission: (resource: string, action: string) => ({
    permissions: [{ resource, action }],
  }),

  /**
   * Require any of the specified permissions
   */
  requireAnyPermission: (...permissions: Array<{ resource: string; action: string }>) => ({
    permissions,
    requireAll: false,
  }),

  /**
   * Require all specified permissions
   */
  requireAllPermissions: (...permissions: Array<{ resource: string; action: string }>) => ({
    permissions,
    requireAll: true,
  }),

  /**
   * Require specific role
   */
  requireRole: (...roles: string[]) => ({
    roles,
    requireAll: false,
  }),

  /**
   * Require all specified roles
   */
  requireAllRoles: (...roles: string[]) => ({
    roles,
    requireAll: true,
  }),

  /**
   * Admin only access
   */
  adminOnly: () => ({
    roles: ['system-admin', 'super-admin'],
    requireAll: false,
  }),

  /**
   * Project resource context extractor
   */
  projectContext: (request: NextRequest, params?: any) => ({
    projectId: params?.project || request.nextUrl.searchParams.get('project'),
    domain: params?.domain || request.nextUrl.searchParams.get('domain'),
  }),

  /**
   * Execution resource context extractor
   */
  executionContext: (request: NextRequest, params?: any) => {
    const executionId = params?.id;
    if (executionId) {
      const [project, domain, name] = executionId.split(':');
      return { projectId: project, domain, executionName: name };
    }
    return {};
  },
};

/**
 * Higher-order function to create RBAC-protected route handlers
 */
export function withRBAC<T extends any[]>(
  config: RBACConfig,
  handler: (
    request: NextRequest,
    context: { params?: any; userId: string },
    ...args: T
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context: { params?: any },
    ...args: T
  ): Promise<NextResponse> => {
    const rbacResult = await rbacMiddleware(request, config, context.params);

    if (rbacResult instanceof NextResponse) {
      return rbacResult;
    }

    return handler(request, { ...context, userId: rbacResult.userId }, ...args);
  };
}

/**
 * RBAC configuration presets for common use cases
 */
export const RBACPresets = {
  // Read-only access
  READ_ONLY: {
    roles: ['viewer', 'developer', 'operator', 'project-admin', 'system-admin', 'super-admin'],
  },

  // Developer access
  DEVELOPER: {
    roles: ['developer', 'operator', 'project-admin', 'system-admin', 'super-admin'],
  },

  // Operator access
  OPERATOR: {
    roles: ['operator', 'project-admin', 'system-admin', 'super-admin'],
  },

  // Admin access
  ADMIN: {
    roles: ['project-admin', 'system-admin', 'super-admin'],
  },

  // System admin access
  SYSTEM_ADMIN: {
    roles: ['system-admin', 'super-admin'],
  },

  // Super admin only
  SUPER_ADMIN: {
    roles: ['super-admin'],
  },
};
