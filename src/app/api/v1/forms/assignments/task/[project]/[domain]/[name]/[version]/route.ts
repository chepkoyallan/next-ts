import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { recordMetric } from '../../../../../../../../lib/services/metrics-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../../../../../lib/middleware/transformation';

/**
 * GET /api/v1/forms/assignments/task/:project/:domain/:name/:version
 * Get form assignment for a specific task by its Flyte ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { project: string; domain: string; name: string; version: string } }
) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { project, domain, name, version } = params;

    // Validate parameters
    if (!project || !domain || !name || !version) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments/task',
        method: 'GET',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'All task identification parameters are required',
          requestId
        ),
        { status: 400 }
      );
    }

    // Get assignment type from query (default: input)
    const { searchParams } = request.nextUrl;
    const assignmentType = searchParams.get('assignmentType') || 'input';

    // Find assignment
    const assignment = await prisma.formAssignment.findFirst({
      where: {
        targetProject: project,
        targetDomain: domain,
        targetName: name,
        targetVersion: version,
        assignmentType,
        status: 'active',
      },
      include: {
        schema: true,
      },
    });

    if (!assignment) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments/task',
        method: 'GET',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope(
          'NOT_FOUND',
          `No ${assignmentType} assignment found for task ${project}:${domain}:${name}:${version}`,
          requestId
        ),
        { status: 404 }
      );
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/task',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          assignment,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching task assignment:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/task',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch task assignment', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
