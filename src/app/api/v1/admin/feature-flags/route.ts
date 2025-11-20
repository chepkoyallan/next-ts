// Admin Feature Flags Management API
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../lib/utils/logger';
import { createApiHandler } from '../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../lib/utils/response';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schemas
const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(['BOOLEAN', 'PERCENTAGE', 'WHITELIST', 'DATE_RANGE', 'ENVIRONMENT']),
  enabled: z.boolean().default(false),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  enabledFrom: z.string().datetime().optional(),
  enabledUntil: z.string().datetime().optional(),
  environments: z.array(z.string()).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dependsOn: z.array(z.string()).optional(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
      roles: ['admin', 'system-admin', 'super-admin'],
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'POST'],
  },
  {
    // List all feature flags with optional filters
    GET: async ({ context, request }) => {
      try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || undefined;
        const category = searchParams.get('category') || undefined;
        const enabled = searchParams.get('enabled');
        const type = searchParams.get('type') || undefined;

        // Build where clause
        const where: any = {};

        if (search) {
          where.OR = [
            { key: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ];
        }

        if (category && category !== 'all') {
          where.category = category;
        }

        if (enabled !== null && enabled !== undefined && enabled !== 'all') {
          where.enabled = enabled === 'enabled' || enabled === 'true';
        }

        if (type) {
          where.type = type;
        }

        const flags = await prisma.featureFlag.findMany({
          where,
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
          include: {
            _count: {
              select: {
                overrides: true,
              },
            },
          },
        });

        logger.info('Admin: Feature flags listed', {
          count: flags.length,
          filters: { search, category, enabled, type },
          requestId: context.requestId,
          userId: (context as any).auth?.user?.id,
        });

        return createSuccessResponse(
          {
            flags: flags.map((flag) => ({
              ...flag,
              overrideCount: flag._count.overrides,
            })),
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Admin: Failed to list feature flags', error as Error, {
          requestId: context.requestId,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to list feature flags' },
          context.requestId
        );
      }
    },

    // Create new feature flag
    POST: async ({ body, context, auth }) => {
      try {
        const validation = createFeatureFlagSchema.safeParse(body);

        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            {
              message: 'Invalid feature flag data',
              errors: validation.error.issues,
            },
            context.requestId
          );
        }

        const flagData = validation.data;

        // Check if key already exists
        const existingFlag = await prisma.featureFlag.findUnique({
          where: { key: flagData.key },
        });

        if (existingFlag) {
          return createErrorResponse(
            'RESOURCE_CONFLICT',
            { message: `Feature flag with key "${flagData.key}" already exists` },
            context.requestId
          );
        }

        // Create feature flag
        const flag = await prisma.featureFlag.create({
          data: {
            key: flagData.key,
            name: flagData.name,
            description: flagData.description,
            type: flagData.type as any,
            enabled: flagData.enabled,
            rolloutPercentage: flagData.rolloutPercentage,
            enabledFrom: flagData.enabledFrom ? new Date(flagData.enabledFrom) : undefined,
            enabledUntil: flagData.enabledUntil ? new Date(flagData.enabledUntil) : undefined,
            environments: flagData.environments || undefined,
            category: flagData.category,
            tags: flagData.tags || undefined,
            dependsOn: flagData.dependsOn || undefined,
            createdBy: auth.user!.id,
            updatedBy: auth.user!.id,
          },
        });

        // Create audit log
        await prisma.featureFlagAuditLog.create({
          data: {
            flagId: flag.id,
            action: 'created',
            previousValue: null as any,
            newValue: flag as any,
            userId: auth.user!.id,
            ipAddress: (context as any).ipAddress,
            userAgent: context.userAgent,
          },
        });

        logger.info('Admin: Feature flag created', {
          flagId: flag.id,
          key: flag.key,
          requestId: context.requestId,
          userId: auth.user!.id,
        });

        return createSuccessResponse(
          {
            flag,
            message: 'Feature flag created successfully',
          },
          201,
          context.requestId
        );
      } catch (error) {
        logger.error('Admin: Failed to create feature flag', error as Error, {
          requestId: context.requestId,
          userId: auth.user!.id,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to create feature flag' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const POST = handler;
