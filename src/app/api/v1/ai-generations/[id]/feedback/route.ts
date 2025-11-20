/**
 * AI Generation Feedback API
 * Record user feedback on AI-generated code
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { getUserContext } from '../../../../lib/middleware/auth-scope';
import { recordMetric } from '../../../../lib/services/metrics-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/ai-generations/[id]/feedback
 * Submit feedback on a generation
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { id } = params;
    const { userId } = await getUserContext(request);

    const body = await request.json();
    const { wasAccepted, userRating, userFeedback } = body;

    // Verify generation exists and belongs to user
    const generation = await prisma.aIGenerationLog.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!generation) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Generation not found', requestId),
        { status: 404 }
      );
    }

    // Update feedback
    const updated = await prisma.aIGenerationLog.update({
      where: { id },
      data: {
        wasAccepted: wasAccepted !== undefined ? Boolean(wasAccepted) : generation.wasAccepted,
        userRating:
          userRating !== undefined
            ? Math.max(1, Math.min(5, parseInt(userRating, 10)))
            : generation.userRating,
        userFeedback: userFeedback || generation.userFeedback,
      },
    });

    recordMetric({
      endpoint: `/api/v1/ai-generations/${id}/feedback`,
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Feedback recorded successfully',
          wasAccepted: updated.wasAccepted,
          userRating: updated.userRating,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error recording feedback:', error);

    recordMetric({
      endpoint: `/api/v1/ai-generations/${params.id}/feedback`,
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to record feedback', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
