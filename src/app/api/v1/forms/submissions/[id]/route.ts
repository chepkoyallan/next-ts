import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../../lib/services/metrics-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';
import {
  getSubmission,
  updateSubmission,
  deleteSubmission,
} from '../../../../lib/services/form-generation-service';

/**
 * GET /api/v1/forms/submissions/[id]
 * Get a specific form submission by ID
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { id } = params;

    if (!id) {
      recordMetric({
        endpoint: '/api/v1/forms/submissions/[id]',
        method: 'GET',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Submission ID is required', requestId),
        { status: 400 }
      );
    }

    const submission = getSubmission(id);

    if (!submission) {
      recordMetric({
        endpoint: '/api/v1/forms/submissions/[id]',
        method: 'GET',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Form submission not found', requestId),
        { status: 404 }
      );
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/submissions/[id]',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope({ submission }, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching form submission:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/submissions/[id]',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch form submission', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/forms/submissions/[id]
 * Update a form submission
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const traceId = request.headers.get('x-trace-id') || undefined;

  try {
    const { id } = params;
    const body = await request.json();

    if (!id) {
      recordMetric({
        endpoint: '/api/v1/forms/submissions/[id]',
        method: 'PUT',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Submission ID is required', requestId),
        { status: 400 }
      );
    }

    if (!body.data) {
      recordMetric({
        endpoint: '/api/v1/forms/submissions/[id]',
        method: 'PUT',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Form data is required', requestId),
        { status: 400 }
      );
    }

    // Check if submission exists
    const existingSubmission = getSubmission(id);
    if (!existingSubmission) {
      recordMetric({
        endpoint: '/api/v1/forms/submissions/[id]',
        method: 'PUT',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Form submission not found', requestId),
        { status: 404 }
      );
    }

    const updatedSubmission = await updateSubmission(id, body.data, traceId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/submissions/[id]',
      method: 'PUT',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          submission: updatedSubmission,
          message: 'Form submission updated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating form submission:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/submissions/[id]',
      method: 'PUT',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'UPDATE_ERROR',
        error.message || 'Failed to update form submission',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/v1/forms/submissions/[id]
 * Delete a form submission
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const traceId = request.headers.get('x-trace-id') || undefined;

  try {
    const { id } = params;

    if (!id) {
      recordMetric({
        endpoint: '/api/v1/forms/submissions/[id]',
        method: 'DELETE',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Submission ID is required', requestId),
        { status: 400 }
      );
    }

    // Check if submission exists
    const existingSubmission = getSubmission(id);
    if (!existingSubmission) {
      recordMetric({
        endpoint: '/api/v1/forms/submissions/[id]',
        method: 'DELETE',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Form submission not found', requestId),
        { status: 404 }
      );
    }

    await deleteSubmission(id, traceId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/submissions/[id]',
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Form submission deleted successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting form submission:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/submissions/[id]',
      method: 'DELETE',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'DELETE_ERROR',
        error.message || 'Failed to delete form submission',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}
