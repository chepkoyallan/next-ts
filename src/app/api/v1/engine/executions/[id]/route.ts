/**
 * Engine API - Execution by ID
 * Get specific execution details and operations
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

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

// ID format validation schema
const ExecutionIdSchema = z.string().regex(/^[^:]+:[^:]+:[^:]+$/, {
  message: 'Invalid execution ID format. Expected: project:domain:name',
});

// Terminate request body schema
const TerminateBodySchema = z.object({
  reason: z.string().optional().default('Terminated via API'),
});

/**
 * GET /api/v1/engine/executions/:id
 * Get execution by ID (format: project:domain:name)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'workflows',
      rbac: RBACDecorators.requirePermission('executions', 'read'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager } = result;

    // Validate ID format
    const validationResult = ExecutionIdSchema.safeParse(params.id);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    // Parse ID format: project:domain:name
    const parts = params.id.split(':');

    const [project, domain, name] = parts;

    // Check if IO data is requested
    const { searchParams } = request.nextUrl;
    if (searchParams.get('io') === 'true') {
      const io = await engineManager.services.workflows!.getExecutionIO(project, domain, name);
      return NextResponse.json({
        success: true,
        data: io,
      });
    }

    // Get execution details
    const execution = await engineManager.services.workflows!.getExecutionByName(
      project,
      domain,
      name
    );

    // Fetch node executions for the workflow execution
    const nodeExecutionsResponse = await engineManager.services.workflows!.getNodeExecutions(
      project,
      domain,
      name
    );

    // Add node executions to the response
    const executionWithNodes = {
      ...execution,
      nodeExecutions: nodeExecutionsResponse.nodeExecutions || [],
    };

    return NextResponse.json({
      success: true,
      data: executionWithNodes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get execution',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/engine/executions/:id
 * Terminate an execution
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'workflows',
      rbac: RBACDecorators.requirePermission('executions', 'terminate'),
      checkSubscription: true,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId } = result;

    // Validate ID format
    const validationResult = ExecutionIdSchema.safeParse(params.id);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: validationResult.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    // Parse ID format: project:domain:name
    const parts = params.id.split(':');
    const [project, domain, name] = parts;

    // Validate request body
    const body = await request.json().catch(() => ({}));
    const validatedBody = TerminateBodySchema.parse(body);
    const { reason } = validatedBody;

    await engineManager.services.workflows!.terminateExecutionByName(project, domain, name, reason);

    // Audit log
    await auditEngineOperation(
      userId,
      'execution_terminated',
      'executions',
      `${project}:${domain}:${name}`,
      { reason }
    );

    return NextResponse.json({
      success: true,
      message: 'Execution terminated successfully',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to terminate execution',
      },
      { status: 500 }
    );
  }
}
