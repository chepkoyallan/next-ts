// Feature Flag middleware
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '../utils/logger';
import { optionalAuthMiddleware } from './auth';
import { createErrorResponse } from '../utils/response';
import { FeatureFlagService } from '../services/feature-flag-service';

export interface FeatureFlagOptions {
  /**
   * Feature flag key to check
   */
  key: string;

  /**
   * Custom error message if feature is disabled
   */
  errorMessage?: string;

  /**
   * Whether to fail silently (return null instead of error response)
   */
  failSilently?: boolean;

  /**
   * Whether to log when feature is disabled
   */
  logDisabled?: boolean;
}

/**
 * Feature flag middleware
 * Checks if a feature flag is enabled before allowing request to proceed
 *
 * @example
 * const authResult = await authMiddleware(request);
 * const featureFlagResult = await featureFlagMiddleware(request, {
 *   key: 'workflows.create.enabled',
 *   errorMessage: 'Workflow creation is currently disabled'
 * }, authResult.user);
 *
 * if (featureFlagResult instanceof NextResponse) {
 *   return featureFlagResult;
 * }
 */
export async function featureFlagMiddleware(
  request: NextRequest,
  options: FeatureFlagOptions,
  user?: { id: string; organizationId?: string; roles?: string[] }
): Promise<boolean | NextResponse> {
  try {
    const { key, errorMessage, failSilently = false, logDisabled = true } = options;

    // Build context from user if provided
    const context = user
      ? {
          userId: user.id,
          organizationId: user.organizationId,
          roles: user.roles,
          environment: process.env.NODE_ENV,
        }
      : {
          environment: process.env.NODE_ENV,
        };

    // Check if feature is enabled
    const isEnabled = await FeatureFlagService.isEnabled(key, context);

    if (!isEnabled) {
      if (logDisabled) {
        logger.warn('Feature flag disabled', {
          flagKey: key,
          userId: user?.id,
          organizationId: user?.organizationId,
          path: request.nextUrl.pathname,
        });
      }

      if (failSilently) {
        return false;
      }

      return createErrorResponse('FEATURE_DISABLED', {
        message: errorMessage || `Feature '${key}' is currently disabled`,
        flagKey: key,
      });
    }

    return true;
  } catch (error) {
    logger.error('Feature flag middleware error', error as Error, {
      flagKey: options.key,
      userId: user?.id,
    });

    // On error, fail open (allow request) to prevent feature flag failures from breaking the app
    return true;
  }
}

/**
 * Create a feature flag checker that can be used in route handlers
 *
 * @example
 * const checkFeature = createFeatureFlagChecker(request);
 * const canCreateWorkflow = await checkFeature('workflows.create.enabled');
 * if (!canCreateWorkflow) {
 *   return createErrorResponse('FEATURE_DISABLED');
 * }
 */
export function createFeatureFlagChecker(request: NextRequest) {
  return async (key: string, options?: Omit<FeatureFlagOptions, 'key'>): Promise<boolean> => {
    const authContext = await optionalAuthMiddleware(request);

    const user =
      authContext.isAuthenticated && authContext.user
        ? {
            id: authContext.user.id,
            organizationId: authContext.user.organizationId,
            roles: authContext.user.roles,
          }
        : undefined;

    const result = await featureFlagMiddleware(
      request,
      { key, ...options, failSilently: true },
      user
    );

    return result === true;
  };
}

/**
 * Wrapper to combine auth and feature flag middleware
 * Useful for routes that require both authentication and feature flag checks
 *
 * @example
 * const result = await authWithFeatureFlag(request, {
 *   requiredPermissions: ['workflows.write'],
 *   featureFlag: 'workflows.create.enabled'
 * });
 *
 * if (result instanceof NextResponse) {
 *   return result;
 * }
 *
 * const { user, token } = result;
 */
export async function authWithFeatureFlag(
  request: NextRequest,
  options: {
    requiredPermissions?: string[];
    featureFlag: string;
    featureFlagErrorMessage?: string;
  }
): Promise<{ user: any; token: string } | NextResponse> {
  // First check authentication
  const authResult = await optionalAuthMiddleware(request);

  if (!authResult.isAuthenticated) {
    return createErrorResponse('UNAUTHORIZED', {
      message: 'Authentication required',
    });
  }

  const user = authResult.user!;
  const token = authResult.token!;

  // Check required permissions
  if (options.requiredPermissions && options.requiredPermissions.length > 0) {
    const hasPermission = options.requiredPermissions.every(
      (permission) => user.permissions?.includes(permission)
    );

    if (!hasPermission) {
      return createErrorResponse('FORBIDDEN', {
        message: 'Insufficient permissions',
      });
    }
  }

  // Check feature flag
  const featureFlagResult = await featureFlagMiddleware(
    request,
    {
      key: options.featureFlag,
      errorMessage: options.featureFlagErrorMessage,
    },
    {
      id: user.id,
      organizationId: user.organizationId,
      roles: user.roles,
    }
  );

  if (featureFlagResult instanceof NextResponse) {
    return featureFlagResult;
  }

  return { user, token };
}

/**
 * Batch check multiple feature flags at once
 * Useful for checking multiple features in a single route
 *
 * @example
 * const flags = await batchCheckFeatureFlags(request, [
 *   'workflows.create.enabled',
 *   'workflows.ai.enabled',
 *   'workflows.templates.enabled'
 * ]);
 *
 * console.log(flags);
 * // { 'workflows.create.enabled': true, 'workflows.ai.enabled': false, ... }
 */
export async function batchCheckFeatureFlags(
  request: NextRequest,
  keys: string[]
): Promise<Record<string, boolean>> {
  const authContext = await optionalAuthMiddleware(request);

  const context =
    authContext.isAuthenticated && authContext.user
      ? {
          userId: authContext.user.id,
          organizationId: authContext.user.organizationId,
          roles: authContext.user.roles,
          environment: process.env.NODE_ENV,
        }
      : {
          environment: process.env.NODE_ENV,
        };

  return FeatureFlagService.evaluateBatch(keys, context);
}
