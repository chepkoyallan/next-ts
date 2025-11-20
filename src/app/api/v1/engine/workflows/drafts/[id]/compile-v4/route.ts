/**
 * Compile Workflow Draft using Compiler V4
 *
 * GET /api/v1/engine/workflows/drafts/:id/compile-v4
 *
 * Tests the V4 compiler without deploying to Flyte.
 * Returns the compiled protobuf structure as JSON for inspection.
 */

import { NextRequest, NextResponse } from 'next/server';

import { logger } from 'src/app/api/lib/utils/logger';
import { WorkflowCompilerServiceV4 } from 'src/app/api/lib/services/compiler-v4';
import { WorkflowDraftService } from 'src/app/api/lib/services/workflow-draft-service';

/**
 * Compile workflow draft with V4 (test only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const draftId = params.id;

  try {
    logger.info('[CompileV4] Compiling workflow draft', { draftId });

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

    // Step 2: Compile the draft
    const serverBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    const compiler = new WorkflowCompilerServiceV4(serverBaseUrl, undefined, {
      includeDebugInfo: true, // Enable debug info for test endpoint
    });

    const compilationResult = await compiler.compile(draft);

    // Step 3: Build response
    if (!compilationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Compilation failed',
          errors: compilationResult.errors,
          warnings: compilationResult.warnings,
          stats: compilationResult.stats,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: draftId,
            compiler: 'v4',
          },
        },
        { status: 400 }
      );
    }

    // Step 4: Extract useful information for debugging
    const debugInfo = {
      workflowId: compilationResult.workflowId,
      stats: compilationResult.stats,
      nodes: compilationResult.closure?.primary?.template?.nodes?.map((node) => {
        let nodeType: string;
        if (node.taskNode) {
          nodeType = 'task';
        } else if (node.branchNode) {
          nodeType = 'branch';
        } else {
          nodeType = 'unknown';
        }

        return {
          id: node.id,
          type: nodeType,
          taskRef: node.taskNode?.referenceId
            ? `${node.taskNode.referenceId.project}/${node.taskNode.referenceId.domain}/${node.taskNode.referenceId.name}:${node.taskNode.referenceId.version}`
            : undefined,
          inputCount: node.inputs?.length || 0,
          inputs: node.inputs?.map((i) => i.var) || [],
          upstreamNodes: node.upstreamNodeIds?.length || 0,
          metadata: {
            name: node.metadata?.name,
            timeout: node.metadata?.timeout?.seconds,
            retries: node.metadata?.retries?.retries,
          },
        };
      }),
      interface: {
        inputs: Object.keys(
          compilationResult.closure?.primary?.template?.interface?.inputs?.variables || {}
        ),
        outputs: Object.keys(
          compilationResult.closure?.primary?.template?.interface?.outputs?.variables || {}
        ),
      },
      connections: {
        downstream: Object.keys(compilationResult.closure?.primary?.connections?.downstream || {}),
        upstream: Object.keys(compilationResult.closure?.primary?.connections?.upstream || {}),
      },
    };

    // Step 5: Return compilation result
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
        compilation: {
          stats: compilationResult.stats,
          workflowId: compilationResult.workflowId,
          debug: debugInfo,
          warnings: compilationResult.warnings,
        },
        // Include full closure for advanced debugging (optional)
        closure:
          request.nextUrl.searchParams.get('full') === 'true'
            ? compilationResult.closure
            : undefined,
        // Include debug info (node binding metadata, cache state)
        debugInfo: compilationResult.debug,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: draftId,
        compiler: 'v4',
      },
    });
  } catch (error) {
    logger.error('[CompileV4] Draft compilation failed', error as Error, { draftId });

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
