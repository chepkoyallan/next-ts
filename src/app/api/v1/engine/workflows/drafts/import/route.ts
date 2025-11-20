import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';
import { workflowDraftService } from 'src/app/api/lib/services/workflow-draft-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * POST /api/v1/workflows/drafts/import
 * Import a workflow draft from JSON
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  let userId = 'system'; // Default for error handling

  try {
    // Check authentication and get organization context
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('workflows', 'create'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { userId: resultUserId, context } = result;
    userId = resultUserId;
    const { organizationId } = context;

    if (!organizationId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID not found', requestId),
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate export format
    if (!body.version || !body.workflow) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Invalid workflow export format', requestId, {
          message: 'Missing version or workflow data',
        }),
        { status: 400 }
      );
    }

    const { workflow } = body;

    // Validate required fields
    if (!workflow.name || !workflow.project || !workflow.domain) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Missing required workflow fields', requestId, {
          message: 'Name, project, and domain are required',
        }),
        { status: 400 }
      );
    }

    // Create new draft from imported data
    const draft = await workflowDraftService.create(
      {
        name: workflow.name,
        description: workflow.description || null,
        project: workflow.project,
        domain: workflow.domain,
        version: workflow.version || 'v1',
        nodes: workflow.nodes || [],
        edges: workflow.edges || [],
        metadata: workflow.metadata || {},
      },
      userId,
      organizationId
    );

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/import',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(createSuccessEnvelope({ draft }, requestId), {
      status: 201,
    });
  } catch (error: any) {
    console.error('Error importing workflow draft:', error);

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/import',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to import workflow draft', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
