import { NextRequest, NextResponse } from 'next/server';

import { TaskService } from '../../../../lib/services/task-service';
import { recordMetric } from '../../../../lib/services/metrics-service';
import { getOrganizationContext } from '../../../../lib/middleware/tenant-scope';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';

/**
 * PUT /api/v1/tasks/:id/code
 * Update task code and run validation
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { organizationId } = await getOrganizationContext(request);
    const { id } = params;
    const body = await request.json();

    // Validate required fields
    if (!body.taskCode) {
      recordMetric({
        endpoint: '/api/v1/tasks/:id/code',
        method: 'PUT',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Task code is required', requestId),
        { status: 400 }
      );
    }

    // Update task code and validate
    const result = await TaskService.updateTaskCode(id, organizationId, {
      taskCode: body.taskCode,
    });

    recordMetric({
      endpoint: '/api/v1/tasks/:id/code',
      method: 'PUT',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          task: result.task,
          validation: result.validation,
          message: result.validation.valid
            ? 'Task code updated and validated successfully'
            : 'Task code updated with validation errors',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating task code:', error);

    recordMetric({
      endpoint: '/api/v1/tasks/:id/code',
      method: 'PUT',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'UPDATE_ERROR',
        error.message || 'Failed to update task code',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}
