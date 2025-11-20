// Role Assignment Validation
import { Role } from './types';
import { RoleHierarchy } from './role-hierarchy';

/**
 * Role assignment rules and validation
 */
export class RoleValidator {
  /**
   * Validate if a role can be assigned by the current user
   */
  static canAssignRole(assignerRoles: Role[], targetRole: Role): boolean {
    const highestAssignerRole = assignerRoles.reduce((highest, current) =>
      current.hierarchy > highest.hierarchy ? current : highest
    );

    return RoleHierarchy.canManageRole(highestAssignerRole, targetRole);
  }

  /**
   * Validate role combination (check for conflicts)
   */
  static validateRoleCombination(roles: Role[]): { valid: boolean; conflicts?: string[] } {
    // Example: Check if user has both viewer and admin roles (might be redundant)
    const conflicts: string[] = [];

    const hasViewer = roles.some((r) => r.id === 'viewer');
    const hasHigherRole = roles.some((r) => r.hierarchy > 1);

    if (hasViewer && hasHigherRole) {
      conflicts.push('Viewer role is redundant when higher-level roles are assigned');
    }

    return {
      valid: conflicts.length === 0,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  /**
   * Get recommended roles based on permissions needed
   */
  static recommendRoles(requiredPermissions: string[], availableRoles: Role[]): Role[] {
    return availableRoles
      .filter((role) =>
        requiredPermissions.every((permission) => role.permissions.includes(permission))
      )
      .sort((a: Role, b: Role) => a.hierarchy - b.hierarchy); // Return lowest hierarchy first
  }
}
