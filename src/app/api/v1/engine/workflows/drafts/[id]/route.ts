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
 * GET /api/v1/workflows/drafts/:id
 * Get a workflow draft by ID
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    const draft = await workflowDraftService.getById(params.id, organizationId);

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(createSuccessEnvelope({ draft }, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching workflow draft:', error);

    const statusCode = error.message.includes('not found') ? 404 : 500;

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id',
      method: 'GET',
      statusCode,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        error.message.includes('not found') ? 'NOT_FOUND' : 'INTERNAL_ERROR',
        'Failed to fetch workflow draft',
        requestId,
        { message: error.message }
      ),
      { status: statusCode }
    );
  }
}

/**
 * PATCH /api/v1/workflows/drafts/:id
 * Update a workflow draft
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    // Check authentication and get organization context
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('workflows', 'update'),
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

    const body = await request.json();

    const draft = await workflowDraftService.update(params.id, body, userId, organizationId);

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id',
      method: 'PATCH',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(createSuccessEnvelope({ draft }, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error updating workflow draft:', error);

    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';

    if (error.message.includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (error.message.includes('validation')) {
      statusCode = 400;
      errorCode = 'VALIDATION_ERROR';
    } else if (error.message.includes('permission')) {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
    }

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id',
      method: 'PATCH',
      statusCode,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(errorCode, 'Failed to update workflow draft', requestId, {
        message: error.message,
      }),
      { status: statusCode }
    );
  }
}

/**
 * DELETE /api/v1/workflows/drafts/:id
 * Delete a workflow draft
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    // Check authentication and get organization context
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('workflows', 'delete'),
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

    await workflowDraftService.delete(params.id, userId, organizationId);

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id',
      method: 'DELETE',
      statusCode: 204,
      responseTime: Date.now() - startTime,
      userId,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('Error deleting workflow draft:', error);

    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';

    if (error.message.includes('not found')) {
      statusCode = 404;
      errorCode = 'NOT_FOUND';
    } else if (error.message.includes('permission')) {
      statusCode = 403;
      errorCode = 'FORBIDDEN';
    }

    recordMetric({
      endpoint: '/api/v1/workflows/drafts/:id',
      method: 'DELETE',
      statusCode,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(errorCode, 'Failed to delete workflow draft', requestId, {
        message: error.message,
      }),
      { status: statusCode }
    );
  }
}
