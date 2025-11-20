import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../lib/services/metrics-service';
import { getOrganizationContext } from '../../lib/middleware/tenant-scope';
import { TaskService, CreateTaskInput } from '../../lib/services/task-service';
import { createErrorEnvelope, createSuccessEnvelope } from '../../lib/middleware/transformation';

/**
 * GET /api/v1/tasks
 * List task definitions with optional filtering
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    // Get organization context for multi-tenancy
    const { organizationId } = await getOrganizationContext(request);

    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get('projectId') || undefined;
    const domain = searchParams.get('domain') || undefined;
    const isValid =
      searchParams.get('isValid') !== null ? searchParams.get('isValid') === 'true' : undefined;
    const createdBy = searchParams.get('createdBy') || undefined;
    const search = searchParams.get('search') || undefined;

    const tasks = await TaskService.listTasks(organizationId, {
      projectId,
      domain,
      isValid,
      createdBy,
      search,
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/tasks',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          tasks,
          total: tasks.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching tasks:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/tasks',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch tasks', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/tasks
 * Create a new task definition
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    // Get organization context for multi-tenancy
    const { organizationId, userId } = await getOrganizationContext(request);

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      recordMetric({
        endpoint: '/api/v1/tasks',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Task name is required', requestId),
        { status: 400 }
      );
    }

    if (!body.projectId) {
      recordMetric({
        endpoint: '/api/v1/tasks',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Project ID is required', requestId),
        { status: 400 }
      );
    }

    if (!body.inputSchemaId) {
      recordMetric({
        endpoint: '/api/v1/tasks',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Input schema ID is required', requestId),
        { status: 400 }
      );
    }

    if (!body.outputSchemaId) {
      recordMetric({
        endpoint: '/api/v1/tasks',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Output schema ID is required', requestId),
        { status: 400 }
      );
    }

    const input: CreateTaskInput = {
      name: body.name,
      description: body.description,
      organizationId,
      projectId: body.projectId,
      domain: body.domain || 'development',
      inputSchemaId: body.inputSchemaId,
      outputSchemaId: body.outputSchemaId,
      baseImage: body.baseImage || 'minimal-python',
      extraDependencies: body.extraDependencies || [],
      createdBy: userId,
    };

    const task = await TaskService.createTask(input);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/tasks',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          task,
          message: 'Task definition created successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating task:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/tasks',
      method: 'POST',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('CREATE_ERROR', error.message || 'Failed to create task', requestId, {
        details: error.message,
      }),
      { status: 400 }
    );
  }
}
