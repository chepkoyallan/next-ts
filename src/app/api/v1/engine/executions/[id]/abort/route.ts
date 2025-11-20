import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { getOrInitializeEngine } from 'src/app/api/lib/services/engine-helper';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * POST /api/v1/engine/executions/:id/abort
 * Abort a running workflow execution
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    const executionId = params.id;

    // Get engine
    const engine = await getOrInitializeEngine();

    if (!engine) {
      return NextResponse.json(
        createErrorEnvelope('SERVICE_ERROR', 'Engine not available', requestId),
        { status: 503 }
      );
    }

    // Parse execution ID to get workflow execution name
    // Format: {project}:{domain}:{name}
    const parts = executionId.split(':');
    if (parts.length < 3) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Invalid execution ID format', requestId),
        { status: 400 }
      );
    }

    // Parse execution name parts (not currently used but kept for future implementation)
    // const project = parts[0];
    // const domain = parts[1];
    // const execName = parts.slice(2).join(':');

    // Note: Engine doesn't have terminateWorkflowExecution method - needs implementation
    // For now, update the database record
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { phase: 'ABORTED' },
    });

    recordMetric({
      endpoint: '/api/v1/engine/executions/:id/abort',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          executionId,
          status: 'aborted',
          message: 'Execution abort requested',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error aborting execution:', error);

    recordMetric({
      endpoint: '/api/v1/engine/executions/:id/abort',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to abort execution', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
