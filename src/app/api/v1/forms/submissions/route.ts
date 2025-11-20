import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../lib/services/metrics-service';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';
import {
  createSubmission,
  getAllSubmissions,
  CreateSubmissionInput,
} from '../../../lib/services/form-generation-service';

/**
 * GET /api/v1/forms/submissions
 * Get all form submissions with optional filtering
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { searchParams } = request.nextUrl;
    const assignmentId = searchParams.get('assignmentId') || undefined;
    const isValidParam = searchParams.get('isValid');
    const submittedBy = searchParams.get('submittedBy') || undefined;

    // Parse isValid parameter
    let isValid: boolean | undefined;
    if (isValidParam === 'true') {
      isValid = true;
    } else if (isValidParam === 'false') {
      isValid = false;
    }

    const allSubmissions = await getAllSubmissions({
      assignmentId,
      isValid,
      submittedBy,
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/submissions',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          submissions: allSubmissions,
          total: allSubmissions.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching form submissions:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/submissions',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch form submissions', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/forms/submissions
 * Create a new form submission (submit form data)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const traceId = request.headers.get('x-trace-id') || undefined;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.assignmentId) {
      recordMetric({
        endpoint: '/api/v1/forms/submissions',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Assignment ID is required', requestId),
        { status: 400 }
      );
    }

    if (!body.data) {
      recordMetric({
        endpoint: '/api/v1/forms/submissions',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Form data is required', requestId),
        { status: 400 }
      );
    }

    // Get user from headers (in production, from JWT)
    const submittedBy = request.headers.get('x-user-id') || 'anonymous';

    const input: CreateSubmissionInput = {
      assignmentId: body.assignmentId,
      data: body.data,
      completionTime: body.completionTime, // seconds to complete form
      status: body.status || 'success', // success, failed, abandoned
      schemaId: body.schemaId, // for analytics
      taskId: body.taskId, // for analytics
    };

    const newSubmission = await createSubmission(input, submittedBy, traceId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/submissions',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId: submittedBy,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          submission: newSubmission,
          message: 'Form data submitted successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating form submission:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/submissions',
      method: 'POST',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'CREATE_ERROR',
        error.message || 'Failed to submit form data',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}
