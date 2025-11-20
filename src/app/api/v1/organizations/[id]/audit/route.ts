// Organization Audit Logs API
import { z } from 'zod';
import { NextRequest } from 'next/server';

import { prisma } from '@app/database';

import { createApiHandler } from '../../../../lib/handlers/base';
import { commonSchemas } from '../../../../lib/utils/validation';
import { rateLimitConfigs } from '../../../../lib/middleware/rate-limit';
import { OrganizationService } from '../../../../lib/services/organization-service';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

// Validation schemas
const paramsSchema = z.object({
  id: commonSchemas.id,
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

// API handler
const handler = createApiHandler(
  {
    auth: {
      required: true,
    },
    rateLimit: rateLimitConfigs.standard,
    allowedMethods: ['GET'],
    validation: {
      params: paramsSchema,
    },
  },
  {
    // Get audit logs
    GET: async ({ routeParams, context, auth, request }) => {
      try {
        const organizationId = routeParams.id;

        // Check if user has access to this organization
        const isMember = await OrganizationService.isMember(auth.user?.id || '', organizationId);
        const isAdmin =
          auth.user?.roles?.includes('system-admin') ||
          auth.user?.roles?.includes('super-admin') ||
          auth.user?.roles?.includes('admin');

        const userRole = await OrganizationService.getUserRole(auth.user?.id || '', organizationId);
        const canViewAudit = isAdmin || userRole === 'OWNER' || userRole === 'ADMIN';

        if (!canViewAudit && !isMember) {
          return createErrorResponse(
            'FORBIDDEN',
            {
              message: 'You do not have permission to view audit logs for this organization',
            },
            context.requestId
          );
        }

        // Parse query parameters
        const url = new URL((request as NextRequest).url);
        const queryParams = Object.fromEntries(url.searchParams.entries());
        const { page, limit } = querySchema.parse(queryParams);

        // Fetch audit logs
        const skip = (page - 1) * limit;

        // Get all projects for this organization
        const projects = await prisma.project.findMany({
          where: {
            organizationId,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });

        const projectIds = projects.map((p) => p.id);

        // If no projects, return empty logs
        if (projectIds.length === 0) {
          return createSuccessResponse(
            {
              logs: [],
              total: 0,
              page,
              limit,
              pages: 0,
            },
            200,
            context.requestId
          );
        }

        // Fetch audit logs for all projects in this organization
        const [logs, total] = await Promise.all([
          prisma.auditLog.findMany({
            where: {
              projectId: {
                in: projectIds,
              },
            },
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                  photoURL: true,
                },
              },
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              timestamp: 'desc',
            },
            skip,
            take: limit,
          }),
          prisma.auditLog.count({
            where: {
              projectId: {
                in: projectIds,
              },
            },
          }),
        ]);

        return createSuccessResponse(
          {
            logs,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          },
          200,
          context.requestId
        );
      } catch (error) {
        console.error('Get audit logs error:', error);
        return createErrorResponse(
          'INTERNAL_SERVER_ERROR',
          {
            message: 'Failed to fetch audit logs',
          },
          context.requestId
        );
      }
    },
  }
);

export const GET = handler;
