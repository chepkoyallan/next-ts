/**
 * Compile Workflow Draft using Compiler V3 (Test Endpoint)
 *
 * GET /api/v1/engine/workflows/drafts/:id/compile-v3
 *
 * Tests the compiler without deploying to Flyte.
 * Returns the compiled protobuf structure as JSON for inspection.
 */

import { NextRequest, NextResponse } from 'next/server';

import { logger } from 'src/app/api/lib/utils/logger';
import { WorkflowDraftService } from 'src/app/api/lib/services/workflow-draft-service';
import { WorkflowCompilerServiceV3 } from 'src/app/api/lib/services/workflow-compiler-service-v3';

/**
 * Compile workflow draft (test only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const draftId = params.id;

  try {
    logger.info('Compiling workflow draft (V3 test)', { draftId });

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

    // Step 2: Compile the draft
    // Create compiler instance for server-side with localhost URL for API calls
    const serverBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';
    const compiler = new WorkflowCompilerServiceV3(serverBaseUrl);
    const compilationResult = await compiler.compile(draft);

    // Step 3: Extract useful information for debugging
    const debugInfo = {
      workflowId: compilationResult.id,
      stats: compilationResult.stats,
      nodes: compilationResult.closure.primary?.template?.nodes?.map((node) => {
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
          inputs: node.inputs?.length || 0,
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
          compilationResult.closure.primary?.template?.interface?.inputs?.variables || {}
        ),
        outputs: Object.keys(
          compilationResult.closure.primary?.template?.interface?.outputs?.variables || {}
        ),
      },
      connections: {
        downstream: Object.keys(compilationResult.closure.primary?.connections?.downstream || {}),
        upstream: Object.keys(compilationResult.closure.primary?.connections?.upstream || {}),
      },
    };

    // Step 4: Return compilation result
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
          workflowId: compilationResult.id,
          debug: debugInfo,
        },
        // Include full closure for advanced debugging (optional)
        closure:
          request.nextUrl.searchParams.get('full') === 'true'
            ? compilationResult.closure
            : undefined,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: draftId,
        version: 'v3',
        compiler: 'workflow-compiler-v3',
      },
    });
  } catch (error) {
    logger.error('Draft compilation failed (V3)', error as Error, { draftId });

    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message,
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined,
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
