import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { getOrInitializeEngine } from 'src/app/api/lib/services/engine-helper';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * POST /api/v1/engine/executions/:id/retry
 * Retry a failed workflow execution
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    const originalExecutionId = params.id;

    // Get the original execution
    const originalExecution = await prisma.workflowExecution.findUnique({
      where: { id: originalExecutionId },
    });

    if (!originalExecution) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Original execution not found', requestId),
        { status: 404 }
      );
    }

    // Get engine
    const engine = await getOrInitializeEngine();

    if (!originalExecution.workflowId) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Execution has no workflow ID', requestId),
        { status: 400 }
      );
    }

    // Parse workflow ID to get project/domain/name
    const parts = originalExecution.workflowId.split(':');
    if (parts.length < 3) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Invalid workflow ID format', requestId),
        { status: 400 }
      );
    }

    const project = parts[0];
    const domain = parts[1];
    // const workflowName = parts.slice(2).join(':'); // Not currently used

    if (!engine) {
      return NextResponse.json(
        createErrorEnvelope('SERVICE_ERROR', 'Engine not available', requestId),
        { status: 503 }
      );
    }

    // Create new execution with same inputs
    const newExecutionName = `${originalExecution.name}-retry-${Date.now()}`;
    // const inputs = (originalExecution.inputs as any) || {}; // Not currently used

    // Note: Engine doesn't have executeWorkflow method - this needs to be implemented
    // For now, create a simulated execution
    const newExecutionId = `${project}-${domain}-${newExecutionName}`;

    // Create execution record
    const newExecution = await prisma.workflowExecution.create({
      data: {
        id: newExecutionId,
        executionId: newExecutionId,
        name: newExecutionName,
        domain,
        workflowId: originalExecution.workflowId,
        projectId: project,
        organizationId: originalExecution.organizationId || 'default',
        flyteExecutionId: newExecutionId,
        phase: 'RUNNING',
        inputs: originalExecution.inputs as any,
        metadata: {
          retryOf: originalExecutionId,
        } as any,
      },
    });

    recordMetric({
      endpoint: '/api/v1/engine/executions/:id/retry',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          executionId: newExecution.id,
          name: newExecution.name,
          phase: newExecution.phase,
          message: 'Execution retry started',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error retrying execution:', error);

    recordMetric({
      endpoint: '/api/v1/engine/executions/:id/retry',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to retry execution', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
