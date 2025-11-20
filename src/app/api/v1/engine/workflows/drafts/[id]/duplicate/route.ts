import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { workflowDraftService } from 'src/app/api/lib/services/workflow-draft-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * POST /api/v1/workflows/drafts/:id/duplicate
 * Duplicate a workflow draft
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    // Get the original draft
    const original = await workflowDraftService.getById(params.id);

    // Parse body for optional new name
    const body = await request.json().catch(() => ({}));
    const newName = body.name || `${original.name} (Copy)`;

    // Create duplicate
    const duplicate = await workflowDraftService.create(
      {
        name: newName,
        description: original.description,
        project: original.project,
        domain: original.domain,
        version: original.version,
        nodes: original.nodes as any,
        edges: original.edges as any,
        metadata: original.metadata as any,
      },
      userId,
      original.organizationId
    );

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id/duplicate',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(createSuccessEnvelope({ draft: duplicate }, requestId), {
      status: 201,
    });
  } catch (error: any) {
    console.error('Error duplicating workflow draft:', error);

    const statusCode = error.message.includes('not found') ? 404 : 500;

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id/duplicate',
      method: 'POST',
      statusCode,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        'Failed to duplicate workflow draft',
        requestId,
        { message: error.message }
      ),
      { status: statusCode }
    );
  }
}
