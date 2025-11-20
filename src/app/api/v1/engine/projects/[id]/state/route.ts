/**
 * Engine API - Project State Management
 * Archive and activate projects
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@app/utils/logger';
import { ErrorMessages } from '@app/utils/error-messages';

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

// State request body schema
const StateUpdateSchema = z.object({
  state: z.union([
    z.literal(0), // ACTIVE
    z.literal(1), // ARCHIVED
    z.literal(2), // SYSTEM_GENERATED
  ]),
});

/**
 * PATCH /api/v1/engine/projects/:id/state
 * Update project state (archive/activate)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('projects', 'update'),
      checkSubscription: true,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId, context } = result;
    const { organizationId } = context;

    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const validatedData = StateUpdateSchema.parse(body);

    const userProjectId = params.id;

    logger.info('Project state update requested', {
      requestId,
      userId,
      organizationId,
      projectId: userProjectId,
      newState: validatedData.state,
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

    // Check for active resources if archiving
    if (validatedData.state === 1) {
      // ARCHIVED
      const activeExecutions = await prisma.workflowExecution.count({
        where: {
          projectId: project.id,
          phase: { in: ['RUNNING', 'QUEUED'] },
        },
      });

      if (activeExecutions > 0) {
        logger.warn('Cannot archive project with active executions', {
          requestId,
          userId,
          projectId: userProjectId,
          activeExecutions,
        });

        return NextResponse.json(
          {
            success: false,
            error: ErrorMessages.PROJECT_HAS_ACTIVE_RESOURCES,
            code: 'ACTIVE_RESOURCES_EXIST',
            details: {
              activeExecutions,
            },
          },
          { status: 409 }
        );
      }
    }

    // Determine action labels
    let action = 'project_state_changed';
    let stateLabel = 'SYSTEM_GENERATED';

    if (validatedData.state === 1) {
      action = 'project_archived';
      stateLabel = 'ARCHIVED';
    } else if (validatedData.state === 0) {
      action = 'project_activated';
      stateLabel = 'ACTIVE';
    }

    logger.info(`Updating project state to ${stateLabel}`, {
      requestId,
      projectId: userProjectId,
      previousState: project.flyteState,
      newState: validatedData.state,
    });

    // Update database first (critical fix - was missing before)
    await prisma.project.update({
      where: { id: userProjectId },
      data: {
        flyteState: validatedData.state,
        isArchived: validatedData.state === 1,
        updatedAt: new Date(),
      },
    });

    logger.info('Database updated successfully', {
      requestId,
      projectId: userProjectId,
    });

    // Update Flyte (gracefully handle failures)
    let flyteUpdateResult = null;
    try {
      flyteUpdateResult = await engineManager.services.admin!.updateProject({
        project: {
          id: project.flyteProjectId,
          state: validatedData.state,
        },
      } as any);

      logger.info('Flyte updated successfully', {
        requestId,
        projectId: userProjectId,
      });
    } catch (flyteError) {
      // Log but don't fail the request - database is source of truth
      logger.error('Flyte update failed, but database is updated', flyteError, {
        requestId,
        projectId: userProjectId,
        flyteProjectId: project.flyteProjectId,
      });
    }

    // Track usage for billing
    await trackEngineUsage(userId, 'project-state-change', 1, {
      projectId: userProjectId,
      state: stateLabel,
    });

    // Audit log
    await auditEngineOperation(userId, action, 'projects', userProjectId, {
      state: validatedData.state,
      stateLabel,
      previousState: project.flyteState,
    });

    const duration = Date.now() - startTime;
    logger.info('Project state updated successfully', {
      requestId,
      projectId: userProjectId,
      duration,
    });

    return NextResponse.json({
      success: true,
      data: flyteUpdateResult || { state: validatedData.state },
      message: `Project ${stateLabel.toLowerCase()} successfully`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error updating project state', error, {
      requestId,
      projectId: params.id,
      duration,
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.VALIDATION_FAILED,
          code: 'VALIDATION_ERROR',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: ErrorMessages.PROJECT_UPDATE_FAILED,
        code: 'UPDATE_FAILED',
      },
      { status: 500 }
    );
  }
}
