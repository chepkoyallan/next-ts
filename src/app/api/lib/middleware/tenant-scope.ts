// Tenant-scoped Permission Middleware
import { verify } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

import { PermissionChecker } from '../auth/rbac/permission-checker';
import { OrganizationService } from '../services/organization-service';
import { isHeadlessMode, HEADLESS_MOCK_CONTEXT } from '../headless-mode';

/**
 * Extract organization ID from request
 * Checks multiple sources: header, query param, route param, body
 */
export function extractOrganizationId(
  request: NextRequest,
  routeParams?: Record<string, string>,
  body?: any
): string | null {
  // 1. Check X-Organization-ID header (preferred)
  const headerOrgId = request.headers.get('x-organization-id');
  if (headerOrgId) return headerOrgId;

  // 2. Check query parameter
  const url = new URL(request.url);
  const queryOrgId = url.searchParams.get('organizationId');
  if (queryOrgId) return queryOrgId;

  // 3. Check route params (for /api/v1/organizations/:id/...)
  if (routeParams?.id) return routeParams.id;
  if (routeParams?.organizationId) return routeParams.organizationId;

  // 4. Check request body
  if (body?.organizationId) return body.organizationId;

  return null;
}

/**
 * Tenant scope options
 */
export interface TenantScopeOptions {
  required?: boolean; // Whether organization ID is required
  allowSystemAdmin?: boolean; // Whether system admins bypass tenant checks
  minRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'; // Minimum role required
  permissions?: string[]; // Additional platform-level permissions required
}

/**
 * Result of tenant scope check
 */
export interface TenantScopeResult {
  allowed: boolean;
  organizationId: string | null;
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | null;
  userId: string;
  isSystemAdmin: boolean;
  error?: {
    code: string;
    message: string;
    status: number;
  };
}

/**
 * Check tenant-scoped permissions
 */
export async function checkTenantScope(
  request: NextRequest,
  options: TenantScopeOptions = {},
  routeParams?: Record<string, string>,
  body?: any
): Promise<TenantScopeResult> {
  const {
    required = false,
    allowSystemAdmin = true,
    minRole = 'VIEWER',
    permissions = [],
  } = options;

  // 1. Extract and verify JWT (from Authorization header OR cookie)
  let token: string | undefined;

  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // If no Authorization header, try cookie
  if (!token) {
    const { cookies } = request;
    token = cookies.get('accessToken')?.value || cookies.get('auth-token')?.value;
  }

  if (!token) {
    return {
      allowed: false,
      organizationId: null,
      userRole: null,
      userId: '',
      isSystemAdmin: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        status: 401,
      },
    };
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return {
      allowed: false,
      organizationId: null,
      userRole: null,
      userId: '',
      isSystemAdmin: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server configuration error',
        status: 500,
      },
    };
  }

  let decoded: any;
  try {
    decoded = verify(token, jwtSecret);
  } catch {
    return {
      allowed: false,
      organizationId: null,
      userRole: null,
      userId: '',
      isSystemAdmin: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
        status: 401,
      },
    };
  }

  const userId = decoded.userId || decoded.id;
  const userRoles = decoded.roles || [decoded.role] || [];

  // 2. Check if user is system admin
  const isSystemAdmin = userRoles.some((role: string) =>
    ['super-admin', 'system-admin'].includes(role)
  );

  // 3. Check platform-level permissions if specified
  if (permissions.length > 0) {
    const hasPermissions = await Promise.all(
      permissions.map((permission) => {
        const [resource, action] = permission.split(':');
        return PermissionChecker.hasPermission(userId, resource, action);
      })
    );

    if (!hasPermissions.every((allowed) => allowed)) {
      return {
        allowed: false,
        organizationId: null,
        userRole: null,
        userId,
        isSystemAdmin,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient platform permissions',
          status: 403,
        },
      };
    }
  }

  // 4. Extract organization ID
  const organizationId = extractOrganizationId(request, routeParams, body);

  // 5. If organization ID not provided
  if (!organizationId) {
    if (required && !isSystemAdmin) {
      return {
        allowed: false,
        organizationId: null,
        userRole: null,
        userId,
        isSystemAdmin,
        error: {
          code: 'BAD_REQUEST',
          message: 'Organization ID is required',
          status: 400,
        },
      };
    }

    // If not required or user is system admin, allow
    return {
      allowed: true,
      organizationId: null,
      userRole: null,
      userId,
      isSystemAdmin,
    };
  }

  // 6. System admins bypass organization checks if allowed
  if (isSystemAdmin && allowSystemAdmin) {
    return {
      allowed: true,
      organizationId,
      userRole: null, // System admins don't have org role
      userId,
      isSystemAdmin: true,
    };
  }

  // 7. Check if user is member of organization
  const isMember = await OrganizationService.isMember(userId, organizationId);
  if (!isMember) {
    return {
      allowed: false,
      organizationId,
      userRole: null,
      userId,
      isSystemAdmin,
      error: {
        code: 'FORBIDDEN',
        message: 'You are not a member of this organization',
        status: 403,
      },
    };
  }

  // 8. Get user's role in organization
  const userRole = await OrganizationService.getUserRole(userId, organizationId);
  if (!userRole) {
    return {
      allowed: false,
      organizationId,
      userRole: null,
      userId,
      isSystemAdmin,
      error: {
        code: 'FORBIDDEN',
        message: 'Unable to determine organization role',
        status: 403,
      },
    };
  }

  // 9. Check role hierarchy
  const roleHierarchy = {
    OWNER: 4,
    ADMIN: 3,
    MEMBER: 2,
    VIEWER: 1,
  };

  const userRoleLevel = roleHierarchy[userRole];
  const minRoleLevel = roleHierarchy[minRole];

  if (userRoleLevel < minRoleLevel) {
    return {
      allowed: false,
      organizationId,
      userRole,
      userId,
      isSystemAdmin,
      error: {
        code: 'FORBIDDEN',
        message: `Minimum role required: ${minRole}`,
        status: 403,
      },
    };
  }

  // 10. All checks passed
  return {
    allowed: true,
    organizationId,
    userRole,
    userId,
    isSystemAdmin,
  };
}

