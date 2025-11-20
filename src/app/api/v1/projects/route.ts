/**
 * Projects API
 * Database-backed projects (not engine-dependent)
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { recordMetric } from '../../lib/services/metrics-service';
import { getOrganizationContext } from '../../lib/middleware/tenant-scope';
import { createErrorEnvelope, createSuccessEnvelope } from '../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/projects
 * List projects for the current organization
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    // Get organization context for multi-tenancy
    const { organizationId } = await getOrganizationContext(request);

    // Fetch projects from database
    const projects = await prisma.project.findMany({
      where: {
        organizationId,
        isArchived: false, // Only show active projects
      },
      select: {
        id: true,
        name: true,
        description: true,
        domain: true,
        flyteProjectId: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/projects',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          projects,
          total: projects.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching projects:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/projects',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch projects', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
