/**
 * Validate Workflow Draft using Compiler V4
 *
 * GET /api/v1/engine/workflows/drafts/:id/validate-v4
 *
 * Validates the workflow draft without compiling or deploying.
 * Returns validation issues (errors, warnings, info).
 */

import { NextRequest, NextResponse } from 'next/server';

import { logger } from 'src/app/api/lib/utils/logger';
import { WorkflowCompilerServiceV4 } from 'src/app/api/lib/services/compiler-v4';
import { WorkflowDraftService } from 'src/app/api/lib/services/workflow-draft-service';

/**
 * Validate workflow draft with V4
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const draftId = params.id;

  try {
    logger.info('[ValidateV4] Validating workflow draft', { draftId });

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

    // Step 2: Validate the draft
    const serverBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    const compiler = new WorkflowCompilerServiceV4(serverBaseUrl);

    const validationResult = await compiler.validate(draft);

    // Step 3: Return validation result
    return NextResponse.json({
      success: true,
      data: {
        draftId,
        draft: {
          id: draft.id,
          name: draft.name,
          project: draft.project,
          domain: draft.domain,
          version: draft.version,
          nodeCount: draft.nodes.length,
          edgeCount: draft.edges.length,
        },
        validation: {
          valid: validationResult.valid,
          errorCount: validationResult.errors.length,
          warningCount: validationResult.warnings.length,
          infoCount: validationResult.infos.length,
          issues: validationResult.issues,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: draftId,
        compiler: 'v4',
      },
    });
  } catch (error) {
    logger.error('[ValidateV4] Draft validation failed', error as Error, { draftId });

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
