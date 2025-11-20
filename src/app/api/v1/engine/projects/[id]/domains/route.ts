/**
 * Engine API - Project Domains
 * List and manage domains within a project
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { isHeadlessMode } from 'src/app/api/lib/headless-mode';
import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';

interface RouteParams {
  params: {
    id: string;
  };
}

// Query parameter schema
const DomainListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/v1/engine/projects/:id/domains
 * List all domains in a project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('projects', 'read'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { context } = result;
    const { organizationId } = context;

    if (!organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization ID not found',
        },
        { status: 400 }
      );
    }

    // Validate query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = DomainListQuerySchema.parse(queryParams);

    const projectId = params.id;

    // Get project from database to retrieve domains
    const { prisma } = await import('src/lib/prisma');

    // First, check if project exists at all (for debugging)
    const projectExists = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    console.log('DEBUG: Domain lookup', {
      requestedProjectId: projectId,
      contextOrganizationId: organizationId,
      projectExists: !!projectExists,
      projectOrgId: projectExists?.organizationId,
      mismatch: projectExists && projectExists.organizationId !== organizationId,
    });

    // In headless mode, skip organization check
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        ...(isHeadlessMode() ? {} : { organizationId }),
        deletedAt: null,
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found or access denied',
          debug: {
            projectId,
            contextOrganizationId: organizationId,
            projectExists: !!projectExists,
            projectActualOrgId: projectExists?.organizationId,
          },
        },
        { status: 404 }
      );
    }

    // Get domains from database (stored as flyteDomains)
    let domains = (project.flyteDomains as any[]) || [];

    // If no domains configured, return standard development domains
    if (domains.length === 0) {
      domains = [
        { id: 'development', name: 'Development' },
        { id: 'staging', name: 'Staging' },
        { id: 'production', name: 'Production' },
      ];
    }

    // Apply pagination
    const { limit, offset } = validatedQuery;
    const paginatedDomains = domains.slice(offset, offset + limit);
    const hasMore = offset + limit < domains.length;

    return NextResponse.json({
      success: true,
      data: {
        domains: paginatedDomains,
        pagination: {
          total: domains.length,
          limit,
          offset,
          hasMore,
        },
      },
    });
  } catch (error) {
    console.error('Error listing project domains:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    // Handle not found errors
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: `Project '${params.id}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list domains',
      },
      { status: 500 }
    );
  }
}
