/**
 * Admin Middleware
 * Protects admin routes and enforces role-based access
 */

import { NextRequest, NextResponse } from 'next/server';

import { verifyToken } from './jwt-utils';
import { isHeadlessMode, HEADLESS_MOCK_ADMIN } from '../headless-mode';

export type AdminAccessLevel = 'super-admin' | 'system-admin' | 'project-admin';

export interface AdminMiddlewareOptions {
  requiredRole?: AdminAccessLevel;
  auditLog?: boolean;
}

export interface AdminContext {
  userId: string;
  email: string;
  roles: string[];
  organizationId?: string;
  isSuperAdmin: boolean;
  isSystemAdmin: boolean;
  isAdmin: boolean;
}

/**
 * Middleware to protect admin routes
 */
export async function requireAdmin(
  request: NextRequest,
  options: AdminMiddlewareOptions = {}
): Promise<AdminContext | NextResponse> {
  try {
    // In headless mode, bypass admin checks and return mock superuser
    if (isHeadlessMode()) {
      return HEADLESS_MOCK_ADMIN as AdminContext;
    }

    // 1. Extract and verify JWT token
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }

    // 2. Get user and check admin roles
    const { prisma } = await import('src/lib/prisma');

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        organizationMembers: {
          take: 1,
          where: { isActive: true },
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // 3. Extract roles
    const roles = user.userRoles.map((ur) => ur.role.name);
    const isSuperAdmin = roles.includes('super-admin');
    const isSystemAdmin = roles.includes('system-admin');
    const isProjectAdmin = roles.includes('project-admin');
    const isAdmin = isSuperAdmin || isSystemAdmin || isProjectAdmin;

    // 4. Check if user has any admin role
    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin access required',
          code: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // 5. Check specific role requirement
    if (options.requiredRole) {
      const hasRequiredRole = checkRoleRequirement(roles, options.requiredRole);

      if (!hasRequiredRole) {
        return NextResponse.json(
          {
            success: false,
            error: `${options.requiredRole} role required`,
            code: 'INSUFFICIENT_PERMISSIONS',
          },
          { status: 403 }
        );
      }
    }

    // 6. Create admin context
    const adminContext: AdminContext = {
      userId: user.id,
      email: user.email,
      roles,
      organizationId: user.organizationMembers[0]?.organization?.id,
      isSuperAdmin,
      isSystemAdmin: isSystemAdmin || isSuperAdmin,
      isAdmin,
    };

    // 7. Audit log (if enabled)
    if (options.auditLog) {
      await logAdminAccess(request, adminContext);
    }

    return adminContext;
  } catch (error) {
    console.error('Admin middleware error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract JWT token from request
 */
function extractToken(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  const cookieToken = request.cookies.get('accessToken')?.value;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * Check if user has required role
 */
function checkRoleRequirement(userRoles: string[], requiredRole: AdminAccessLevel): boolean {
  // Super admin can access everything
  if (userRoles.includes('super-admin')) {
    return true;
  }

  // System admin can access system-admin and project-admin routes
  if (requiredRole === 'system-admin' || requiredRole === 'project-admin') {
    if (userRoles.includes('system-admin')) {
      return true;
    }
  }

  // Project admin can only access project-admin routes
  if (requiredRole === 'project-admin') {
    if (userRoles.includes('project-admin')) {
      return true;
    }
  }

  // Check exact match
  return userRoles.includes(requiredRole);
}

/**
 * Log admin access for audit trail
 */
async function logAdminAccess(request: NextRequest, context: AdminContext): Promise<void> {
  try {
    const { logAuditEvent } = await import('../services/audit-service');

    await logAuditEvent({
      userId: context.userId,
      action: 'admin_access',
      resource: 'admin',
      resourceId: request.nextUrl.pathname,
      projectId: null, // Admin actions are not tied to a specific project
      details: {
        method: request.method,
        path: request.nextUrl.pathname,
        roles: context.roles,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Failed to log admin access:', error);
  }
}

/**
 * Helper to check if user can access organization
 */
export async function canAccessOrganization(
  adminContext: AdminContext,
  targetOrgId: string
): Promise<boolean> {
  // Super admin and system admin can access any organization
  if (adminContext.isSuperAdmin || adminContext.isSystemAdmin) {
    return true;
  }

  // Project admin can only access their own organization
  return adminContext.organizationId === targetOrgId;
}

/**
 * Helper to get accessible organizations for admin
 */
export async function getAccessibleOrganizations(adminContext: AdminContext): Promise<string[]> {
  // Super admin and system admin can access all organizations
  if (adminContext.isSuperAdmin || adminContext.isSystemAdmin) {
    const { prisma } = await import('src/lib/prisma');
    const orgs = await prisma.organization.findMany({
      select: { id: true },
    });
    return orgs.map((o) => o.id);
  }

  // Project admin can only access their organization
  return adminContext.organizationId ? [adminContext.organizationId] : [];
}
