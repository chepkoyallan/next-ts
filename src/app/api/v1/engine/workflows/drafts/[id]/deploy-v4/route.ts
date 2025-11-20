/**
 * Deploy Workflow Draft using Compiler V4
 *
 * POST /api/v1/engine/workflows/drafts/:id/deploy-v4
 *
 * Compiles and deploys the workflow to Flyte using V4 compiler.
 */

import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from 'src/app/api/lib/utils/logger';
import { getOrInitializeEngine } from 'src/app/api/lib/services/engine-helper';
import { WorkflowDraftService } from 'src/app/api/lib/services/workflow-draft-service';
import { FlyteWorkflowDeploymentServiceV4 } from 'src/app/api/lib/services/flyte-workflow-deployment-service-v4';

/**
 * Deploy workflow draft with V4
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const draftId = params.id;

  try {
    logger.info('[DeployV4] Deploying workflow draft', { draftId });

    // Parse request body for deployment options
    const body = await request.json().catch(() => ({}));
    const { autoVersion = true } = body;

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
            compiler: 'v4',
          },
        },
        { status: 404 }
      );
    }

    // Step 1.5: Generate unique version if autoVersion is enabled
    if (autoVersion) {
      const uniqueVersion = `v-${nanoid(10)}`;
      draft.version = uniqueVersion;
      logger.info('[DeployV4] Generated unique version', { version: uniqueVersion });
    }

    // Step 2: Get the engine manager and admin service
    const engineManager = await getOrInitializeEngine();
    if (!engineManager || !engineManager.services.admin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Flyte AdminService not available',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: draftId,
            compiler: 'v4',
          },
        },
        { status: 503 }
      );
    }

    // Step 3: Deploy the workflow
    const deploymentService = new FlyteWorkflowDeploymentServiceV4(engineManager.services.admin);

    const deploymentResult = await deploymentService.deployWorkflow({
      draft,
    });

    // Step 4: Return result
    if (!deploymentResult.success) {
      const errorCount = deploymentResult.errors?.length || 0;
      const errorMessage = new Error('Deployment failed');
      logger.error('[DeployV4] Deployment failed', errorMessage, {
        draftId,
        errors: errorCount,
      });

      return NextResponse.json(
        {
          success: false,
          error: deploymentResult.error || 'Deployment failed',
          errors: deploymentResult.errors,
          warnings: deploymentResult.warnings,
          compilationStats: deploymentResult.compilationStats,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: draftId,
            compiler: 'v4',
          },
        },
        { status: 400 }
      );
    }

    logger.info('[DeployV4] ✅ Deployment successful', {
      draftId,
      workflow: `${deploymentResult.workflowId.project}/${deploymentResult.workflowId.domain}/${deploymentResult.workflowId.name}:${deploymentResult.workflowId.version}`,
    });

    // Step 5: Update draft status to 'deployed' in database
    try {
      await WorkflowDraftService.update(
        draftId,
        {
          status: 'deployed',
          metadata: {
            ...(draft.metadata as any),
            deployment: {
              workflowId: `${deploymentResult.workflowId.project}/${deploymentResult.workflowId.domain}/${deploymentResult.workflowId.name}:${deploymentResult.workflowId.version}`,
              deployedAt: new Date().toISOString(),
              compiler: 'v4',
            },
          },
        },
        draft.createdBy || 'system',
        draft.organizationId || ''
      );
      logger.info('[DeployV4] Updated draft status to deployed', { draftId });
    } catch (updateError) {
      logger.error('[DeployV4] Failed to update draft status', updateError as Error, { draftId });
      // Don't fail the deployment if status update fails
    }

    return NextResponse.json({
      success: true,
      data: {
        draftId,
        workflowId: deploymentResult.workflowId,
        message: deploymentResult.message,
        compilationStats: deploymentResult.compilationStats,
        deploymentTimeMs: deploymentResult.deploymentTimeMs,
        warnings: deploymentResult.warnings,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: draftId,
        compiler: 'v4',
      },
    });
  } catch (error) {
    logger.error('[DeployV4] Deployment failed with exception', error as Error, { draftId });

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: draftId,
          compiler: 'v4',
        },
      },
      { status: 500 }
    );
  }
}
