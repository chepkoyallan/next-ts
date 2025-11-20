import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';
import { workflowDeploymentService } from 'src/app/api/lib/services/workflow-deployment-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * GET /api/v1/engine/workflows/deployed
 * List all deployed workflows with execution statistics
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    // Check authentication and get organization context
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('workflows', 'read'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { context } = result;
    const { organizationId } = context;

    if (!organizationId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID not found', requestId),
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const project = searchParams.get('project') || undefined;
    const domain = searchParams.get('domain') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Use deployment service to list workflows with organization filter
    const workflows = await workflowDeploymentService.listDeployed({
      organizationId, // Add organization filter
      project,
      domain,
      limit,
      offset,
    });

    recordMetric({
      endpoint: '/api/v1/engine/workflows/deployed',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          workflows,
          pagination: {
            total: workflows.length,
            limit,
            offset,
            hasMore: workflows.length === limit,
          },
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error listing deployed workflows:', error);

    recordMetric({
      endpoint: '/api/v1/engine/workflows/deployed',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to list deployed workflows', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
