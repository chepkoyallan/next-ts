/**
 * AI Generation History API
 * View past AI generations and analytics
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { getUserContext } from '../../lib/middleware/auth-scope';
import { recordMetric } from '../../lib/services/metrics-service';
import { getOrganizationContext } from '../../lib/middleware/tenant-scope';
import { createErrorEnvelope, createSuccessEnvelope } from '../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/ai-generations
 * Get AI generation history
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { userId } = await getUserContext(request);
    const { organizationId } = await getOrganizationContext(request);

    const { searchParams } = request.nextUrl;
    const taskId = searchParams.get('taskId');
    const generationType = searchParams.get('generationType');
    const provider = searchParams.get('provider');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build where clause
    const where: any = {
      userId,
      organizationId,
    };

    if (taskId) {
      where.taskId = taskId;
    }

    if (generationType) {
      where.generationType = generationType;
    }

    if (provider) {
      where.provider = provider;
    }

    // Fetch generations
    const [generations, total] = await Promise.all([
      prisma.aIGenerationLog.findMany({
        where,
        select: {
          id: true,
          taskId: true,
          generationType: true,
          provider: true,
          model: true,
          userDescription: true,
          tokensUsed: true,
          costUsd: true,
          generationTimeMs: true,
          success: true,
          errorMessage: true,
          wasAccepted: true,
          userRating: true,
          createdAt: true,
          // Don't return full code in list view for performance
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.aIGenerationLog.count({ where }),
    ]);

    recordMetric({
      endpoint: '/api/v1/ai-generations',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          generations,
          total,
          limit,
          offset,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching generation history:', error);

    recordMetric({
      endpoint: '/api/v1/ai-generations',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch generation history', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
