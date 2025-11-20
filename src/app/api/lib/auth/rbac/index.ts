// RBAC System Exports - Production-Ready Role-Based Access Control
export * from './types';
export * from './middleware';
export * from './permissions';

export { RoleHierarchy } from './role-hierarchy';
export { RoleValidator } from './role-validator';
export { PermissionChecker } from './permission-checker';
// Import and re-export to avoid conflicts
export { getRole, getAllRoles, isValidRole, SYSTEM_ROLES } from './roles';
export {
  RequireRole,
  accessControl,
  requirePermission,
  AccessControlEngine,
} from './access-control';

// Main exports are handled by export * above

// Version and metadata
export const RBAC_VERSION = '1.0.0';
export const RBAC_METADATA = {
  version: RBAC_VERSION,
  description: 'Production-ready Role-Based Access Control system',
  features: [
    'Hierarchical role system',
    'Fine-grained permissions',
    'Contextual access control',
    'Audit logging',
    'Middleware integration',
    'Type-safe implementation',
  ],
};
