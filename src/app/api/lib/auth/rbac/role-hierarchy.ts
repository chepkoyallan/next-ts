// Role Hierarchy Management
import { Role } from './types';

/**
 * Role hierarchy utilities
 */
export class RoleHierarchy {
  /**
   * Check if role A has higher or equal hierarchy than role B
   */
  static hasHigherOrEqualHierarchy(roleA: Role, roleB: Role): boolean {
    return roleA.hierarchy >= roleB.hierarchy;
  }

  /**
   * Get all roles with lower hierarchy than the given role
   */
  static getLowerHierarchyRoles(role: Role, allRoles: Role[]): Role[] {
    return allRoles.filter((r) => r.hierarchy < role.hierarchy);
  }

  /**
   * Get all roles with higher hierarchy than the given role
   */
  static getHigherHierarchyRoles(role: Role, allRoles: Role[]): Role[] {
    return allRoles.filter((r) => r.hierarchy > role.hierarchy);
  }

  /**
   * Check if a user with roleA can manage a user with roleB
   */
  static canManageRole(managerRole: Role, targetRole: Role): boolean {
    return managerRole.hierarchy > targetRole.hierarchy;
  }
}
