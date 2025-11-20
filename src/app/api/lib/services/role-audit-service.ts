/**
 * Enhanced Audit Service for Role Management Operations
 * Provides detailed logging and tracking for all role-related actions
 */

import { formatRoleAuditLog } from '../auth/rbac/role-security';

// ----------------------------------------------------------------------

export interface RoleOperationLog {
  id?: string;
  timestamp: Date;
  operation: string;
  adminId: string;
  adminEmail: string;
  adminRoles: string[];
  targetType: 'role' | 'user' | 'permission';
  targetId: string;
  targetName: string;
  action: 'create' | 'update' | 'delete' | 'assign' | 'revoke' | 'clone';
  changes?: {
    before?: any;
    after?: any;
    diff?: string[];
  };
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log role creation
 */
export async function logRoleCreation(params: {
  adminId: string;
  adminEmail: string;
  adminRoles: string[];
  roleId: string;
  roleName: string;
  roleData: any;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { logAuditEvent } = await import('./audit-service');

  const auditData = formatRoleAuditLog({
    operation: 'role_created',
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    targetRoleId: params.roleId,
    targetRoleName: params.roleName,
    changes: {
      created: params.roleData,
    },
    metadata: {
      adminRoles: params.adminRoles,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: 'role_created',
    resource: 'roles',
    resourceId: params.roleId,
    projectId: 'admin',
    details: auditData,
  });

  console.log(`[AUDIT] Role created: ${params.roleName} by ${params.adminEmail}`);
}

/**
 * Log role update
 */
export async function logRoleUpdate(params: {
  adminId: string;
  adminEmail: string;
  adminRoles: string[];
  roleId: string;
  roleName: string;
  before: any;
  after: any;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { logAuditEvent } = await import('./audit-service');

  // Calculate differences
  const diff: string[] = [];
  const changes: Record<string, any> = {};

  Object.keys(params.after).forEach((key) => {
    if (JSON.stringify(params.before[key]) !== JSON.stringify(params.after[key])) {
      diff.push(key);
      changes[key] = {
        before: params.before[key],
        after: params.after[key],
      };
    }
  });

  const auditData = formatRoleAuditLog({
    operation: 'role_updated',
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    targetRoleId: params.roleId,
    targetRoleName: params.roleName,
    changes: {
      fields: diff,
      details: changes,
    },
    metadata: {
      adminRoles: params.adminRoles,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: 'role_updated',
    resource: 'roles',
    resourceId: params.roleId,
    projectId: 'admin',
    details: auditData,
  });

  console.log(
    `[AUDIT] Role updated: ${params.roleName} by ${params.adminEmail} - Changed: ${diff.join(', ')}`
  );
}

/**
 * Log role deletion
 */
export async function logRoleDeletion(params: {
  adminId: string;
  adminEmail: string;
  adminRoles: string[];
  roleId: string;
  roleName: string;
  roleData: any;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { logAuditEvent } = await import('./audit-service');

  const auditData = formatRoleAuditLog({
    operation: 'role_deleted',
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    targetRoleId: params.roleId,
    targetRoleName: params.roleName,
    reason: params.reason,
    changes: {
      deleted: params.roleData,
    },
    metadata: {
      adminRoles: params.adminRoles,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: 'role_deleted',
    resource: 'roles',
    resourceId: params.roleId,
    projectId: 'admin',
    details: auditData,
  });

  console.log(`[AUDIT] Role deleted: ${params.roleName} by ${params.adminEmail}`);
}

/**
 * Log role cloning
 */
export async function logRoleClone(params: {
  adminId: string;
  adminEmail: string;
  adminRoles: string[];
  sourceRoleId: string;
  sourceRoleName: string;
  newRoleId: string;
  newRoleName: string;
  includePermissions: boolean;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { logAuditEvent } = await import('./audit-service');

  const auditData = formatRoleAuditLog({
    operation: 'role_cloned',
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    targetRoleId: params.newRoleId,
    targetRoleName: params.newRoleName,
    changes: {
      sourceRole: {
        id: params.sourceRoleId,
        name: params.sourceRoleName,
      },
      includePermissions: params.includePermissions,
    },
    metadata: {
      adminRoles: params.adminRoles,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: 'role_cloned',
    resource: 'roles',
    resourceId: params.newRoleId,
    projectId: 'admin',
    details: auditData,
  });

  console.log(
    `[AUDIT] Role cloned: ${params.sourceRoleName} -> ${params.newRoleName} by ${params.adminEmail}`
  );
}

/**
 * Log role permission changes
 */
export async function logRolePermissionChange(params: {
  adminId: string;
  adminEmail: string;
  adminRoles: string[];
  roleId: string;
  roleName: string;
  addedPermissions: string[];
  removedPermissions: string[];
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { logAuditEvent } = await import('./audit-service');

  const auditData = formatRoleAuditLog({
    operation: 'role_permissions_changed',
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    targetRoleId: params.roleId,
    targetRoleName: params.roleName,
    changes: {
      added: params.addedPermissions,
      removed: params.removedPermissions,
      totalAdded: params.addedPermissions.length,
      totalRemoved: params.removedPermissions.length,
    },
    metadata: {
      adminRoles: params.adminRoles,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: 'role_permissions_changed',
    resource: 'roles',
    resourceId: params.roleId,
    projectId: 'admin',
    details: auditData,
  });

  console.log(
    `[AUDIT] Role permissions changed: ${params.roleName} by ${params.adminEmail} - Added: ${params.addedPermissions.length}, Removed: ${params.removedPermissions.length}`
  );
}

/**
 * Log role assignment to user
 */
export async function logRoleAssignment(params: {
  adminId: string;
  adminEmail: string;
  adminRoles: string[];
  roleId: string;
  roleName: string;
  userId: string;
  userEmail: string;
  expiresAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { logAuditEvent } = await import('./audit-service');

  const auditData = formatRoleAuditLog({
    operation: 'role_assigned',
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    targetRoleId: params.roleId,
    targetRoleName: params.roleName,
    targetUserId: params.userId,
    targetUserEmail: params.userEmail,
    changes: {
      expiresAt: params.expiresAt?.toISOString(),
    },
    metadata: {
      adminRoles: params.adminRoles,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: 'role_assigned',
    resource: 'user_roles',
    resourceId: params.userId,
    projectId: 'admin',
    details: auditData,
  });

  console.log(
    `[AUDIT] Role assigned: ${params.roleName} to ${params.userEmail} by ${params.adminEmail}`
  );
}

/**
 * Log role revocation from user
 */
export async function logRoleRevocation(params: {
  adminId: string;
  adminEmail: string;
  adminRoles: string[];
  roleId: string;
  roleName: string;
  userId: string;
  userEmail: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { logAuditEvent } = await import('./audit-service');

  const auditData = formatRoleAuditLog({
    operation: 'role_revoked',
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    targetRoleId: params.roleId,
    targetRoleName: params.roleName,
    targetUserId: params.userId,
    targetUserEmail: params.userEmail,
    reason: params.reason,
    metadata: {
      adminRoles: params.adminRoles,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: 'role_revoked',
    resource: 'user_roles',
    resourceId: params.userId,
    projectId: 'admin',
    details: auditData,
  });

  console.log(
    `[AUDIT] Role revoked: ${params.roleName} from ${params.userEmail} by ${params.adminEmail}`
  );
}

/**
 * Log bulk role assignments
 */
export async function logBulkRoleAssignment(params: {
  adminId: string;
  adminEmail: string;
  adminRoles: string[];
  roleId: string;
  roleName: string;
  userIds: string[];
  successCount: number;
  failureCount: number;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { logAuditEvent } = await import('./audit-service');

  const auditData = formatRoleAuditLog({
    operation: 'bulk_role_assignment',
    adminId: params.adminId,
    adminEmail: params.adminEmail,
    targetRoleId: params.roleId,
    targetRoleName: params.roleName,
    changes: {
      totalUsers: params.userIds.length,
      successCount: params.successCount,
      failureCount: params.failureCount,
      userIds: params.userIds,
    },
    metadata: {
      adminRoles: params.adminRoles,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  await logAuditEvent({
    userId: params.adminId,
    action: 'bulk_role_assignment',
    resource: 'user_roles',
    resourceId: params.roleId,
    projectId: 'admin',
    details: auditData,
  });

  console.log(
    `[AUDIT] Bulk role assignment: ${params.roleName} to ${params.successCount} users by ${params.adminEmail}`
  );
}

/**
 * Log security violations
 */
export async function logSecurityViolation(params: {
  adminId: string;
  adminEmail: string;
  operation: string;
  reason: string;
  attemptedAction: string;
  targetResource?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const { logAuditEvent } = await import('./audit-service');

  const auditData = {
    timestamp: new Date().toISOString(),
    category: 'security_violation',
    severity: 'high',
    operation: params.operation,
    actor: {
      id: params.adminId,
      email: params.adminEmail,
    },
    violation: {
      reason: params.reason,
      attemptedAction: params.attemptedAction,
      targetResource: params.targetResource,
    },
    metadata: {
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  };

  await logAuditEvent({
    userId: params.adminId,
    action: 'security_violation',
    resource: 'roles',
    resourceId: params.targetResource || 'unknown',
    projectId: 'admin',
    details: auditData,
  });

  console.warn(
    `[SECURITY] Violation: ${params.operation} by ${params.adminEmail} - ${params.reason}`
  );
}
