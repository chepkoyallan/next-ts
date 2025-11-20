// Feature Flag Overrides Routes
// POST /api/v1/feature-flags/:key/overrides - Add override
// DELETE /api/v1/feature-flags/:key/overrides/:id - Remove override

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '../../../../lib/utils/logger';
import { authMiddleware } from '../../../../lib/middleware/auth';
import { FeatureFlagService } from '../../../../lib/services/feature-flag-service';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Validation schema for creating an override
const createOverrideSchema = z.object({
  scope: z.enum(['USER', 'ORGANIZATION', 'ROLE', 'GLOBAL']),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  roleId: z.string().optional(),
  enabled: z.boolean(),
});

/**
 * POST /api/v1/feature-flags/:key/overrides
 * Add an override to a feature flag
 */
export async function POST(request: NextRequest, { params }: { params: { key: string } }) {
  try {
    // Authenticate and check admin role
    const authResult = await authMiddleware(request);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check if user has admin role
    if (!authResult.user.roles.includes('admin')) {
      return createErrorResponse('UNAUTHORIZED', {
        message: 'Admin access required',
      });
    }

    const { key } = params;

    // Parse and validate request body
    const body = await request.json();
    const validation = createOverrideSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', {
        message: 'Invalid request body',
        errors: validation.error.issues,
      });
    }

    const { data } = validation;

    // Validate scope-specific requirements
    if (data.scope === 'USER' && !data.userId) {
      return createErrorResponse('VALIDATION_ERROR', {
        message: 'userId is required for USER scope',
      });
    }

    if (data.scope === 'ORGANIZATION' && !data.organizationId) {
      return createErrorResponse('VALIDATION_ERROR', {
        message: 'organizationId is required for ORGANIZATION scope',
      });
    }

    if (data.scope === 'ROLE' && !data.roleId) {
      return createErrorResponse('VALIDATION_ERROR', {
        message: 'roleId is required for ROLE scope',
      });
    }

    // Create override
    const override = await FeatureFlagService.addOverride(key, {
      scope: data.scope as any,
      userId: data.userId,
      organizationId: data.organizationId,
      roleId: data.roleId,
      enabled: data.enabled,
      createdBy: authResult.user.id,
    });

    logger.info('Feature flag override added', {
      userId: authResult.user.id,
      flagKey: key,
      overrideId: override.id,
      scope: data.scope,
    });

    return createSuccessResponse(
      {
        override,
        message: 'Override added successfully',
      },
      201
    );
  } catch (error) {
    logger.error('Failed to add override', error as Error);

    if ((error as Error).message.includes('not found')) {
      return createErrorResponse('RESOURCE_NOT_FOUND', {
        message: (error as Error).message,
      });
    }

    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'Failed to add override',
      details: (error as Error).message,
    });
  }
}
