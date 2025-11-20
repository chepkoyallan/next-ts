// Delete Feature Flag Override
// DELETE /api/v1/feature-flags/:key/overrides/:id

import { NextRequest, NextResponse } from 'next/server';

import { logger } from '../../../../../lib/utils/logger';
import { authMiddleware } from '../../../../../lib/middleware/auth';
import { FeatureFlagService } from '../../../../../lib/services/feature-flag-service';
import { createErrorResponse, createSuccessResponse } from '../../../../../lib/utils/response';

/**
 * DELETE /api/v1/feature-flags/:key/overrides/:id
 * Remove an override from a feature flag
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { key: string; id: string } }
) {
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

    const { id } = params;

    // Remove override
    await FeatureFlagService.removeOverride(id, authResult.user.id);

    logger.info('Feature flag override removed', {
      userId: authResult.user.id,
      overrideId: id,
    });

    return createSuccessResponse({
      message: 'Override removed successfully',
    });
  } catch (error) {
    logger.error('Failed to remove override', error as Error);

    if ((error as Error).message.includes('not found')) {
      return createErrorResponse('RESOURCE_NOT_FOUND', {
        message: (error as Error).message,
      });
    }

    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'Failed to remove override',
      details: (error as Error).message,
    });
  }
}
