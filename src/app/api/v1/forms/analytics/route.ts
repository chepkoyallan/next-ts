import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { recordMetric } from '../../../lib/services/metrics-service';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';

/**
 * GET /api/v1/forms/analytics
 * Get form submission analytics data
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { searchParams } = request.nextUrl;
    const schemaId = searchParams.get('schemaId') || undefined;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // default: 7 days ago
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();

    // Build where clause
    const where: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (schemaId && schemaId !== 'all') {
      where.schemaId = schemaId;
    }

    // Fetch submissions with analytics data
    const submissions = await prisma.formSubmission.findMany({
      where,
      select: {
        id: true,
        schemaId: true,
        taskId: true,
        status: true,
        isValid: true,
        errors: true,
        completionTime: true,
        data: true,
        createdAt: true,
        submittedBy: true,
        submittedAt: true,
        assignment: {
          select: {
            id: true,
            schemaId: true,
            schema: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform to analytics format
    const analyticsData = submissions.map((submission) => {
      // Parse errors array
      const errors = Array.isArray(submission.errors)
        ? submission.errors.map((err: any) => ({
            field:
              err.instancePath?.replace('/', '') || err.dataPath?.replace('/', '') || 'unknown',
            message: err.message || 'Validation error',
            timestamp: submission.createdAt,
          }))
        : [];

      return {
        id: submission.id,
        schemaId: submission.schemaId || submission.assignment.schemaId,
        schemaName: submission.assignment.schema.name,
        taskId: submission.taskId || 'unknown',
        timestamp: submission.submittedAt || submission.createdAt,
        completionTime: submission.completionTime || 0,
        fieldData: submission.data as Record<string, any>,
        errors,
        status: (submission.status || 'success') as 'success' | 'failed' | 'abandoned',
      };
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/analytics',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          analytics: analyticsData,
          total: analyticsData.length,
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching form analytics:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/analytics',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch form analytics', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
