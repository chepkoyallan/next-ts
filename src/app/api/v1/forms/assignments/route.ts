import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../lib/services/metrics-service';
import { getOrganizationContext } from '../../../lib/middleware/tenant-scope';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';
import {
  createAssignment,
  getAllAssignments,
  CreateAssignmentInput,
} from '../../../lib/services/form-generation-service';

/**
 * GET /api/v1/forms/assignments
 * Get all form assignments with optional filtering
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    // Get organization context for multi-tenancy
    const { organizationId } = await getOrganizationContext(request);

    const { searchParams } = request.nextUrl;
    const targetType = searchParams.get('targetType') || undefined;
    const targetId = searchParams.get('targetId') || undefined;
    const schemaId = searchParams.get('schemaId') || undefined;
    const status = searchParams.get('status') || undefined;
    const assignmentType = searchParams.get('assignmentType') || undefined;

    const allAssignments = await getAllAssignments({
      targetType,
      targetId,
      schemaId,
      status,
      assignmentType,
      organizationId, // CRITICAL: Filter by organization
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          assignments: allAssignments,
          total: allAssignments.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching form assignments:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch form assignments', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/forms/assignments
 * Create a new form assignment
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const traceId = request.headers.get('x-trace-id') || undefined;

  try {
    // Get organization context for multi-tenancy
    const { organizationId, userId } = await getOrganizationContext(request);

    const body = await request.json();

    // Validate required fields
    if (!body.schemaId) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Schema ID is required', requestId),
        { status: 400 }
      );
    }

    if (!body.targetType) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Target type is required', requestId),
        { status: 400 }
      );
    }

    // Validate Flyte resource identification fields
    if (!body.targetProject || !body.targetDomain || !body.targetName || !body.targetVersion) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'Flyte resource identification required: targetProject, targetDomain, targetName, targetVersion',
          requestId
        ),
        { status: 400 }
      );
    }

    if (!body.assignmentType) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Assignment type is required', requestId),
        { status: 400 }
      );
    }

    // Validate enum values
    const validTargetTypes = ['workflow', 'task', 'node', 'execution'];
    const validAssignmentTypes = ['input', 'output', 'config'];

    if (!validTargetTypes.includes(body.targetType)) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          `Invalid target type. Must be one of: ${validTargetTypes.join(', ')}`,
          requestId
        ),
        { status: 400 }
      );
    }

    if (!validAssignmentTypes.includes(body.assignmentType)) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          `Invalid assignment type. Must be one of: ${validAssignmentTypes.join(', ')}`,
          requestId
        ),
        { status: 400 }
      );
    }

    const input: CreateAssignmentInput = {
      schemaId: body.schemaId,
      targetType: body.targetType,
      targetProject: body.targetProject,
      targetDomain: body.targetDomain,
      targetName: body.targetName,
      targetVersion: body.targetVersion,
      assignmentType: body.assignmentType,
      name: body.name,
      description: body.description,
      configuration: body.configuration,
    };

    const newAssignment = await createAssignment(input, userId, organizationId, traceId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          assignment: newAssignment,
          message: 'Form assignment created successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating form assignment:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments',
      method: 'POST',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'CREATE_ERROR',
        error.message || 'Failed to create form assignment',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}
