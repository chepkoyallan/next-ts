/**
 * Centralized Headless Mode Configuration for Backend
 * Single source of truth for headless mode checks in API routes
 */

/**
 * Fixed IDs for headless mode - these must match the database records
 * Using fixed UUIDs to ensure consistency across database and API
 */
export const HEADLESS_USER_ID = 'headless-user-00000000000000000000';
export const HEADLESS_ORG_ID = 'headless-org-000000000000000000000';
export const HEADLESS_EMAIL = 'headless@local';

/**
 * Check if headless mode is enabled (server-side only)
 * This is the ONLY function that should check the HEADLESS environment variable
 */
export const isHeadlessMode = (): boolean => {
  const headlessValue = process.env.HEADLESS || process.env.NEXT_PUBLIC_HEADLESS || 'false';
  const enabled = headlessValue.toLowerCase() === 'true' || headlessValue === '1';

  if (enabled) {
    console.log('[Headless Mode] Active - All auth checks bypassed');
  }

  return enabled;
};

/**
 * Mock user for headless mode
 * All API requests in headless mode will use this user
 */
export const HEADLESS_MOCK_USER = {
  id: HEADLESS_USER_ID,
  email: HEADLESS_EMAIL,
  roles: ['super-admin'] as string[],
  permissions: ['*'] as string[],
};

/**
 * Mock context for headless mode
 * Includes organization and subscription info
 */
export const HEADLESS_MOCK_CONTEXT = {
  userId: HEADLESS_USER_ID,
  organizationId: HEADLESS_ORG_ID,
  subscriptionTier: 'enterprise' as const,
  subscriptionStatus: 'active' as const,
  roles: ['super-admin'] as string[],
  permissions: ['*'] as string[],
};

/**
 * Mock admin context for headless mode
 */
export const HEADLESS_MOCK_ADMIN = {
  userId: HEADLESS_USER_ID,
  email: HEADLESS_EMAIL,
  roles: ['super-admin'] as string[],
  isSuperAdmin: true,
  isSystemAdmin: true,
  isAdmin: true,
};

/**
 * Get organization ID from request or use headless mock
 * Helper function to avoid repeating organization ID logic in every route
 */
export const getOrganizationId = (request: Request): string | null => {
  const headerOrgId = request.headers.get('x-organization-id');

  if (headerOrgId) {
    return headerOrgId;
  }

  // In headless mode, use mock organization ID
  if (isHeadlessMode()) {
    return HEADLESS_MOCK_CONTEXT.organizationId;
  }

  return null;
};
