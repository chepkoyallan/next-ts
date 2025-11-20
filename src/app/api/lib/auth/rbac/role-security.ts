/**
 * Role-Based Access Control Security Utilities
 * Enhanced security validation and constraints for role management
 */

import { SYSTEM_ROLES } from './roles';
import type { AdminContext } from '../admin-middleware';

// ----------------------------------------------------------------------

export interface RoleSecurityCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if admin can manage a specific role based on hierarchy
 */
export function canManageRole(
  adminContext: AdminContext,
  targetRoleHierarchy: number
): RoleSecurityCheck {
  const adminMaxHierarchy = Math.max(
    ...adminContext.roles.map((r) => SYSTEM_ROLES[r]?.hierarchy || 0)
  );

  if (targetRoleHierarchy >= adminMaxHierarchy) {
    return {
      allowed: false,
      reason: `Cannot manage roles with hierarchy ${targetRoleHierarchy} or higher. Your max hierarchy: ${adminMaxHierarchy}`,
    };
  }

  return { allowed: true };
}

/**
 * Check if admin can assign a specific role to users
 */
export function canAssignRole(
  adminContext: AdminContext,
  roleHierarchy: number,
  isSystemRole: boolean
): RoleSecurityCheck {
  // Check hierarchy first
  const hierarchyCheck = canManageRole(adminContext, roleHierarchy);
  if (!hierarchyCheck.allowed) {
    return hierarchyCheck;
  }

  // System roles can only be assigned by super-admin
  if (isSystemRole && !adminContext.roles.includes('super-admin')) {
    return {
      allowed: false,
      reason: 'Only super-admin can assign system roles',
    };
  }

  return { allowed: true };
}

/**
 * Check if admin can modify role permissions
 */
export function canModifyRolePermissions(
  adminContext: AdminContext,
  roleHierarchy: number,
  isSystemRole: boolean
): RoleSecurityCheck {
  // System roles cannot be modified
  if (isSystemRole) {
    return {
      allowed: false,
      reason: 'System role permissions cannot be modified',
    };
  }

  // Check hierarchy
  return canManageRole(adminContext, roleHierarchy);
}

/**
 * Check if admin can delete a role
 */
export function canDeleteRole(
  adminContext: AdminContext,
  roleHierarchy: number,
  isSystemRole: boolean,
  userCount: number
): RoleSecurityCheck {
  // System roles cannot be deleted
  if (isSystemRole) {
    return {
      allowed: false,
      reason: 'System roles cannot be deleted',
    };
  }

  // Roles with active users cannot be deleted
  if (userCount > 0) {
    return {
      allowed: false,
      reason: `Cannot delete role with ${userCount} active user(s). Please reassign users first.`,
    };
  }

  // Only super-admin can delete roles
  if (!adminContext.roles.includes('super-admin')) {
    return {
      allowed: false,
      reason: 'Only super-admin can delete roles',
    };
  }

  // Check hierarchy
  return canManageRole(adminContext, roleHierarchy);
}

/**
 * Check if admin can create role with specific hierarchy
 */
export function canCreateRoleWithHierarchy(
  adminContext: AdminContext,
  hierarchy: number
): RoleSecurityCheck {
  const adminMaxHierarchy = Math.max(
    ...adminContext.roles.map((r) => SYSTEM_ROLES[r]?.hierarchy || 0)
  );

  if (hierarchy >= adminMaxHierarchy) {
    return {
      allowed: false,
      reason: `Cannot create roles with hierarchy ${hierarchy} or higher. Your max hierarchy: ${adminMaxHierarchy}`,
    };
  }

  // Only system-admin and above can create roles
  if (adminMaxHierarchy < 5) {
    return {
      allowed: false,
      reason: 'Minimum system-admin role required to create custom roles',
    };
  }

  return { allowed: true };
}

/**
 * Validate role hierarchy constraints
 */
export function validateHierarchyChange(
  currentHierarchy: number,
  newHierarchy: number,
  adminMaxHierarchy: number
): RoleSecurityCheck {
  if (newHierarchy >= adminMaxHierarchy) {
    return {
      allowed: false,
      reason: `Cannot set hierarchy to ${newHierarchy}. Must be below your level: ${adminMaxHierarchy}`,
    };
  }

  // Prevent hierarchy escalation without proper permissions
  if (newHierarchy > currentHierarchy && adminMaxHierarchy <= newHierarchy) {
    return {
      allowed: false,
      reason: 'Cannot escalate role hierarchy above your own level',
    };
  }

  return { allowed: true };
}

