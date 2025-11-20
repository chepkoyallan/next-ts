import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { getOrInitializeEngine } from 'src/app/api/lib/services/engine-helper';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * POST /api/v1/workflows/deployed/:id/undeploy
 * Undeploy a workflow from Flyte
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    const workflow = await prisma.workflowDraft.findUnique({
      where: { id: params.id },
    });

    if (!workflow) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Workflow not found', requestId), {
        status: 404,
      });
    }

    if (workflow.status !== 'deployed') {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Workflow is not deployed', requestId),
        { status: 400 }
      );
    }

    // In a real implementation, this would call Flyte Admin API to delete the workflow
    // For now, we'll just update the database status
    await getOrInitializeEngine();

    // Note: Flyte doesn't have a direct "delete workflow" API
    // Workflows are versioned and typically remain in the system
    // We'll mark it as undeployed in our database

    const updated = await prisma.workflowDraft.update({
      where: { id: params.id },
      data: {
        status: 'undeployed',
        metadata: {
          ...(workflow.metadata as any),
          undeployedAt: new Date().toISOString(),
          undeployedBy: userId,
        },
      },
    });

    recordMetric({
      endpoint: '/api/v1/workflows/deployed/:id/undeploy',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          id: updated.id,
          status: updated.status,
          message: 'Workflow undeployed successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error undeploying workflow:', error);

    recordMetric({
      endpoint: '/api/v1/workflows/deployed/:id/undeploy',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to undeploy workflow', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
