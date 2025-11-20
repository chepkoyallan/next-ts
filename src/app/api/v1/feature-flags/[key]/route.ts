// Feature Flag Detail Routes
// GET /api/v1/feature-flags/:key - Get specific flag
// PUT /api/v1/feature-flags/:key - Update flag
// DELETE /api/v1/feature-flags/:key - Delete flag

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '../../../lib/utils/logger';
import { authMiddleware } from '../../../lib/middleware/auth';
import { FeatureFlagService } from '../../../lib/services/feature-flag-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schema for updating a feature flag
const updateFlagSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  enabledFrom: z.string().datetime().optional().nullable(),
  enabledUntil: z.string().datetime().optional().nullable(),
  environments: z.array(z.string()).optional().nullable(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dependsOn: z.array(z.string()).optional(),
});

/**
 * GET /api/v1/feature-flags/:key
 * Get specific feature flag with overrides
 */
export async function GET(request: NextRequest, { params }: { params: { key: string } }) {
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

    // Get flag
    const flag = await FeatureFlagService.getFlag(key);

    if (!flag) {
      return createErrorResponse('RESOURCE_NOT_FOUND', {
        message: `Feature flag '${key}' not found`,
      });
    }

    // Get overrides
    const overrides = await FeatureFlagService.getOverrides(key);

    // Get statistics
    const stats = await FeatureFlagService.getFlagStats(key);

    return createSuccessResponse({
      flag,
      overrides,
      stats,
    });
  } catch (error) {
    logger.error('Failed to get feature flag', error as Error);
    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'Failed to get feature flag',
      details: (error as Error).message,
    });
  }
}

/**
 * PUT /api/v1/feature-flags/:key
 * Update feature flag
 */
export async function PUT(request: NextRequest, { params }: { params: { key: string } }) {
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
    const validation = updateFlagSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', {
        message: 'Invalid request body',
        errors: validation.error.issues,
      });
    }

    const { data } = validation;

    // Update flag
    const flag = await FeatureFlagService.updateFlag(key, {
      ...data,
      environments: data.environments ?? undefined,
      enabledFrom: data.enabledFrom ? new Date(data.enabledFrom) : undefined,
      enabledUntil: data.enabledUntil ? new Date(data.enabledUntil) : undefined,
      updatedBy: authResult.user.id,
    });

    logger.info('Feature flag updated', {
      userId: authResult.user.id,
      flagKey: key,
    });

    return createSuccessResponse({
      flag,
      message: 'Feature flag updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update feature flag', error as Error);

    if ((error as Error).message.includes('not found')) {
      return createErrorResponse('RESOURCE_NOT_FOUND', {
        message: (error as Error).message,
      });
    }

    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'Failed to update feature flag',
      details: (error as Error).message,
    });
  }
}

/**
 * DELETE /api/v1/feature-flags/:key
 * Delete feature flag
 */
export async function DELETE(request: NextRequest, { params }: { params: { key: string } }) {
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

    // Delete flag
    await FeatureFlagService.deleteFlag(key, authResult.user.id);

    logger.info('Feature flag deleted', {
      userId: authResult.user.id,
      flagKey: key,
    });

    return createSuccessResponse({
      message: 'Feature flag deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete feature flag', error as Error);

    if ((error as Error).message.includes('not found')) {
      return createErrorResponse('RESOURCE_NOT_FOUND', {
        message: (error as Error).message,
      });
    }

    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'Failed to delete feature flag',
      details: (error as Error).message,
    });
  }
}
