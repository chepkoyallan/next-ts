// Feature Flags API Routes
// GET /api/v1/feature-flags - List all feature flags (admin)
// POST /api/v1/feature-flags - Create feature flag (admin)

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '../../lib/utils/logger';
import { authMiddleware } from '../../lib/middleware/auth';
import { FeatureFlagService } from '../../lib/services/feature-flag-service';
import { createErrorResponse, createSuccessResponse } from '../../lib/utils/response';

// Validation schema for creating a feature flag
const createFlagSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(
      /^[a-z0-9._-]+$/i,
      'Key must contain only alphanumeric characters, dots, underscores, and hyphens'
    ),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['BOOLEAN', 'PERCENTAGE', 'WHITELIST', 'DATE_RANGE', 'ENVIRONMENT']).optional(),
  enabled: z.boolean().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  enabledFrom: z.string().datetime().optional(),
  enabledUntil: z.string().datetime().optional(),
  environments: z.array(z.string()).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dependsOn: z.array(z.string()).optional(),
});

/**
 * GET /api/v1/feature-flags
 * List all feature flags (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate and check admin role
    const authResult = await authMiddleware(request);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check if user has admin role
    if (!authResult.user.roles.includes('admin')) {
      return createErrorResponse('FORBIDDEN', {
        message: 'Admin access required',
      });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const enabled = (() => {
      const enabledParam = searchParams.get('enabled');
      if (enabledParam === 'true') return true;
      if (enabledParam === 'false') return false;
      return undefined;
    })();
    const search = searchParams.get('search') || undefined;

    // Get all flags
    const flags = await FeatureFlagService.getAllFlags({
      category,
      enabled,
      search,
    });

    logger.info('Feature flags listed', {
      userId: authResult.user.id,
      count: flags.length,
    });

    return createSuccessResponse({
      flags,
      total: flags.length,
    });
  } catch (error) {
    logger.error('Failed to list feature flags', error as Error);
    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'Failed to list feature flags',
      details: (error as Error).message,
    });
  }
}

/**
 * POST /api/v1/feature-flags
 * Create a new feature flag (admin only)
 */
export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json();
    const validation = createFlagSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('VALIDATION_ERROR', {
        message: 'Invalid request body',
        errors: validation.error.issues,
      });
    }

    const { data } = validation;

    // Check if flag already exists
    const existing = await FeatureFlagService.getFlag(data.key);
    if (existing) {
      return createErrorResponse('RESOURCE_ALREADY_EXISTS', {
        message: `Feature flag with key '${data.key}' already exists`,
      });
    }

    // Create flag
    const flag = await FeatureFlagService.createFlag({
      ...data,
      enabledFrom: data.enabledFrom ? new Date(data.enabledFrom) : undefined,
      enabledUntil: data.enabledUntil ? new Date(data.enabledUntil) : undefined,
      createdBy: authResult.user.id,
    });

    logger.info('Feature flag created', {
      userId: authResult.user.id,
      flagKey: flag.key,
      flagId: flag.id,
    });

    return createSuccessResponse(
      {
        flag,
        message: 'Feature flag created successfully',
      },
      201
    );
  } catch (error) {
    logger.error('Failed to create feature flag', error as Error);
    return createErrorResponse('INTERNAL_SERVER_ERROR', {
      message: 'Failed to create feature flag',
      details: (error as Error).message,
    });
  }
}
