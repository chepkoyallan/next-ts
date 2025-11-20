// Admin Feature Flag Detail API
import { z } from 'zod';

import { prisma } from '@app/database';

import { logger } from '../../../../lib/utils/logger';
import { createApiHandler } from '../../../../lib/handlers/base';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schemas
const updateFeatureFlagSchema = z.object({
  key: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(['BOOLEAN', 'PERCENTAGE', 'WHITELIST', 'DATE_RANGE', 'ENVIRONMENT']).optional(),
  enabled: z.boolean().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional().nullable(),
  enabledFrom: z.string().datetime().optional().nullable(),
  enabledUntil: z.string().datetime().optional().nullable(),
  environments: z.array(z.string()).optional().nullable(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  dependsOn: z.array(z.string()).optional().nullable(),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
      roles: ['admin', 'system-admin', 'super-admin'],
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET', 'PUT', 'DELETE'],
  },
  {
    // Get single feature flag
    GET: async ({ context, params }) => {
      try {
        const { id } = params!;

        const flag = await prisma.featureFlag.findUnique({
          where: { id },
          include: {
            overrides: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
            auditLogs: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
            _count: {
              select: {
                overrides: true,
                auditLogs: true,
              },
            },
          },
        });

        if (!flag) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Feature flag not found' },
            context.requestId
          );
        }

        logger.info('Admin: Feature flag retrieved', {
          flagId: flag.id,
          key: flag.key,
          requestId: context.requestId,
          userId: (context as any).auth?.user?.id,
        });

        return createSuccessResponse({ flag }, 200, context.requestId);
      } catch (error) {
        logger.error('Admin: Failed to retrieve feature flag', error as Error, {
          requestId: context.requestId,
          flagId: params!.id,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to retrieve feature flag' },
          context.requestId
        );
      }
    },

    // Update feature flag
    PUT: async ({ body, context, params, auth }) => {
      try {
        const { id } = params!;

        const validation = updateFeatureFlagSchema.safeParse(body);

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

        const updateData = validation.data;

        // Check if flag exists
        const existingFlag = await prisma.featureFlag.findUnique({
          where: { id },
        });

        if (!existingFlag) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Feature flag not found' },
            context.requestId
          );
        }

        // If key is being changed, check for conflicts
        if (updateData.key && updateData.key !== existingFlag.key) {
          const conflictFlag = await prisma.featureFlag.findUnique({
            where: { key: updateData.key },
          });

          if (conflictFlag) {
            return createErrorResponse(
              'RESOURCE_CONFLICT',
              { message: `Feature flag with key "${updateData.key}" already exists` },
              context.requestId
            );
          }
        }

        // Update feature flag
        const updatedFlag = await prisma.featureFlag.update({
          where: { id },
          data: {
            ...(updateData.key && { key: updateData.key }),
            ...(updateData.name && { name: updateData.name }),
            ...(updateData.description !== undefined && { description: updateData.description }),
            ...(updateData.type && { type: updateData.type as any }),
            ...(updateData.enabled !== undefined && { enabled: updateData.enabled }),
            ...(updateData.rolloutPercentage !== undefined && {
              rolloutPercentage: updateData.rolloutPercentage,
            }),
            ...(updateData.enabledFrom !== undefined && {
              enabledFrom: updateData.enabledFrom ? new Date(updateData.enabledFrom) : null,
            }),
            ...(updateData.enabledUntil !== undefined && {
              enabledUntil: updateData.enabledUntil ? new Date(updateData.enabledUntil) : null,
            }),
            ...(updateData.environments !== undefined && {
              environments: updateData.environments as any,
            }),
            ...(updateData.category !== undefined && { category: updateData.category }),
            ...(updateData.tags !== undefined && { tags: updateData.tags as any }),
            ...(updateData.dependsOn !== undefined && { dependsOn: updateData.dependsOn as any }),
            updatedBy: auth.user!.id,
          },
        });

        // Create audit log
        await prisma.featureFlagAuditLog.create({
          data: {
            flagId: updatedFlag.id,
            action: 'updated',
            previousValue: existingFlag as any,
            newValue: updatedFlag as any,
            userId: auth.user!.id,
            ipAddress: (context as any).ipAddress,
            userAgent: context.userAgent,
          },
        });

        logger.info('Admin: Feature flag updated', {
          flagId: updatedFlag.id,
          key: updatedFlag.key,
          changes: Object.keys(updateData),
          requestId: context.requestId,
          userId: auth.user!.id,
        });

        return createSuccessResponse(
          {
            flag: updatedFlag,
            message: 'Feature flag updated successfully',
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Admin: Failed to update feature flag', error as Error, {
          requestId: context.requestId,
          flagId: params!.id,
          userId: auth.user!.id,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to update feature flag' },
          context.requestId
        );
      }
    },

    // Delete feature flag
    DELETE: async ({ context, params, auth }) => {
      try {
        const { id } = params!;

        // Check if flag exists
        const existingFlag = await prisma.featureFlag.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                overrides: true,
              },
            },
          },
        });

        if (!existingFlag) {
          return createErrorResponse(
            'RESOURCE_NOT_FOUND',
            { message: 'Feature flag not found' },
            context.requestId
          );
        }

        // Create audit log before deletion
        await prisma.featureFlagAuditLog.create({
          data: {
            flagId: existingFlag.id,
            action: 'deleted',
            previousValue: existingFlag as any,
            newValue: null as any,
            userId: auth.user!.id,
            ipAddress: (context as any).ipAddress,
            userAgent: context.userAgent,
          },
        });

        // Delete feature flag (cascades to overrides and audit logs)
        await prisma.featureFlag.delete({
          where: { id },
        });

        logger.info('Admin: Feature flag deleted', {
          flagId: existingFlag.id,
          key: existingFlag.key,
          overrideCount: existingFlag._count.overrides,
          requestId: context.requestId,
          userId: auth.user!.id,
        });

        return createSuccessResponse(
          {
            message: 'Feature flag deleted successfully',
            deletedFlag: {
              id: existingFlag.id,
              key: existingFlag.key,
              name: existingFlag.name,
            },
          },
          200,
          context.requestId
        );
      } catch (error) {
        logger.error('Admin: Failed to delete feature flag', error as Error, {
          requestId: context.requestId,
          flagId: params!.id,
          userId: auth.user!.id,
        });

        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          { message: 'Failed to delete feature flag' },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
export const PUT = handler;
export const DELETE = handler;
