/**
 * Deploy Workflow Draft using Compiler V3 + gRPC
 *
 * POST /api/v1/engine/workflows/drafts/:id/deploy-v3
 *
 * Deploys a workflow draft to Flyte using:
 * - WorkflowCompilerServiceV3 (with inputData to Literal mapping)
 * - FlyteWorkflowDeploymentService (gRPC deployment)
 */

import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from 'src/app/api/lib/utils/logger';
import { getOrInitializeEngine } from 'src/app/api/lib/services/engine-helper';
import { WorkflowDraftService } from 'src/app/api/lib/services/workflow-draft-service';
import { FlyteWorkflowDeploymentService } from 'src/app/api/lib/services/flyte-workflow-deployment-service';

/**
 * Deploy workflow draft using V3 compiler + gRPC
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const draftId = params.id;

  try {
    logger.info('Deploying workflow draft (V3 + gRPC)', { draftId });

    // Step 1: Fetch the draft
    const draft = await WorkflowDraftService.getById(draftId);

    if (!draft) {
      return NextResponse.json(
        {
          success: false,
          error: 'Draft not found',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: draftId,
            version: 'v3',
          },
        },
        { status: 404 }
      );
    }

    // Step 2: Parse request body for deployment spec
    const body = await request.json().catch(() => ({}));
    const { autoVersion = true } = body;
    const spec = {
      description: body.description || `Workflow ${draft.name} deployed via V3 compiler`,
      labels: body.labels || {
        'deployed-by': 'compiler-v3',
        'deployment-method': 'grpc',
      },
      annotations: body.annotations || {},
    };

    // Step 2.5: Generate unique version if autoVersion is enabled
    if (autoVersion) {
      const uniqueVersion = `v-${nanoid(10)}`;
      draft.version = uniqueVersion;
      logger.info('[DeployV3] Generated unique version', { version: uniqueVersion });
    }

    // Step 3: Get the engine manager and admin service
    const engineManager = await getOrInitializeEngine();
    if (!engineManager || !engineManager.services.admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin service not available',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: draftId,
            version: 'v3',
          },
        },
        { status: 503 }
      );
    }

    // Step 4: Create deployment service with admin service
    const deploymentService = new FlyteWorkflowDeploymentService(engineManager.services.admin);
    logger.info('Deploying workflow via V3 compiler + gRPC...');

    // Step 5: Deploy the workflow
    const deploymentResult = await deploymentService.deployWorkflow({
      draft,
      spec,
    });

    if (!deploymentResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: deploymentResult.error || 'Deployment failed',
          details: deploymentResult,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: draftId,
            version: 'v3',
          },
        },
        { status: 500 }
      );
    }

    // Step 5: Update draft status in database (optional - can be done separately)
    // Note: WorkflowDraftService.update requires userId and organizationId
    // For now, skip the update or implement it with proper auth context

    // Step 6: Return success response
    return NextResponse.json({
      success: true,
      data: {
        draftId,
        workflowId: deploymentResult.workflowId,
        message: deploymentResult.message,
        stats: deploymentResult.compilationStats,
        deployment: {
          project: draft.project,
          domain: draft.domain,
          name: draft.name,
          version: draft.version,
          method: 'grpc',
          compiler: 'v3',
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: draftId,
        version: 'v3',
      },
    });
  } catch (error) {
    logger.error('Draft deployment failed (V3)', error as Error, { draftId });

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: draftId,
          version: 'v3',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Get deployment status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const draftId = params.id;

  try {
    logger.info('Checking deployment status', { draftId });

    // Get the draft
    const draft = await WorkflowDraftService.getById(draftId);

    if (!draft) {
      return NextResponse.json(
        {
          success: false,
          error: 'Draft not found',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: draftId,
            version: 'v3',
          },
        },
        { status: 404 }
      );
    }

    // Check if workflow exists in Flyte
    logger.info('Checking workflow existence in Flyte...');
    let exists = false;
    try {
      const engineManager = await getOrInitializeEngine();
      if (engineManager && engineManager.services.admin) {
        const deploymentService = new FlyteWorkflowDeploymentService(engineManager.services.admin);
        exists = await deploymentService.workflowExists(
          draft.project,
          draft.domain,
          draft.name,
          draft.version
        );
      } else {
        logger.warn('Admin service not available for workflow existence check');
      }
    } catch (checkError) {
      logger.warn('Could not check workflow existence', {
        error: (checkError as Error).message,
      });
      // exists will remain false
    }

    return NextResponse.json({
      success: true,
      data: {
        draftId,
        draft: {
          id: draft.id,
          name: draft.name,
          status: draft.status,
          deployedAt: draft.deployedAt,
          deployedBy: draft.deployedBy,
        },
        deployment: {
          exists,
          project: draft.project,
          domain: draft.domain,
          name: draft.name,
          version: draft.version,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: draftId,
        version: 'v3',
      },
    });
  } catch (error) {
    logger.error('Failed to check deployment status', error as Error, { draftId });

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: draftId,
          version: 'v3',
        },
      },
      { status: 500 }
    );
  }
}
