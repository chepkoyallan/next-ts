import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * POST /api/v1/workflows/deployed/:id/archive
 * Archive a deployed workflow (soft delete)
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

    // Update status to archived
    const updated = await prisma.workflowDraft.update({
      where: { id: params.id },
      data: {
        status: 'archived',
        metadata: {
          ...(workflow.metadata as any),
          archivedAt: new Date().toISOString(),
          archivedBy: userId,
        },
      },
    });

    recordMetric({
      endpoint: '/api/v1/workflows/deployed/:id/archive',
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
          message: 'Workflow archived successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error archiving workflow:', error);

    recordMetric({
      endpoint: '/api/v1/workflows/deployed/:id/archive',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to archive workflow', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
