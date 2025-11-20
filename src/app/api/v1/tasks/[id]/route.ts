import { NextRequest, NextResponse } from 'next/server';

import { TaskService } from '../../../lib/services/task-service';
import { recordMetric } from '../../../lib/services/metrics-service';
import { getOrganizationContext } from '../../../lib/middleware/tenant-scope';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';

/**
 * GET /api/v1/tasks/:id
 * Get task definition by ID
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { organizationId } = await getOrganizationContext(request);
    const { id } = params;

    const task = await TaskService.getTask(id, organizationId);

    if (!task) {
      recordMetric({
        endpoint: '/api/v1/tasks/:id',
        method: 'GET',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Task not found', requestId), {
        status: 404,
      });
    }

    recordMetric({
      endpoint: '/api/v1/tasks/:id',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope({ task }, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching task:', error);

    recordMetric({
      endpoint: '/api/v1/tasks/:id',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch task', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/tasks/:id
 * Delete task definition
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { organizationId } = await getOrganizationContext(request);
    const { id } = params;

    const success = await TaskService.deleteTask(id, organizationId);

    if (!success) {
      recordMetric({
        endpoint: '/api/v1/tasks/:id',
        method: 'DELETE',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Task not found or already deleted', requestId),
        { status: 404 }
      );
    }

    recordMetric({
      endpoint: '/api/v1/tasks/:id',
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope({ message: 'Task deleted successfully' }, requestId),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting task:', error);

    recordMetric({
      endpoint: '/api/v1/tasks/:id',
      method: 'DELETE',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to delete task', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
