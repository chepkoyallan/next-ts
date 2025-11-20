// Role Registry - Production-Ready RBAC Roles
import { Role } from './types';
import { PERMISSION_GROUPS } from './permissions';

/**
 * Creates a role with consistent structure and validation
 */
function createRole(
  id: string,
  name: string,
  description: string,
  permissions: string[],
  hierarchy: number,
  isSystemRole: boolean = true
): Role {
  return {
    id,
    name,
    description,
    permissions,
    hierarchy,
    isSystemRole,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * System-defined roles with hierarchical access control
 * Higher hierarchy numbers inherit permissions from lower levels
 */
export const SYSTEM_ROLES: Record<string, Role> = {
  // ===== VIEWER ROLE (Level 1) =====
  viewer: createRole(
    'viewer',
    'Viewer',
    'Read-only access to orchestrator resources',
    [
      ...PERMISSION_GROUPS.PROJECT_BASIC,
      ...PERMISSION_GROUPS.WORKFLOW_BASIC,
      ...PERMISSION_GROUPS.EXECUTION_BASIC,
      ...PERMISSION_GROUPS.LAUNCH_PLAN_BASIC,
      ...PERMISSION_GROUPS.TASK_BASIC,
      ...PERMISSION_GROUPS.METRICS_BASIC,
      ...PERMISSION_GROUPS.SYSTEM_BASIC,
    ],
    1
  ),

  // ===== DEVELOPER ROLE (Level 2) =====
  developer: createRole(
    'developer',
    'Developer',
    'Can create and manage workflows, executions, and related resources',
    [
      // All viewer permissions plus developer-specific permissions
      ...PERMISSION_GROUPS.PROJECT_BASIC,
      ...PERMISSION_GROUPS.WORKFLOW_DEVELOPER,
      ...PERMISSION_GROUPS.EXECUTION_OPERATOR,
      ...PERMISSION_GROUPS.LAUNCH_PLAN_FULL,
      ...PERMISSION_GROUPS.TASK_FULL,
      ...PERMISSION_GROUPS.METRICS_BASIC,
      ...PERMISSION_GROUPS.SYSTEM_BASIC,
    ],
    2
  ),

  // ===== OPERATOR ROLE (Level 3) =====
  operator: createRole(
    'operator',
    'Operator',
    'Can manage executions and monitor system operations',
    [
      // All developer permissions plus operator-specific permissions
      ...PERMISSION_GROUPS.PROJECT_BASIC,
      ...PERMISSION_GROUPS.WORKFLOW_FULL,
      ...PERMISSION_GROUPS.EXECUTION_FULL,
      ...PERMISSION_GROUPS.LAUNCH_PLAN_FULL,
      ...PERMISSION_GROUPS.TASK_FULL,
      ...PERMISSION_GROUPS.METRICS_BASIC,
      ...PERMISSION_GROUPS.SYSTEM_BASIC,
    ],
    3
  ),

  // ===== PROJECT ADMIN ROLE (Level 4) =====
  'project-admin': createRole(
    'project-admin',
    'Project Administrator',
    'Full access to project resources and team management',
    [
      // All operator permissions plus project admin permissions
      ...PERMISSION_GROUPS.PROJECT_FULL,
      ...PERMISSION_GROUPS.WORKFLOW_FULL,
      ...PERMISSION_GROUPS.EXECUTION_FULL,
      ...PERMISSION_GROUPS.LAUNCH_PLAN_FULL,
      ...PERMISSION_GROUPS.TASK_FULL,
      ...PERMISSION_GROUPS.METRICS_BASIC,
      ...PERMISSION_GROUPS.SYSTEM_BASIC,
      'users:read',
      'users:update',
    ],
    4
  ),

  // ===== SYSTEM ADMIN ROLE (Level 5) =====
  'system-admin': createRole(
    'system-admin',
    'System Administrator',
    'Full system administration access including user and role management',
    [
      // All project admin permissions plus system admin permissions
      ...PERMISSION_GROUPS.PROJECT_FULL,
      ...PERMISSION_GROUPS.WORKFLOW_FULL,
      ...PERMISSION_GROUPS.EXECUTION_FULL,
      ...PERMISSION_GROUPS.LAUNCH_PLAN_FULL,
      ...PERMISSION_GROUPS.TASK_FULL,
      ...PERMISSION_GROUPS.METRICS_BASIC,
      ...PERMISSION_GROUPS.SYSTEM_ADMIN,
      ...PERMISSION_GROUPS.USER_MANAGEMENT,
      ...PERMISSION_GROUPS.ROLE_MANAGEMENT,
    ],
    5
  ),

  // ===== SUPER ADMIN ROLE (Level 6) =====
  'super-admin': createRole(
    'super-admin',
    'Super Administrator',
    'Ultimate system access with all permissions',
    [
      // All permissions in the system
      'projects:create',
      'projects:read',
      'projects:update',
      'projects:delete',
      'projects:manage',
      'workflows:create',
      'workflows:read',
      'workflows:update',
      'workflows:delete',
      'workflows:execute',
      'workflows:manage',
      'executions:create',
      'executions:read',
      'executions:update',
      'executions:delete',
      'executions:terminate',
      'executions:recover',
      'executions:manage',
      'launch-plans:create',
      'launch-plans:read',
      'launch-plans:update',
      'launch-plans:delete',
      'launch-plans:manage',
      'tasks:create',
      'tasks:read',
      'tasks:update',
      'tasks:delete',
      'tasks:manage',
      'metrics:read',
      'system:read',
      'system:admin',
      'users:create',
      'users:read',
      'users:update',
      'users:delete',
      'users:manage',
      'roles:create',
      'roles:read',
      'roles:update',
      'roles:delete',
    ],
    6
  ),
};

// Export classes from separate files
export { RoleHierarchy } from './role-hierarchy';
export { RoleValidator } from './role-validator';

/**
 * Get role by ID
 */
export function getRole(roleId: string): Role | undefined {
  return SYSTEM_ROLES[roleId];
}

/**
 * Get all system roles
 */
export function getAllRoles(): Role[] {
  return Object.values(SYSTEM_ROLES);
}

/**
 * Check if role exists
 */
export function isValidRole(roleId: string): boolean {
  return roleId in SYSTEM_ROLES;
}

/**
 * Get roles by hierarchy level
 */
export function getRolesByHierarchy(minLevel: number, maxLevel?: number): Role[] {
  return Object.values(SYSTEM_ROLES).filter((role) => {
    if (maxLevel !== undefined) {
      return role.hierarchy >= minLevel && role.hierarchy <= maxLevel;
    }
    return role.hierarchy >= minLevel;
  });
}
