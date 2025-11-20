/**
 * Engine API - Task by ID
 * Get specific task details
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';

interface RouteParams {
  params: {
    id: string;
  };
}

// ID format validation schema
const TaskIdSchema = z.string().regex(/^[^:]+:[^:]+:[^:]+(:[^:]+)?$/, {
  message: 'Invalid task ID format. Expected: project:domain:name[:version]',
});

/**
 * GET /api/v1/engine/tasks/:id
 * Get task by ID (format: project:domain:name:version)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'tasks',
      rbac: RBACDecorators.requirePermission('tasks', 'read'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager } = result;

    // Validate ID format
    const validationResult = TaskIdSchema.safeParse(params.id);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    // Parse ID format: project:domain:name:version
    const parts = params.id.split(':');

    const [project, domain, name, version] = parts;

    const task = await engineManager.services.tasks!.getTaskById(
      project,
      domain,
      name,
      version || undefined
    );

    return NextResponse.json({
      success: true,
      data: task,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get task',
      },
      { status: 500 }
    );
  }
}
