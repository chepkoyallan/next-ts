'use client';

import { useMemo } from 'react';

import { useConfig } from './use-config';
import type { CustomRole } from '../types';

// Hook to work with custom roles
// ----------------------------------------------------------------------

/**
 * Get a role by ID
 */
export function useRole(roleId: string): CustomRole | undefined {
  const { config } = useConfig();
  return useMemo(
    () => config.customRoles?.find((role) => role.id === roleId),
    [config.customRoles, roleId]
  );
}

/**
 * Get all permissions for a role (including inherited)
 */
export function useRolePermissions(roleId: string): string[] {
  const { config } = useConfig();

  return useMemo(() => {
    const role = config.customRoles?.find((r) => r.id === roleId);
    if (!role) return [];

    const getAllPermissions = (r: CustomRole, visited = new Set<string>()): Set<string> => {
      // Prevent circular inheritance
      if (visited.has(r.id)) return new Set();
      visited.add(r.id);

      const perms = new Set(r.permissions);

      // Add inherited permissions
      if (r.inheritsFrom) {
        r.inheritsFrom.forEach((parentId) => {
          const parent = config.customRoles?.find((pr) => pr.id === parentId);
          if (parent) {
            const parentPerms = getAllPermissions(parent, new Set(visited));
            parentPerms.forEach((p) => perms.add(p));
          }
        });
      }

      return perms;
    };

    return Array.from(getAllPermissions(role));
  }, [config.customRoles, roleId]);
}

/**
 * Check if user has specific permission
 */
export function useHasPermission(userRoles: string[], permission: string): boolean {
  const { config } = useConfig();

  return useMemo(() => {
    if (!userRoles || userRoles.length === 0) return false;

    // Check each role
    for (const roleId of userRoles) {
      const role = config.customRoles?.find((r) => r.id === roleId);
      if (!role) continue;

      // Get all permissions including inherited
      const getAllPermissions = (r: CustomRole, visited = new Set<string>()): Set<string> => {
        if (visited.has(r.id)) return new Set();
        visited.add(r.id);

        const perms = new Set(r.permissions);

        if (r.inheritsFrom) {
          r.inheritsFrom.forEach((parentId) => {
            const parent = config.customRoles?.find((pr) => pr.id === parentId);
            if (parent) {
              const parentPerms = getAllPermissions(parent, new Set(visited));
              parentPerms.forEach((p) => perms.add(p));
            }
          });
        }

        return perms;
      };

      const permissions = getAllPermissions(role);

      // Check for wildcard or exact match
      if (permissions.has('*') || permissions.has(permission)) {
        return true;
      }

      // Check for pattern match (e.g., 'users:*' matches 'users:read')
      for (const perm of permissions) {
        if (perm.endsWith(':*')) {
          const prefix = perm.slice(0, -2);
          if (permission.startsWith(prefix + ':')) {
            return true;
          }
        }
      }
    }

    return false;
  }, [config.customRoles, userRoles, permission]);
}

/**
 * Check if user has ANY of the specified permissions
 */
export function useHasAnyPermission(userRoles: string[], permissions: string[]): boolean {
  const { config } = useConfig();

  return useMemo(() => {
    if (!userRoles || userRoles.length === 0) return false;
    if (!permissions || permissions.length === 0) return true;

    return permissions.some((permission) => {
      for (const roleId of userRoles) {
        const role = config.customRoles?.find((r) => r.id === roleId);
        if (!role) continue;

        const getAllPermissions = (r: CustomRole, visited = new Set<string>()): Set<string> => {
          if (visited.has(r.id)) return new Set();
          visited.add(r.id);

          const perms = new Set(r.permissions);

          if (r.inheritsFrom) {
            r.inheritsFrom.forEach((parentId) => {
              const parent = config.customRoles?.find((pr) => pr.id === parentId);
              if (parent) {
                const parentPerms = getAllPermissions(parent, new Set(visited));
                parentPerms.forEach((p) => perms.add(p));
              }
            });
          }

          return perms;
        };

        const rolePermissions = getAllPermissions(role);

        if (rolePermissions.has('*') || rolePermissions.has(permission)) {
          return true;
        }

        for (const perm of rolePermissions) {
          if (perm.endsWith(':*')) {
            const prefix = perm.slice(0, -2);
            if (permission.startsWith(prefix + ':')) {
              return true;
            }
          }
        }
      }
      return false;
    });
  }, [config.customRoles, userRoles, permissions]);
}

/**
 * Check if user has ALL of the specified permissions
 */
export function useHasAllPermissions(userRoles: string[], permissions: string[]): boolean {
  const { config } = useConfig();

  return useMemo(() => {
    if (!userRoles || userRoles.length === 0) return false;
    if (!permissions || permissions.length === 0) return true;

    return permissions.every((permission) => {
      for (const roleId of userRoles) {
        const role = config.customRoles?.find((r) => r.id === roleId);
        if (!role) continue;

        const getAllPermissions = (r: CustomRole, visited = new Set<string>()): Set<string> => {
          if (visited.has(r.id)) return new Set();
          visited.add(r.id);

          const perms = new Set(r.permissions);

          if (r.inheritsFrom) {
            r.inheritsFrom.forEach((parentId) => {
              const parent = config.customRoles?.find((pr) => pr.id === parentId);
              if (parent) {
                const parentPerms = getAllPermissions(parent, new Set(visited));
                parentPerms.forEach((p) => perms.add(p));
              }
            });
          }

          return perms;
        };

        const rolePermissions = getAllPermissions(role);

        if (rolePermissions.has('*') || rolePermissions.has(permission)) {
          return true;
        }

        for (const perm of rolePermissions) {
          if (perm.endsWith(':*')) {
            const prefix = perm.slice(0, -2);
            if (permission.startsWith(prefix + ':')) {
              return true;
            }
          }
        }
      }
      return false;
    });
  }, [config.customRoles, userRoles, permissions]);
}

/**
 * Get highest priority role from user's roles
 */
export function useHighestPriorityRole(userRoles: string[]): CustomRole | undefined {
  const { config } = useConfig();

  return useMemo(() => {
    if (!userRoles || userRoles.length === 0) return undefined;

    const roles = userRoles
      .map((roleId) => config.customRoles?.find((r) => r.id === roleId))
      .filter((role): role is CustomRole => role !== undefined);

    if (roles.length === 0) return undefined;

    return roles.reduce((highest, current) =>
      (current.priority || 0) > (highest.priority || 0) ? current : highest
    );
  }, [config.customRoles, userRoles]);
}
