import { NextRequest, NextResponse } from 'next/server';

import { TaskService } from '../../../../lib/services/task-service';
import { recordMetric } from '../../../../lib/services/metrics-service';
import { getOrganizationContext } from '../../../../lib/middleware/tenant-scope';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';

/**
 * PUT /api/v1/tasks/:id/dependencies
 * Update task dependencies (base image and extra packages)
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { organizationId } = await getOrganizationContext(request);
    const { id } = params;
    const body = await request.json();

    // Validate required fields
    if (!body.baseImage) {
      recordMetric({
        endpoint: '/api/v1/tasks/:id/dependencies',
        method: 'PUT',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Base image is required', requestId),
        { status: 400 }
      );
    }

    const task = await TaskService.updateDependencies(
      id,
      organizationId,
      body.baseImage,
      body.extraDependencies || []
    );

    recordMetric({
      endpoint: '/api/v1/tasks/:id/dependencies',
      method: 'PUT',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          task,
          message: 'Task dependencies updated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating task dependencies:', error);

    recordMetric({
      endpoint: '/api/v1/tasks/:id/dependencies',
      method: 'PUT',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'UPDATE_ERROR',
        error.message || 'Failed to update task dependencies',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}
