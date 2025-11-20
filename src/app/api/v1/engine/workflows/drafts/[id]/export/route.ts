import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { createErrorEnvelope } from 'src/app/api/lib/middleware/transformation';
import { workflowDraftService } from 'src/app/api/lib/services/workflow-draft-service';

/**
 * GET /api/v1/workflows/drafts/:id/export
 * Export a workflow draft as JSON
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    const draft = await workflowDraftService.getById(params.id);

    // Create export format with all necessary data
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      workflow: {
        name: draft.name,
        description: draft.description,
        project: draft.project,
        domain: draft.domain,
        version: draft.version,
        nodes: draft.nodes,
        edges: draft.edges,
        metadata: draft.metadata,
      },
    };

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id/export',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    // Return as downloadable JSON file
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${draft.name.replace(/[^a-zA-Z0-9]/g, '_')}_${
          draft.version
        }.json"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting workflow draft:', error);

    const statusCode = error.message.includes('not found') ? 404 : 500;

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id/export',
      method: 'GET',
      statusCode,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        'Failed to export workflow draft',
        requestId,
        { message: error.message }
      ),
      { status: statusCode }
    );
  }
}
