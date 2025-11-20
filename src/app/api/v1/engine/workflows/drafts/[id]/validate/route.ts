import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { workflowDraftService } from 'src/app/api/lib/services/workflow-draft-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * POST /api/v1/workflows/drafts/:id/validate
 * Validate a workflow draft
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    // Get the draft
    const draft = await workflowDraftService.getById(params.id);

    // Validate
    const validationResult = await workflowDraftService.validate({
      name: draft.name,
      description: draft.description,
      project: draft.project,
      domain: draft.domain,
      version: draft.version,
      nodes: draft.nodes as any,
      edges: draft.edges as any,
      metadata: draft.metadata as any,
    });

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id/validate',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          valid: validationResult.valid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          summary: {
            totalErrors: validationResult.errors.length,
            totalWarnings: validationResult.warnings.length,
          },
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error validating workflow draft:', error);

    const statusCode = error.message.includes('not found') ? 404 : 500;

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id/validate',
      method: 'POST',
      statusCode,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        'Failed to validate workflow draft',
        requestId,
        { message: error.message }
      ),
      { status: statusCode }
    );
  }
}
