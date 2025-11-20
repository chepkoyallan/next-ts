/**
 * Engine API - Single Project Operations
 * Get and update specific project details
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { isHeadlessMode } from 'src/app/api/lib/headless-mode';
import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import {
  trackEngineUsage,
  requireSecureEngine,
  auditEngineOperation,
} from 'src/app/api/lib/services/engine-helper-rbac';

import { ProjectUpdateRequestSchema } from '../../schemas';

interface RouteParams {
  params: {
    id: string;
  };
}

// ID validation schema
const ProjectIdSchema = z.string().min(1, 'Project ID is required');

/**
 * GET /api/v1/engine/projects/:id
 * Get a specific project by ID (with ownership verification)
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

    // Validate project ID
    const validationResult = ProjectIdSchema.safeParse(params.id);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const userProjectId = params.id;

    // Verify ownership through database
    const { prisma } = await import('src/lib/prisma');

    // In headless mode, skip organization check
    const project = await prisma.project.findFirst({
      where: {
        id: userProjectId,
        ...(isHeadlessMode() ? {} : { organizationId }),
        deletedAt: null,
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found or access denied',
        },
        { status: 404 }
      );
    }

    // Return project data from database
    // Note: Flyte AdminService does not have a getProject method
    // All project data is already stored in the database
    return NextResponse.json({
      success: true,
      data: {
        id: project.id,
        name: project.name,
        description: project.description,
        state: project.flyteState,
        domains: project.flyteDomains as any,
        labels: (project.metadata as any)?.labels || {},
        createdAt: project.createdAt.toISOString(),
        // Include Flyte identifiers for debugging
        flyteProjectId: project.flyteProjectId,
        flyteOrgPrefix: project.flyteOrgPrefix,
      },
    });
  } catch (error) {
    console.error('Error getting project:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/engine/projects/:id
 * Update a project's metadata
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('projects', 'update'),
      checkSubscription: true,
      trackUsage: true,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId, context } = result;
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

    // Validate project ID
    const validationResult = ProjectIdSchema.safeParse(params.id);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const userProjectId = params.id;

    // Verify ownership through database
    const { prisma } = await import('src/lib/prisma');

    // In headless mode, skip organization check
    const project = await prisma.project.findFirst({
      where: {
        id: userProjectId,
        ...(isHeadlessMode() ? {} : { organizationId }),
        deletedAt: null,
      },
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found or access denied',
        },
        { status: 404 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = ProjectUpdateRequestSchema.parse(body);

    // Ensure project ID matches
    if (
      validatedData.project &&
      validatedData.project.id &&
      validatedData.project.id !== params.id
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project ID in body does not match URL parameter',
        },
        { status: 400 }
      );
    }

    // Set ID to Flyte project ID for update
    const projectData = {
      ...validatedData.project,
      id: project.flyteProjectId, // Use Flyte ID for backend
    };

    // Update project in Flyte
    const updateResult = await engineManager.services.admin!.updateProject({
      project: projectData,
    } as any);

    // Update database record
    await prisma.project.update({
      where: { id: userProjectId },
      data: {
        name: validatedData.project?.name || project.name,
        description: validatedData.project?.description,
        flyteState: validatedData.project?.state ?? project.flyteState,
        flyteDomains: validatedData.project?.domains
          ? (validatedData.project.domains as any)
          : project.flyteDomains,
      },
    });

    // Track usage for billing
    await trackEngineUsage(userId, 'project-update', 1, {
      projectId: params.id,
    });

    // Audit log
    await auditEngineOperation(userId, 'project_updated', 'projects', params.id, {
      name: projectData.name,
      description: projectData.description,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updateResult,
        id: userProjectId, // Return user-friendly ID
      },
      message: 'Project updated successfully',
    });
  } catch (error) {
    console.error('Error updating project:', error);

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
        error: error instanceof Error ? error.message : 'Failed to update project',
      },
      { status: 500 }
    );
  }
}
