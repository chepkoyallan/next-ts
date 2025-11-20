/**
 * Engine API - Workflow by ID
 * Get specific workflow details
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
const WorkflowIdSchema = z.string().regex(/^[^:]+:[^:]+:[^:]+(:[^:]+)?$/, {
  message: 'Invalid workflow ID format. Expected: project:domain:name[:version]',
});

/**
 * GET /api/v1/engine/workflows/:id
 * Get workflow by ID (format: project:domain:name:version)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'workflows',
      rbac: RBACDecorators.requirePermission('workflows', 'read'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager } = result;

    // Validate ID format
    const validationResult = WorkflowIdSchema.safeParse(params.id);
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

    const workflow = await engineManager.services.workflows!.getWorkflowById(
      project,
      domain,
      name,
      version || undefined
    );

    return NextResponse.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get workflow',
      },
      { status: 500 }
    );
  }
}