/**
 * Middleware wrapper for tenant-scoped routes
 */
export function withTenantScope(
  handler: (
    request: NextRequest,
    context: { params: Record<string, string>; tenantScope: TenantScopeResult }
  ) => Promise<NextResponse>,
  options: TenantScopeOptions = {}
) {
  return async (request: NextRequest, context: { params: Record<string, string> }) => {
    // Parse body if present
    let body: any = null;
    if (request.method !== 'GET' && request.method !== 'DELETE') {
      try {
        body = await request.json();
      } catch {
        // Body might not be JSON or might be empty
      }
    }

    // Check tenant scope
    const tenantScope = await checkTenantScope(request, options, context.params, body);

    // If not allowed, return error response
    if (!tenantScope.allowed && tenantScope.error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: tenantScope.error.code,
            message: tenantScope.error.message,
          },
        },
        { status: tenantScope.error.status }
      );
    }

    // Call handler with tenant scope context
    return handler(request, { params: context.params, tenantScope });
  };
}

/**
 * Helper to add organization ID to response headers
 */
export function addOrganizationHeaders(
  response: NextResponse,
  organizationId: string
): NextResponse {
  response.headers.set('X-Organization-ID', organizationId);
  return response;
}

/**
 * Get organization context from request (simplified helper)
 * Returns organization ID and user ID for multi-tenant operations
 *
 * For superadmins:
 * - If organizationId is provided in request, use that organization
 * - If not provided, use the superadmin's own organization
 */
export async function getOrganizationContext(
  request: NextRequest
): Promise<{ organizationId: string; userId: string; isSuperAdmin?: boolean }> {
  // In headless mode, bypass authentication and return mock context
  if (isHeadlessMode()) {
    return {
      organizationId: HEADLESS_MOCK_CONTEXT.organizationId,
      userId: HEADLESS_MOCK_CONTEXT.userId,
    };
  }

  const result = await checkTenantScope(request, {
    required: true,
    allowSystemAdmin: true, // Allow superadmins to access
  });

  if (!result.allowed || result.error) {
    throw new Error('Authentication or organization scope required');
  }

  // If user is superadmin and no organization ID was provided, get their organization
  if (result.isSystemAdmin && !result.organizationId) {
    // Get superadmin's organization from database
    const { prisma } = await import('src/lib/prisma');
    const userOrg = await prisma.organizationMember.findFirst({
      where: {
        userId: result.userId,
        isActive: true,
      },
      select: {
        organizationId: true,
      },
    });

    if (!userOrg) {
      throw new Error('Superadmin must belong to an organization');
    }

    return {
      organizationId: userOrg.organizationId,
      userId: result.userId,
      isSuperAdmin: true,
    };
  }

  return {
    organizationId: result.organizationId!,
    userId: result.userId!,
    isSuperAdmin: result.isSystemAdmin,
  };
}

/**
 * Get BMaaS context from request
 * Special handler for BMaaS endpoints that allows superadmins to access all organizations
 *
 * Returns:
 * - For superadmins: organizationId = null (meaning access all orgs) or specific orgId if provided
 * - For regular users: their organization ID
 */
export async function getBmaasContext(request: NextRequest): Promise<{
  organizationId: string | null;
  userId: string;
  isSuperAdmin: boolean;
}> {
  // In headless mode, bypass authentication and return mock context
  if (isHeadlessMode()) {
    return {
      organizationId: HEADLESS_MOCK_CONTEXT.organizationId,
      userId: HEADLESS_MOCK_CONTEXT.userId,
      isSuperAdmin: true,
    };
  }

  const result = await checkTenantScope(request, {
    required: false, // Don't require org ID for superadmins
    allowSystemAdmin: true,
  });

  if (!result.allowed || result.error) {
    throw new Error('Authentication required');
  }

  // Superadmins can access all organizations
  if (result.isSystemAdmin) {
    // If organization ID is explicitly provided (e.g., for specific resource creation),
    // use it. Otherwise, return null to indicate "all organizations"
    const explicitOrgId = extractOrganizationId(request);

    return {
      organizationId: explicitOrgId,
      userId: result.userId,
      isSuperAdmin: true,
    };
  }

  // Regular users must have an organization
  if (!result.organizationId) {
    throw new Error('Organization context required');
  }

  return {
    organizationId: result.organizationId,
    userId: result.userId,
    isSuperAdmin: false,
  };
}
