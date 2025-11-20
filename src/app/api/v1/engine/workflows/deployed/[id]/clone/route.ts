import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * POST /api/v1/workflows/deployed/:id/clone
 * Clone a deployed workflow to a new draft
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    // Get the deployed workflow (which is stored as a draft with status='deployed')
    const deployedWorkflow = await prisma.workflowDraft.findUnique({
      where: { id: params.id },
    });

    if (!deployedWorkflow) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Deployed workflow not found', requestId),
        { status: 404 }
      );
    }

    if (deployedWorkflow.status !== 'deployed') {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Workflow is not deployed', requestId),
        { status: 400 }
      );
    }

    // Create new draft with same structure
    const newDraft = await prisma.workflowDraft.create({
      data: {
        name: `${deployedWorkflow.name} (Cloned)`,
        description: deployedWorkflow.description,
        project: deployedWorkflow.project,
        domain: deployedWorkflow.domain,
        version: deployedWorkflow.version,
        status: 'draft',
        nodes: deployedWorkflow.nodes as any,
        edges: deployedWorkflow.edges as any,
        metadata: {
          ...(deployedWorkflow.metadata as any),
          clonedFrom: deployedWorkflow.id,
          clonedFromWorkflowId: deployedWorkflow.workflowId,
          clonedAt: new Date().toISOString(),
        },
        createdBy: userId,
      },
    });

    recordMetric({
      endpoint: '/api/v1/workflows/deployed/:id/clone',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(createSuccessEnvelope({ draft: newDraft }, requestId), {
      status: 201,
    });
  } catch (error: any) {
    console.error('Error cloning deployed workflow:', error);

    recordMetric({
      endpoint: '/api/v1/workflows/deployed/:id/clone',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to clone deployed workflow', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
