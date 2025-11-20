import { NextRequest, NextResponse } from 'next/server';

import { ApiResponse } from 'src/types/api';

/**
 * GET /api/v1/executions/recent
 *
 * Fetch recent executions for a workflow
 * Query params:
 *   - workflowId: string (format: project:domain:name:version)
 *   - limit: number (default: 5)
 *   - status: string (optional: 'SUCCESS', 'FAILED', etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    const statusFilter = searchParams.get('status');

    if (!workflowId) {
      return NextResponse.json<ApiResponse<any>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'workflowId is required',
          },
        },
        { status: 400 }
      );
    }

    // Parse workflow ID
    const [project, domain, name, version] = workflowId.split(':');

    if (!project || !domain || !name || !version) {
      return NextResponse.json<ApiResponse<any>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid workflowId format. Expected: project:domain:name:version',
          },
        },
        { status: 400 }
      );
    }

    // TODO: Implement actual Flyte API call to fetch recent executions
    // const flyteResponse = await fetch(
    //   `${FLYTE_ADMIN_URL}/api/v1/executions/${project}/${domain}?` +
    //   new URLSearchParams({
    //     'filters': `eq(launch_plan.name,${name})`,
    //     'limit': limit.toString(),
    //     'sort_by.key': 'created_at',
    //     'sort_by.direction': 'DESCENDING'
    //   })
    // );

    // Mock data for now
    const mockExecutions = [
      {
        id: 'exec-127',
        name: 'Run #127',
        workflowId: { project, domain, name, version },
        status: 'SUCCEEDED',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        duration: '5m 23s',
        inputs: {
          input_file: 's3://bucket/data.csv',
          batch_size: 100,
          enable_validation: true,
        },
      },
      {
        id: 'exec-126',
        name: 'Run #126',
        workflowId: { project, domain, name, version },
        status: 'SUCCEEDED',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
        duration: '4m 55s',
        inputs: {
          input_file: 's3://bucket/data_v2.csv',
          batch_size: 50,
          enable_validation: true,
        },
      },
      {
        id: 'exec-125',
        name: 'Run #125',
        workflowId: { project, domain, name, version },
        status: 'FAILED',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
        duration: '1m 12s',
        error: 'Input file not found',
        inputs: {
          input_file: 's3://bucket/invalid.csv',
          batch_size: 100,
          enable_validation: false,
        },
      },
    ];

    // Filter by status if provided
    const filteredExecutions = statusFilter
      ? mockExecutions.filter((exec) => exec.status === statusFilter)
      : mockExecutions;

    // Apply limit
    const limitedExecutions = filteredExecutions.slice(0, limit);

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: {
          executions: limitedExecutions,
          total: filteredExecutions.length,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching recent executions:', error);

    return NextResponse.json<ApiResponse<any>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to fetch recent executions',
        },
      },
      { status: 500 }
    );
  }
}
