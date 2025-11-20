// Access Control Engine - Production-Ready RBAC Implementation
import { PERMISSIONS } from './permissions';
import { Role, Permission, RBACContext, AccessResult, RBACAuditLog, AccessRequest } from './types';

/**
 * Main Access Control Engine
 * Handles permission checking, role evaluation, and access decisions
 */
export class AccessControlEngine {
  private auditLogger?: (log: RBACAuditLog) => Promise<void>;

  constructor(auditLogger?: (log: RBACAuditLog) => Promise<void>) {
    this.auditLogger = auditLogger;
  }

  /**
   * Check if user has access to perform an action on a resource
   */
  async checkAccess(request: AccessRequest): Promise<AccessResult> {
    try {
      const context = await AccessControlEngine.buildRBACContext(request.userId);
      const result = AccessControlEngine.evaluateAccess(context, request);

      // Audit log the access check
      await this.logAccess(request, result);

      return result;
    } catch (error) {
      console.error('Access control error:', error);
      return {
        allowed: false,
        reason: 'Internal access control error',
      };
    }
  }

  /**
   * Build RBAC context for a user
   */
  public static async buildRBACContext(userId: string): Promise<RBACContext> {
    // Import PermissionChecker dynamically to avoid circular dependency
    const { PermissionChecker } = await import('./permission-checker');
    const userRoles = await PermissionChecker.getUserRoles(userId);
    const permissions = AccessControlEngine.aggregatePermissions(userRoles);

    return {
      userId,
      roles: userRoles,
      permissions,
    };
  }

  /**
   * Evaluate access based on RBAC context and request
   */
  private static evaluateAccess(context: RBACContext, request: AccessRequest): AccessResult {
    const requiredPermission = `${request.resource}:${request.action}`;

    // Check if user has the specific permission
    const hasPermission = context.permissions.some((p) => p.id === requiredPermission);

    if (hasPermission) {
      // Check permission conditions if any
      const permission = context.permissions.find((p) => p.id === requiredPermission);
      if (permission?.conditions) {
        const conditionsMet = AccessControlEngine.evaluateConditions(
          permission.conditions,
          request.context || {}
        );
        if (!conditionsMet) {
          return {
            allowed: false,
            reason: 'Permission conditions not met',
            requiredPermissions: [requiredPermission],
          };
        }
      }

      return { allowed: true };
    }

    // Check for wildcard permissions (e.g., resource:manage covers all actions)
    const managePermission = `${request.resource}:manage`;
    const hasManagePermission = context.permissions.some((p) => p.id === managePermission);

    if (hasManagePermission) {
      return { allowed: true };
    }

    // Check for system admin permission
    const hasSystemAdmin = context.permissions.some((p) => p.id === 'system:admin');
    if (hasSystemAdmin) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Insufficient permissions',
      requiredPermissions: [requiredPermission],
      missingPermissions: [requiredPermission],
    };
  }

  /**
   * Evaluate permission conditions
   */
  private static evaluateConditions(conditions: any[], context: Record<string, any>): boolean {
    return conditions.every((condition) => {
      const contextValue = context[condition.field];

      switch (condition.operator) {
        case 'eq':
          return contextValue === condition.value;
        case 'ne':
          return contextValue !== condition.value;
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(contextValue);
        case 'nin':
          return Array.isArray(condition.value) && !condition.value.includes(contextValue);
        case 'gt':
          return contextValue > condition.value;
        case 'gte':
          return contextValue >= condition.value;
        case 'lt':
          return contextValue < condition.value;
        case 'lte':
          return contextValue <= condition.value;
        case 'contains':
          return typeof contextValue === 'string' && contextValue.includes(condition.value);
        case 'startsWith':
          return typeof contextValue === 'string' && contextValue.startsWith(condition.value);
        case 'endsWith':
          return typeof contextValue === 'string' && contextValue.endsWith(condition.value);
        default:
          return false;
      }
    });
  }

  /**
   * Aggregate permissions from all user roles
   */
  private static aggregatePermissions(roles: Role[]): Permission[] {
    const permissionIds = new Set<string>();

    // Collect all permission IDs from roles
    roles.forEach((role) => {
      role.permissions.forEach((permissionId) => {
        permissionIds.add(permissionId);
      });
    });

    // Convert to Permission objects
    return Array.from(permissionIds)
      .map((id) => PERMISSIONS[id])
      .filter(Boolean);
  }

  /**
   * Log access attempts for auditing
   */
  private async logAccess(request: AccessRequest, result: AccessResult): Promise<void> {
    if (!this.auditLogger) return;

    const auditLog: RBACAuditLog = {
      id: AccessControlEngine.generateAuditId(),
      userId: request.userId,
      action: result.allowed ? 'access_granted' : 'access_denied',
      resource: request.resource,
      resourceId: request.context?.resourceId,
      details: {
        action: request.action,
        reason: result.reason,
        requiredPermissions: result.requiredPermissions,
        missingPermissions: result.missingPermissions,
      },
      timestamp: new Date(),
    };

    await this.auditLogger(auditLog);
  }

  /**
   * Generate unique audit log ID
   */
  private static generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Note: PermissionChecker is exported separately from permission-checker.ts
// to avoid circular dependency issues

/**
 * Middleware-friendly access control
 */
export function requirePermission(resource: string, action: string) {
  return async function checkPermission(
    userId: string,
    context?: Record<string, any>
  ): Promise<AccessResult> {
    const engine = new AccessControlEngine();
    return engine.checkAccess({ userId, resource, action, context });
  };
}

/**
 * Decorator for role-based method access
 * Usage: @RequireRole(['admin', 'operator'])
 */
export function RequireRole(roleIds: string[]) {
  return function roleDecorator(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function roleCheck(this: any, ...args: any[]) {
      // Try to extract userId from various sources
      const userId = args[0]?.userId || args[0]?.user?.id || (this as any).userId;

      if (!userId) {
        throw new Error('User ID required for role-based access control');
      }

      const context = await AccessControlEngine.buildRBACContext(userId);

      const hasRequiredRole = context.roles.some((role: any) => roleIds.includes(role.id));

      if (!hasRequiredRole) {
        throw new Error(`Access denied. Required roles: ${roleIds.join(', ')}`);
      }

      return originalMethod.apply(this, args);
    };
  };
}
export const accessControl = new AccessControlEngine();
