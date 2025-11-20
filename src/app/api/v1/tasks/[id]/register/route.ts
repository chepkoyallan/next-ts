import { NextRequest, NextResponse } from 'next/server';

import { TaskService } from '../../../../lib/services/task-service';
import { recordMetric } from '../../../../lib/services/metrics-service';
import { getOrganizationContext } from '../../../../lib/middleware/tenant-scope';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';

/**
 * POST /api/v1/tasks/:id/register
 * Register task to Flyte
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { organizationId } = await getOrganizationContext(request);
    const { id } = params;

    const result = await TaskService.registerTask(id, organizationId);

    if (!result.success) {
      recordMetric({
        endpoint: '/api/v1/tasks/:id/register',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
        error: result.error,
      });

      return NextResponse.json(
        createErrorEnvelope(
          'REGISTRATION_ERROR',
          result.error || 'Failed to register task',
          requestId
        ),
        { status: 400 }
      );
    }

    recordMetric({
      endpoint: '/api/v1/tasks/:id/register',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          flyteTaskId: result.flyteTaskId,
          message: 'Task registered successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error registering task:', error);

    recordMetric({
      endpoint: '/api/v1/tasks/:id/register',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'REGISTRATION_ERROR',
        error.message || 'Failed to register task',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 500 }
    );
  }
}
