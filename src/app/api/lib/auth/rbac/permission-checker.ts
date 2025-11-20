// Permission Checker Utilities
import { SYSTEM_ROLES } from './roles';
import { Role, Permission } from './types';
import { PERMISSIONS } from './permissions';

// Simple in-memory cache for user roles (TTL: 5 minutes)
const roleCache = new Map<string, { roles: Role[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Permission checker utility functions
 */
export class PermissionChecker {
  /**
   * Quick permission check
   */
  static async hasPermission(
    userId: string,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId);
    const userPermissions = this.aggregatePermissions(userRoles);
    const requiredPermission = `${resource}:${action}`;

    return (
      userPermissions.some((p) => p.id === requiredPermission) ||
      userPermissions.some((p) => p.id === `${resource}:manage`) ||
      userPermissions.some((p) => p.id === 'system:admin')
    );
  }

  /**
   * Check multiple permissions at once
   */
  static async hasAnyPermission(
    userId: string,
    permissions: Array<{ resource: string; action: string }>
  ): Promise<boolean> {
    const checks = await Promise.all(
      permissions.map((p) => this.hasPermission(userId, p.resource, p.action))
    );

    return checks.some((allowed) => allowed);
  }

  /**
   * Check if user has all required permissions
   */
  static async hasAllPermissions(
    userId: string,
    permissions: Array<{ resource: string; action: string }>
  ): Promise<boolean> {
    const checks = await Promise.all(
      permissions.map((p) => this.hasPermission(userId, p.resource, p.action))
    );

    return checks.every((allowed) => allowed);
  }

  /**
   * Get user's effective permissions
   */
  static async getUserPermissions(userId: string): Promise<Permission[]> {
    const userRoles = await this.getUserRoles(userId);
    return this.aggregatePermissions(userRoles);
  }

  /**
   * Check if user can manage another user (based on role hierarchy)
   */
  static async canManageUser(managerId: string, targetUserId: string): Promise<boolean> {
    const managerRoles = await this.getUserRoles(managerId);
    const targetRoles = await this.getUserRoles(targetUserId);

    const managerHighestRole = managerRoles.reduce((highest: Role, current: Role) =>
      current.hierarchy > highest.hierarchy ? current : highest
    );

    const targetHighestRole = targetRoles.reduce((highest: Role, current: Role) =>
      current.hierarchy > highest.hierarchy ? current : highest
    );

    return managerHighestRole.hierarchy > targetHighestRole.hierarchy;
  }

  /**
   * Get user roles from database (shared utility, used by both PermissionChecker and AccessControlEngine)
   */
  static async getUserRoles(userId: string): Promise<Role[]> {
    // Check cache first
    const cached = roleCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.roles;
    }

    console.log('[PermissionChecker] Getting roles for user:', userId);

    try {
      // Import prisma client directly to avoid circular dependency
      const { prisma } = await import('src/lib/prisma');

      // Query user roles from database
      const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

      console.log('[PermissionChecker] Found user roles from DB:', userRoles.length);

      // Convert database roles to RBAC Role format
      const roles: Role[] = userRoles.map((ur) => {
        const dbRole = ur.role;
        const permissions = dbRole.rolePermissions.map(
          (rp) => `${rp.permission.resource}:${rp.permission.action}`
        );

        return {
          id: dbRole.name,
          name: dbRole.name,
          description: dbRole.description || '',
          permissions,
          hierarchy: dbRole.hierarchy,
          isSystemRole: dbRole.isSystemRole,
          createdAt: dbRole.createdAt,
          updatedAt: dbRole.updatedAt,
        };
      });

      // If user has no roles, return viewer role as fallback
      if (roles.length === 0) {
        console.log('[PermissionChecker] No roles found for user, using fallback');
        const defaultRole = process.env.DEFAULT_USER_ROLE || 'viewer';
        const fallbackRoles = [SYSTEM_ROLES[defaultRole] || SYSTEM_ROLES.viewer];
        roleCache.set(userId, { roles: fallbackRoles, timestamp: Date.now() });
        return fallbackRoles;
      }

      console.log(
        '[PermissionChecker] Returning roles:',
        roles.map((r) => r.name)
      );

      // Cache the result
      roleCache.set(userId, { roles, timestamp: Date.now() });

      return roles;
    } catch (error) {
      console.error('[PermissionChecker] Error loading roles from database:', error);

      // Fallback to environment variables only on error
      const defaultRole = process.env.DEFAULT_USER_ROLE || 'viewer';
      const adminUsers = process.env.ADMIN_USERS?.split(',') || [];
      const developerUsers = process.env.DEVELOPER_USERS?.split(',') || [];

      if (adminUsers.includes(userId)) {
        return [SYSTEM_ROLES['system-admin']];
      }

      if (developerUsers.includes(userId)) {
        return [SYSTEM_ROLES.developer];
      }

      return [SYSTEM_ROLES[defaultRole] || SYSTEM_ROLES.viewer];
    }
  }

  /**
   * Aggregate permissions from all user roles
   */
  private static aggregatePermissions(roles: Role[]): Permission[] {
    const permissionIds = new Set<string>();

    roles.forEach((role) => {
      role.permissions.forEach((permissionId) => {
        permissionIds.add(permissionId);
      });
    });

    return Array.from(permissionIds)
      .map((id) => PERMISSIONS[id])
      .filter(Boolean);
  }
}