/**
 * Check if user can be assigned multiple roles (role conflict detection)
 */
export function checkRoleConflicts(
  existingRoles: Array<{ hierarchy: number; name: string }>,
  newRole: { hierarchy: number; name: string }
): RoleSecurityCheck {
  // Check if user already has this role
  if (existingRoles.some((r) => r.name === newRole.name)) {
    return {
      allowed: false,
      reason: `User already has role: ${newRole.name}`,
    };
  }

  // Check for hierarchy conflicts (e.g., can't have both super-admin and viewer)
  const hasHigherRole = existingRoles.some((r) => r.hierarchy > newRole.hierarchy + 2);
  const hasLowerRole = existingRoles.some((r) => r.hierarchy < newRole.hierarchy - 2);

  if (hasHigherRole && hasLowerRole) {
    return {
      allowed: true,
      reason: 'Warning: User has roles with very different hierarchy levels',
    };
  }

  return { allowed: true };
}

/**
 * Rate limiting check for role operations
 */
export interface RateLimitCheck {
  allowed: boolean;
  retryAfter?: number;
  reason?: string;
}

const roleOperationTimestamps = new Map<string, number[]>();

export function checkRateLimit(
  userId: string,
  operation: string,
  maxOperations: number = 10,
  windowMs: number = 60000
): RateLimitCheck {
  // Check if rate limiting is enabled
  if (process.env.ROLE_RATE_LIMIT_ENABLED === 'false') {
    return { allowed: true };
  }

  const key = `${userId}:${operation}`;
  const now = Date.now();
  const timestamps = roleOperationTimestamps.get(key) || [];

  // Remove expired timestamps
  const validTimestamps = timestamps.filter((ts) => now - ts < windowMs);

  if (validTimestamps.length >= maxOperations) {
    const oldestTimestamp = Math.min(...validTimestamps);
    const retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    return {
      allowed: false,
      retryAfter,
      reason: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
    };
  }

  // Update timestamps
  validTimestamps.push(now);
  roleOperationTimestamps.set(key, validTimestamps);

  return { allowed: true };
}

/**
 * Audit trail data for role operations
 */
export interface RoleAuditData {
  operation: string;
  adminId: string;
  adminEmail: string;
  targetRoleId?: string;
  targetRoleName?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  changes?: Record<string, any>;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Format audit log entry for role operations
 */
export function formatRoleAuditLog(data: RoleAuditData): Record<string, any> {
  return {
    timestamp: new Date().toISOString(),
    category: 'role_management',
    severity:
      data.operation.includes('delete') || data.operation.includes('revoke') ? 'high' : 'medium',
    operation: data.operation,
    actor: {
      id: data.adminId,
      email: data.adminEmail,
    },
    target: {
      role: data.targetRoleId ? { id: data.targetRoleId, name: data.targetRoleName } : undefined,
      user: data.targetUserId ? { id: data.targetUserId, email: data.targetUserEmail } : undefined,
    },
    changes: data.changes,
    reason: data.reason,
    metadata: data.metadata,
  };
}

/**
 * Validate role name
 */
export function validateRoleName(name: string): RoleSecurityCheck {
  // Must not be empty
  if (!name || name.trim().length === 0) {
    return {
      allowed: false,
      reason: 'Role name cannot be empty',
    };
  }

  // Length constraints
  if (name.length < 3) {
    return {
      allowed: false,
      reason: 'Role name must be at least 3 characters',
    };
  }

  if (name.length > 100) {
    return {
      allowed: false,
      reason: 'Role name cannot exceed 100 characters',
    };
  }

  // Must not contain special characters (except dash and underscore)
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    return {
      allowed: false,
      reason: 'Role name can only contain letters, numbers, spaces, dashes, and underscores',
    };
  }

  // Must not start with "system-" (reserved prefix)
  if (name.toLowerCase().startsWith('system-')) {
    return {
      allowed: false,
      reason: 'Role name cannot start with "system-" (reserved prefix)',
    };
  }

  return { allowed: true };
}
