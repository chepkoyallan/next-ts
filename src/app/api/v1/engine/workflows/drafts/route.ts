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
 * GET /api/v1/workflows/drafts
 * List workflow drafts with optional filtering
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

    const { searchParams } = request.nextUrl;

    const filters = {
      organizationId, // Add organization filter
      project: searchParams.get('project') || undefined,
      domain: searchParams.get('domain') || undefined,
      status: searchParams.get('status') || undefined,
      createdBy: searchParams.get('createdBy') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0,
    };

    const draftResult = await workflowDraftService.list(filters);

    recordMetric({
      endpoint: '/api/v1/workflows/drafts',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          drafts: draftResult.drafts,
          total: draftResult.total,
          limit: filters.limit,
          offset: filters.offset,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error listing workflow drafts:', error);

    recordMetric({
      endpoint: '/api/v1/workflows/drafts',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to list workflow drafts', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/workflows/drafts
 * Create a new workflow draft
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    // Check authentication and get organization context
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('workflows', 'create'),
      checkSubscription: true,
      trackUsage: true,
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

    // Validate required fields
    if (!body.name || !body.project || !body.domain || !body.version) {
      recordMetric({
        endpoint: '/api/v1/workflows/drafts',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
        userId,
      });

      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'name, project, domain, and version are required',
          requestId
        ),
        { status: 400 }
      );
    }

    // Check tier limits for workflow creation
    const { checkTierLimit } = await import('src/app/api/lib/services/engine-helper-rbac');
    const tierCheck = await checkTierLimit(
      userId,
      context.subscriptionTier || 'free',
      'workflows',
      'create'
    );

    if (!tierCheck.allowed) {
      return NextResponse.json(
        createErrorEnvelope('TIER_LIMIT_EXCEEDED', tierCheck.reason || '', requestId, {
          upgradeUrl: tierCheck.upgradeUrl,
          current: tierCheck.current,
          limit: tierCheck.limit,
        }),
        { status: 402 }
      );
    }

    const draft = await workflowDraftService.create(
      {
        name: body.name,
        description: body.description,
        project: body.project,
        domain: body.domain,
        version: body.version,
        nodes: body.nodes || [],
        edges: body.edges || [],
        metadata: body.metadata,
      },
      userId,
      organizationId // Pass organization ID
    );

    recordMetric({
      endpoint: '/api/v1/workflows/drafts',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(createSuccessEnvelope({ draft }, requestId), { status: 201 });
  } catch (error: any) {
    console.error('Error creating workflow draft:', error);

    const statusCode = error.message.includes('validation') ? 400 : 500;

    recordMetric({
      endpoint: '/api/v1/workflows/drafts',
      method: 'POST',
      statusCode,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        error.message.includes('validation') ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        'Failed to create workflow draft',
        requestId,
        { message: error.message }
      ),
      { status: statusCode }
    );
  }
}
