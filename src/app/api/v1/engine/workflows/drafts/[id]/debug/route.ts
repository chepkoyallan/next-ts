import { NextRequest, NextResponse } from 'next/server';

import { WorkflowDraftService } from 'src/app/api/lib/services/workflow-draft-service';

/**
 * GET /api/v1/engine/workflows/drafts/:id/debug
 * Get detailed workflow draft data for debugging
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const draftRecord = await WorkflowDraftService.getById(params.id);

    if (!draftRecord) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Parse nodes and edges from JSON (Prisma stores them as JSON)
    const nodes = (draftRecord.nodes as any) || [];
    const edges = (draftRecord.edges as any) || [];

    // Extract detailed info about each node
    const nodeDetails = nodes.map((node: any) => ({
      id: node.id,
      type: node.type,
      label: node.data.label,
      taskId: node.data.taskId,
      inputSchema: node.data.inputSchema
        ? {
            properties: Object.keys(node.data.inputSchema.properties || {}),
            required: node.data.inputSchema.required || [],
          }
        : null,
      outputSchema: node.data.outputSchema
        ? {
            properties: Object.keys(node.data.outputSchema.properties || {}),
          }
        : null,
      inputData: (node.data as any).inputData || {},
      config: node.data.config || {},
      branchConfig: node.data.branchConfig,
    }));

    const edgeDetails = edges.map((edge: any) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: edge.type,
      fieldMappings: edge.data?.fieldMappings || [],
    }));

    return NextResponse.json({
      id: draftRecord.id,
      name: draftRecord.name,
      description: draftRecord.description,
      version: draftRecord.version,
      project: draftRecord.project,
      domain: draftRecord.domain,
      status: draftRecord.status,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes: nodeDetails,
      edges: edgeDetails,
      metadata: draftRecord.metadata,
      createdBy: draftRecord.createdBy,
      createdAt: draftRecord.createdAt,
      updatedAt: draftRecord.updatedAt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
