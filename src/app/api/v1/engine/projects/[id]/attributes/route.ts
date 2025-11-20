/**
 * Engine API - Project Attributes
 * Get and update project attributes
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

interface RouteParams {
  params: {
    id: string;
  };
}

// Project attributes schema
const ProjectAttributesSchema = z.object({
  matchingAttributes: z
    .object({
      domain: z.string().optional(),
      project: z.string().optional(),
      workflow: z.string().optional(),
      launchPlan: z.string().optional(),
    })
    .optional(),
  resourceAttributes: z
    .object({
      requests: z
        .object({
          cpu: z.string().optional(),
          memory: z.string().optional(),
          storage: z.string().optional(),
          gpu: z.string().optional(),
        })
        .optional(),
      limits: z
        .object({
          cpu: z.string().optional(),
          memory: z.string().optional(),
          storage: z.string().optional(),
          gpu: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  executionQueueAttributes: z
    .object({
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  executionClusterLabel: z
    .object({
      value: z.string().optional(),
    })
    .optional(),
  qualityOfService: z
    .object({
      tier: z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNDEFINED']).optional(),
      spec: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
  pluginOverrides: z.array(z.record(z.string(), z.any())).optional(),
});

const UpdateAttributesSchema = z.object({
  attributes: ProjectAttributesSchema,
});

/**
 * GET /api/v1/engine/projects/:id/attributes
 * Get project attributes
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

    const projectId = params.id;

    // Get project from database
    const { prisma } = await import('src/lib/prisma');

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
        },
        { status: 404 }
      );
    }

    // Get attributes from project metadata
    const metadata = (project.metadata as any) || {};
    const attributes = metadata.attributes || {};

    return NextResponse.json({
      success: true,
      data: attributes,
    });
  } catch (error) {
    console.error('Error getting project attributes:', error);

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

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get project attributes',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/engine/projects/:id/attributes
 * Update project attributes
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

    const { userId, context } = result;
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

    const projectId = params.id;

    // Validate request body
    const body = await request.json();
    const validatedData = UpdateAttributesSchema.parse(body);

    // Get project from database
    const { prisma } = await import('src/lib/prisma');

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
        },
        { status: 404 }
      );
    }

    // Update project metadata with new attributes
    const currentMetadata = (project.metadata as any) || {};
    const updatedMetadata = {
      ...currentMetadata,
      attributes: validatedData.attributes,
    };

    await prisma.project.update({
      where: { id: projectId },
      data: {
        metadata: updatedMetadata,
      },
    });

    // Track usage for billing
    await trackEngineUsage(userId, 'project-attributes-update', 1, {
      projectId,
    });

    // Audit log
    await auditEngineOperation(userId, 'project_attributes_updated', 'projects', projectId, {
      attributes: validatedData.attributes,
    });

    return NextResponse.json({
      success: true,
      data: validatedData.attributes,
      message: 'Project attributes updated successfully',
    });
  } catch (error) {
    console.error('Error updating project attributes:', error);

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

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update project attributes',
      },
      { status: 500 }
    );
  }
}
