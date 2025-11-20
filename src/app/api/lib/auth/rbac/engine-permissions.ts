/**
 * Engine Permission Matrix
 * Maps engine operations to RBAC permissions
 */

export const ENGINE_PERMISSION_MATRIX = {
  // Project operations
  'projects:list': { resource: 'projects', action: 'read' },
  'projects:get': { resource: 'projects', action: 'read' },
  'projects:create': { resource: 'projects', action: 'create' },
  'projects:update': { resource: 'projects', action: 'update' },
  'projects:delete': { resource: 'projects', action: 'delete' },

  // Workflow operations
  'workflows:list': { resource: 'workflows', action: 'read' },
  'workflows:get': { resource: 'workflows', action: 'read' },
  'workflows:create': { resource: 'workflows', action: 'create' },
  'workflows:update': { resource: 'workflows', action: 'update' },
  'workflows:delete': { resource: 'workflows', action: 'delete' },

  // Execution operations
  'executions:list': { resource: 'executions', action: 'read' },
  'executions:get': { resource: 'executions', action: 'read' },
  'executions:create': { resource: 'executions', action: 'create' },
  'executions:terminate': { resource: 'executions', action: 'terminate' },
  'executions:recover': { resource: 'executions', action: 'recover' },
  'executions:delete': { resource: 'executions', action: 'delete' },

  // Task operations
  'tasks:list': { resource: 'tasks', action: 'read' },
  'tasks:get': { resource: 'tasks', action: 'read' },
  'tasks:create': { resource: 'tasks', action: 'create' },
  'tasks:update': { resource: 'tasks', action: 'update' },
  'tasks:delete': { resource: 'tasks', action: 'delete' },

  // Launch Plan operations
  'launch-plans:list': { resource: 'launch-plans', action: 'read' },
  'launch-plans:get': { resource: 'launch-plans', action: 'read' },
  'launch-plans:create': { resource: 'launch-plans', action: 'create' },
  'launch-plans:update': { resource: 'launch-plans', action: 'update' },
  'launch-plans:delete': { resource: 'launch-plans', action: 'delete' },

  // Signal operations
  'signals:list': { resource: 'executions', action: 'read' },
  'signals:get': { resource: 'executions', action: 'read' },
  'signals:create': { resource: 'executions', action: 'update' },
  'signals:set': { resource: 'executions', action: 'update' },

  // Data Proxy operations
  'data-proxy:upload': { resource: 'executions', action: 'create' },
  'data-proxy:download': { resource: 'executions', action: 'read' },
  'data-proxy:download-link': { resource: 'executions', action: 'read' },

  // Auth/Identity (system level)
  'auth:oauth2': { resource: 'system', action: 'read' },
  'auth:config': { resource: 'system', action: 'read' },
  'identity:userInfo': { resource: 'system', action: 'read' },
} as const;

/**
 * Get permission required for engine operation
 */
export function getEnginePermission(operation: string) {
  return ENGINE_PERMISSION_MATRIX[operation as keyof typeof ENGINE_PERMISSION_MATRIX];
}

/**
 * Check if role can perform engine operation
 */
export function canPerformEngineOperation(userRoles: string[], operation: string): boolean {
  const permission = getEnginePermission(operation);
  if (!permission) return false;

  // Role permission mapping
  const permissionLevel: Record<string, string[]> = {
    viewer: ['read'],
    developer: ['read', 'create', 'update', 'execute'],
    operator: ['read', 'create', 'update', 'delete', 'terminate', 'recover', 'execute'],
    'project-admin': [
      'read',
      'create',
      'update',
      'delete',
      'terminate',
      'recover',
      'manage',
      'execute',
    ],
    'system-admin': [
      'read',
      'create',
      'update',
      'delete',
      'terminate',
      'recover',
      'manage',
      'admin',
      'execute',
    ],
    'super-admin': ['*'],
  };

  return userRoles.some((role) => {
    const allowedActions = permissionLevel[role] || [];
    return allowedActions.includes('*') || allowedActions.includes(permission.action);
  });
}

/**
 * Get all operations allowed for roles
 */
export function getAllowedOperations(userRoles: string[]): string[] {
  return Object.keys(ENGINE_PERMISSION_MATRIX).filter((operation) =>
    canPerformEngineOperation(userRoles, operation)
  );
}

/**
 * Check if user has minimum role level
 */
export function hasMinimumRoleLevel(userRoles: string[], minimumRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    viewer: 1,
    developer: 2,
    operator: 3,
    'project-admin': 4,
    'system-admin': 5,
    'super-admin': 6,
  };

  const minimumLevel = roleHierarchy[minimumRole] || 0;
  const userMaxLevel = Math.max(...userRoles.map((r) => roleHierarchy[r] || 0));

  return userMaxLevel >= minimumLevel;
}
