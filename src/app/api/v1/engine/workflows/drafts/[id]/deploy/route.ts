import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';
import {
  DeploymentConfig,
  workflowDeploymentService,
} from 'src/app/api/lib/services/workflow-deployment-service';

/**
 * POST /api/v1/engine/workflows/drafts/:id/deploy
 * Deploy a workflow draft to Flyte with protobuf compilation
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  console.log('='.repeat(80));
  console.log(`[DeployRoute] ===== WORKFLOW DEPLOYMENT STARTED =====`);
  console.log(`[DeployRoute] Draft ID: ${params.id}`);
  console.log(`[DeployRoute] User ID: ${userId}`);
  console.log(`[DeployRoute] Request ID: ${requestId}`);
  console.log('='.repeat(80));

  // Get authorization token from request
  const authToken = request.headers.get('authorization') || request.headers.get('x-auth-token');

  try {
    // Parse deployment configuration from request body
    const body = await request.json().catch(() => ({}));
    const config: DeploymentConfig = {
      autoVersion: body.autoVersion !== undefined ? body.autoVersion : true,
      version: body.version,
      labels: body.labels,
      annotations: body.annotations,
      notifications: body.notifications,
      resourceLimits: body.resourceLimits,
    };

    // Deploy workflow with protobuf compilation (pass auth token)
    console.log(`[DeployRoute] Deploying workflow draft: ${params.id}`);
    const result = await workflowDeploymentService.deploy(
      params.id,
      config,
      userId,
      authToken || undefined
    );

    console.log(`[DeployRoute] Deployment result:`, {
      success: result.success,
      error: result.error,
      details: result.details,
    });

    const statusCode = result.success ? 200 : 400;

    recordMetric({
      endpoint: '/api/v1/engine/workflows/drafts/:id/deploy',
      method: 'POST',
      statusCode,
      responseTime: Date.now() - startTime,
      userId,
    });

    if (!result.success) {
      console.error(`[DeployRoute] Deployment failed:`, result.error);
      return NextResponse.json(
        createErrorEnvelope('DEPLOYMENT_ERROR', result.error || 'Deployment failed', requestId, {
          details: result.details,
        }),
        { status: statusCode }
      );
    }

    return NextResponse.json(
      createSuccessEnvelope(
        {
          workflowId: result.workflowId,
          version: result.version,
          details: result.details,
          message: 'Workflow deployed successfully',
        },
        requestId
      ),
      { status: statusCode }
    );
  } catch (error: any) {
    console.error('Error deploying workflow:', error);

    recordMetric({
      endpoint: '/api/v1/engine/workflows/drafts/:id/deploy',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to deploy workflow', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/engine/workflows/drafts/:id/deploy
 * Get deployment status
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    const statusInfo = await workflowDeploymentService.getDeploymentStatus(params.id);

    recordMetric({
      endpoint: '/api/v1/engine/workflows/drafts/:id/deploy',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(createSuccessEnvelope(statusInfo, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error getting deployment status:', error);

    recordMetric({
      endpoint: '/api/v1/engine/workflows/drafts/:id/deploy',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to get deployment status', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
