// Feature Flag Evaluation Route (Public)
// POST /api/v1/feature-flags/evaluate - Evaluate flags for current user

import { z } from 'zod';
import { NextRequest } from 'next/server';

import { logger } from '../../../lib/utils/logger';
import { optionalAuthMiddleware } from '../../../lib/middleware/auth';
import { FeatureFlagService } from '../../../lib/services/feature-flag-service';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Validation schema
const evaluateSchema = z.object({
  keys: z.array(z.string()).min(1).max(100), // Max 100 flags at once
});

/**
 * POST /api/v1/feature-flags/evaluate
 * Batch evaluate feature flags for the current user/context
 */
export async function POST(request: NextRequest) {
  try {
    // Optional authentication (works for both authenticated and anonymous users)
    const authResult = await optionalAuthMiddleware(request);

    // Parse and validate request body
    const body = await request.json();
    const validation = evaluateSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', {
        message: 'Invalid request body',
        errors: validation.error.issues,
      });
    }

    const { keys } = validation.data;

    // Build context
    const context = {
      userId: authResult.user?.id,
      organizationId: authResult.user?.organizationId,
      roles: authResult.user?.roles,
      environment: process.env.NODE_ENV,
    };

    // Evaluate flags
    const flags = await FeatureFlagService.evaluateBatch(keys, context);

    return createSuccessResponse({
      flags,
      context: {
        authenticated: authResult.isAuthenticated,
        userId: context.userId,
        organizationId: context.organizationId,
      },
    });
  } catch (error) {
    logger.error('Failed to evaluate feature flags', error as Error);
    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'Failed to evaluate feature flags',
      details: (error as Error).message,
    });
  }
}
