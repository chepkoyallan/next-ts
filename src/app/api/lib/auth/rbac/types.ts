// RBAC Type Definitions
export interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator:
    | 'eq'
    | 'ne'
    | 'in'
    | 'nin'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'contains'
    | 'startsWith'
    | 'endsWith';
  value: any;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[]; // Permission IDs
  hierarchy: number; // Higher number = more privileged
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: Date;
  expiresAt?: Date;
  isActive: boolean;
  context?: Record<string, any>; // For contextual permissions (e.g., project-specific)
}

export interface RBACContext {
  userId: string;
  roles: Role[];
  permissions: Permission[];
  resourceContext?: Record<string, any>;
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  context?: Record<string, any>;
}

export interface AccessResult {
  allowed: boolean;
  reason?: string;
  requiredPermissions?: string[];
  missingPermissions?: string[];
}

// Resource definitions for type safety
export type ResourceType =
  | 'projects'
  | 'workflows'
  | 'executions'
  | 'launch-plans'
  | 'tasks'
  | 'metrics'
  | 'system'
  | 'users'
  | 'roles';

export type ActionType =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'terminate'
  | 'recover'
  | 'admin'
  | 'manage';

// Audit logging
export interface RBACAuditLog {
  id: string;
  userId: string;
  action:
    | 'access_granted'
    | 'access_denied'
    | 'role_assigned'
    | 'role_revoked'
    | 'permission_checked';
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}
