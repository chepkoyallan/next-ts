import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../../lib/services/metrics-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';
import {
  getAssignment,
  FormAssignment,
  updateAssignment,
  deleteAssignment,
  CreateAssignmentInput,
} from '../../../../lib/services/form-generation-service';

/**
 * GET /api/v1/forms/assignments/[id]
 * Get a specific form assignment by ID
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { id } = params;

    if (!id) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments/[id]',
        method: 'GET',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Assignment ID is required', requestId),
        { status: 400 }
      );
    }

    const assignment = getAssignment(id);

    if (!assignment) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments/[id]',
        method: 'GET',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Form assignment not found', requestId),
        { status: 404 }
      );
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/[id]',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope({ assignment }, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching form assignment:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/[id]',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch form assignment', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/forms/assignments/[id]
 * Update a form assignment
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
        endpoint: '/api/v1/forms/assignments/[id]',
        method: 'PUT',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Assignment ID is required', requestId),
        { status: 400 }
      );
    }

    // Check if assignment exists
    const existingAssignment = getAssignment(id);
    if (!existingAssignment) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments/[id]',
        method: 'PUT',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Form assignment not found', requestId),
        { status: 404 }
      );
    }

    const updates: Partial<CreateAssignmentInput & { status?: FormAssignment['status'] }> = {};

    // Only update provided fields
    if (body.targetType !== undefined) updates.targetType = body.targetType;
    // Note: targetId is not a single field in Prisma - it's split into targetProject, targetDomain, targetName, targetVersion
    if (body.assignmentType !== undefined) updates.assignmentType = body.assignmentType;
    if (body.status !== undefined) updates.status = body.status;
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.configuration !== undefined) updates.configuration = body.configuration;

    const updatedAssignment = await updateAssignment(id, updates, traceId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/[id]',
      method: 'PUT',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          assignment: updatedAssignment,
          message: 'Form assignment updated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating form assignment:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/[id]',
      method: 'PUT',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'UPDATE_ERROR',
        error.message || 'Failed to update form assignment',
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
 * DELETE /api/v1/forms/assignments/[id]
 * Delete a form assignment
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const traceId = request.headers.get('x-trace-id') || undefined;

  try {
    const { id } = params;

    if (!id) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments/[id]',
        method: 'DELETE',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Assignment ID is required', requestId),
        { status: 400 }
      );
    }

    // Check if assignment exists
    const existingAssignment = getAssignment(id);
    if (!existingAssignment) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments/[id]',
        method: 'DELETE',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Form assignment not found', requestId),
        { status: 404 }
      );
    }

    await deleteAssignment(id, traceId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/[id]',
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Form assignment deleted successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting form assignment:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/[id]',
      method: 'DELETE',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'DELETE_ERROR',
        error.message || 'Failed to delete form assignment',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}
