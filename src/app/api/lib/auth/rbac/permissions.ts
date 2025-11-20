// Permission Registry - Production-Ready RBAC Permissions
import { Permission, ActionType, ResourceType } from './types';

/**
 * Creates a permission with consistent naming and structure
 */
function createPermission(
  resource: ResourceType,
  action: ActionType,
  description: string,
  conditions?: any[]
): Permission {
  return {
    id: `${resource}:${action}`,
    resource,
    action,
    description,
    conditions,
  };
}

/**
 * All available permissions in the system
 * Organized by resource type for maintainability
 */
export const PERMISSIONS: Record<string, Permission> = {
  // ===== PROJECT PERMISSIONS =====
  'projects:create': createPermission('projects', 'create', 'Create new projects'),
  'projects:read': createPermission('projects', 'read', 'View projects and their details'),
  'projects:update': createPermission('projects', 'update', 'Modify existing projects'),
  'projects:delete': createPermission('projects', 'delete', 'Delete projects'),
  'projects:manage': createPermission('projects', 'manage', 'Full project management access'),

  // ===== WORKFLOW PERMISSIONS =====
  'workflows:create': createPermission('workflows', 'create', 'Create new workflows'),
  'workflows:read': createPermission('workflows', 'read', 'View workflows and their definitions'),
  'workflows:update': createPermission('workflows', 'update', 'Modify existing workflows'),
  'workflows:delete': createPermission('workflows', 'delete', 'Delete workflows'),
  'workflows:execute': createPermission('workflows', 'execute', 'Execute workflows'),
  'workflows:manage': createPermission('workflows', 'manage', 'Full workflow management access'),

  // ===== EXECUTION PERMISSIONS =====
  'executions:create': createPermission('executions', 'create', 'Create new executions'),
  'executions:read': createPermission('executions', 'read', 'View executions and their status'),
  'executions:update': createPermission('executions', 'update', 'Modify execution parameters'),
  'executions:delete': createPermission('executions', 'delete', 'Delete executions'),
  'executions:terminate': createPermission(
    'executions',
    'terminate',
    'Terminate running executions'
  ),
  'executions:recover': createPermission('executions', 'recover', 'Recover failed executions'),
  'executions:manage': createPermission('executions', 'manage', 'Full execution management access'),

  // ===== LAUNCH PLAN PERMISSIONS =====
  'launch-plans:create': createPermission('launch-plans', 'create', 'Create new launch plans'),
  'launch-plans:read': createPermission('launch-plans', 'read', 'View launch plans'),
  'launch-plans:update': createPermission('launch-plans', 'update', 'Modify existing launch plans'),
  'launch-plans:delete': createPermission('launch-plans', 'delete', 'Delete launch plans'),
  'launch-plans:manage': createPermission(
    'launch-plans',
    'manage',
    'Full launch plan management access'
  ),

  // ===== TASK PERMISSIONS =====
  'tasks:create': createPermission('tasks', 'create', 'Create new tasks'),
  'tasks:read': createPermission('tasks', 'read', 'View tasks and their definitions'),
  'tasks:update': createPermission('tasks', 'update', 'Modify existing tasks'),
  'tasks:delete': createPermission('tasks', 'delete', 'Delete tasks'),
  'tasks:manage': createPermission('tasks', 'manage', 'Full task management access'),

  // ===== METRICS PERMISSIONS =====
  'metrics:read': createPermission('metrics', 'read', 'View metrics and monitoring data'),

  // ===== SYSTEM PERMISSIONS =====
  'system:read': createPermission('system', 'read', 'View system status and health information'),
  'system:admin': createPermission('system', 'admin', 'Full system administration access'),

  // ===== USER MANAGEMENT PERMISSIONS =====
  'users:create': createPermission('users', 'create', 'Create new user accounts'),
  'users:read': createPermission('users', 'read', 'View user information'),
  'users:update': createPermission('users', 'update', 'Modify user accounts'),
  'users:delete': createPermission('users', 'delete', 'Delete user accounts'),
  'users:manage': createPermission('users', 'manage', 'Full user management access'),

  // ===== ROLE MANAGEMENT PERMISSIONS =====
  'roles:create': createPermission('roles', 'create', 'Create new roles'),
  'roles:read': createPermission('roles', 'read', 'View role definitions'),
  'roles:update': createPermission('roles', 'update', 'Modify existing roles'),
  'roles:delete': createPermission('roles', 'delete', 'Delete roles'),
  'roles:manage': createPermission('roles', 'manage', 'Full role management access'),
};

/**
 * Permission groups for easier management
 */
export const PERMISSION_GROUPS = {
  PROJECT_BASIC: ['projects:read'],
  PROJECT_FULL: ['projects:create', 'projects:read', 'projects:update', 'projects:delete'],

  WORKFLOW_BASIC: ['workflows:read'],
  WORKFLOW_DEVELOPER: [
    'workflows:create',
    'workflows:read',
    'workflows:update',
    'workflows:execute',
  ],
  WORKFLOW_FULL: [
    'workflows:create',
    'workflows:read',
    'workflows:update',
    'workflows:delete',
    'workflows:execute',
  ],

  EXECUTION_BASIC: ['executions:read'],
  EXECUTION_OPERATOR: [
    'executions:create',
    'executions:read',
    'executions:update',
    'executions:terminate',
    'executions:recover',
  ],
  EXECUTION_FULL: [
    'executions:create',
    'executions:read',
    'executions:update',
    'executions:delete',
    'executions:terminate',
    'executions:recover',
  ],

  LAUNCH_PLAN_BASIC: ['launch-plans:read'],
  LAUNCH_PLAN_FULL: [
    'launch-plans:create',
    'launch-plans:read',
    'launch-plans:update',
    'launch-plans:delete',
  ],

  TASK_BASIC: ['tasks:read'],
  TASK_FULL: ['tasks:create', 'tasks:read', 'tasks:update', 'tasks:delete'],

  METRICS_BASIC: ['metrics:read'],

  SYSTEM_BASIC: ['system:read'],
  SYSTEM_ADMIN: ['system:read', 'system:admin'],

  USER_MANAGEMENT: ['users:create', 'users:read', 'users:update', 'users:delete'],
  ROLE_MANAGEMENT: ['roles:create', 'roles:read', 'roles:update', 'roles:delete'],
};

/**
 * Get all permissions for a resource
 */
export function getResourcePermissions(resource: ResourceType): Permission[] {
  return Object.values(PERMISSIONS).filter((permission) => permission.resource === resource);
}

/**
 * Get permission by ID
 */
export function getPermission(permissionId: string): Permission | undefined {
  return PERMISSIONS[permissionId];
}

/**
 * Validate permission exists
 */
export function isValidPermission(permissionId: string): boolean {
  return permissionId in PERMISSIONS;
}

/**
 * Get all permissions in a group
 */
export function getPermissionGroup(groupName: keyof typeof PERMISSION_GROUPS): string[] {
  return PERMISSION_GROUPS[groupName] || [];
}
