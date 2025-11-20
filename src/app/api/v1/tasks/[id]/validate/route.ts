import { NextRequest, NextResponse } from 'next/server';

import { TaskService } from '../../../../lib/services/task-service';
import { recordMetric } from '../../../../lib/services/metrics-service';
import { getOrganizationContext } from '../../../../lib/middleware/tenant-scope';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';

/**
 * POST /api/v1/tasks/:id/validate
 * Validate task code without saving
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { organizationId } = await getOrganizationContext(request);
    const { id } = params;
    const body = await request.json();

    // Optional: validate custom code, or use the saved code
    const code = body.code || undefined;

    const validation = await TaskService.validateTask(id, organizationId, code);

    recordMetric({
      endpoint: '/api/v1/tasks/:id/validate',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          validation,
          message: validation.valid ? 'Task code is valid' : 'Task code has validation errors',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error validating task:', error);

    recordMetric({
      endpoint: '/api/v1/tasks/:id/validate',
      method: 'POST',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'VALIDATION_ERROR',
        error.message || 'Failed to validate task',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}
