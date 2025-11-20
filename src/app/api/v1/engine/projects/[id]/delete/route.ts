/**
 * Engine API - Project Soft Delete
 * Soft delete projects
 */

import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@app/utils/logger';
import { ErrorMessages } from '@app/utils/error-messages';

import { isHeadlessMode } from 'src/app/api/lib/headless-mode';
import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import {
  requireSecureEngine,
  auditEngineOperation,
} from 'src/app/api/lib/services/engine-helper-rbac';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * DELETE /api/v1/engine/projects/:id/delete
 * Soft delete a project (mark as deleted, don't actually remove)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('projects', 'delete'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { userId, context } = result;
    const { organizationId } = context;

    if (!organizationId) {
      logger.warn('Organization ID missing in request context', {
        requestId,
        userId,
      });
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.ORGANIZATION_REQUIRED,
          code: 'ORGANIZATION_REQUIRED',
        },
        { status: 400 }
      );
    }

    const userProjectId = params.id;

    logger.info('Project deletion requested', {
      requestId,
      userId,
      organizationId,
      projectId: userProjectId,
    });

    // Verify ownership and get current project
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
      logger.warn('Project not found or access denied', {
        requestId,
        userId,
        organizationId,
        projectId: userProjectId,
      });

      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.PROJECT_NOT_FOUND,
          code: 'PROJECT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Check for active executions
    const activeExecutionsCount = await prisma.executionUsage.count({
      where: {
        projectId: userProjectId,
        status: 'RUNNING',
      },
    });

    if (activeExecutionsCount > 0) {
      logger.warn('Cannot delete project with active executions', {
        requestId,
        userId,
        projectId: userProjectId,
        activeExecutions: activeExecutionsCount,
      });

      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.PROJECT_HAS_ACTIVE_RESOURCES,
          code: 'ACTIVE_RESOURCES_EXIST',
          details: {
            activeExecutions: activeExecutionsCount,
          },
        },
        { status: 409 }
      );
    }

    logger.info('Soft deleting project', {
      requestId,
      projectId: userProjectId,
    });

    // Soft delete: mark as deleted with timestamp
    await prisma.project.update({
      where: { id: userProjectId },
      data: {
        deletedAt: new Date(),
        isArchived: true, // Also archive it
        flyteState: 1, // ARCHIVED state
        updatedAt: new Date(),
      },
    });

    logger.info('Project soft deleted successfully', {
      requestId,
      projectId: userProjectId,
    });

    // Audit log
    await auditEngineOperation(userId, 'project_deleted', 'projects', userProjectId, {
      name: project.name,
      deletionType: 'soft',
    });

    const duration = Date.now() - startTime;
    logger.info('Project deletion completed', {
      requestId,
      projectId: userProjectId,
      duration,
    });

    return NextResponse.json({
      success: true,
      message: `Project "${project.name}" has been deleted successfully`,
      data: {
        id: userProjectId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Project deletion failed', error, {
      requestId,
      projectId: params.id,
      duration,
    });

    return NextResponse.json(
      {
        success: false,
        error: ErrorMessages.SERVER_ERROR,
        code: 'DELETION_FAILED',
      },
      { status: 500 }
    );
  }
}
