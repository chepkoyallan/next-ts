import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { logger } from 'src/app/api/lib/utils/logger';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { incrementQueueCounter } from 'src/app/api/lib/queues/task-registration-queue';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * Registration callback schema
 */
const RegistrationCallbackSchema = z.object({
  status: z.enum(['PROCESSING', 'COMPLETED', 'FAILED']),
  flyteTaskId: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.string(),
});

/**
 * POST /api/v1/tasks/:id/registration/callback
 * Webhook endpoint for worker to update registration status
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { id } = params;

    // Validate API secret for security
    const apiSecret = request.headers.get('x-api-secret');
    const expectedSecret = process.env.API_SECRET;

    if (!expectedSecret || apiSecret !== expectedSecret) {
      logger.warn('Unauthorized registration callback attempt', { taskId: id });
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Invalid API secret', requestId),
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = RegistrationCallbackSchema.parse(body);

    const { status, flyteTaskId, error, timestamp } = validatedData;

    logger.info('Registration callback received', {
      taskId: id,
      status,
      flyteTaskId,
      timestamp,
    });

    // Update task definition in database
    const updateData: any = {
      registrationStatus: status,
      updatedAt: new Date(),
    };

    if (status === 'COMPLETED' && flyteTaskId) {
      updateData.flyteTaskId = flyteTaskId;
      updateData.registeredAt = new Date(timestamp);
      updateData.registrationError = null;
    } else if (status === 'FAILED' && error) {
      updateData.registrationError = error;
    }

    const updatedTask = await prisma.taskDefinition.update({
      where: { id },
      data: updateData,
    });

    // Increment queue counter
    if (status === 'COMPLETED') {
      await incrementQueueCounter('completed');
    } else if (status === 'FAILED') {
      await incrementQueueCounter('failed');
    }

    logger.info('Task registration status updated', {
      taskId: id,
      status,
      flyteTaskId: updatedTask.flyteTaskId,
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/tasks/:id/registration/callback',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
      userId: 'system',
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          taskDefinitionId: id,
          status: updatedTask.registrationStatus,
          flyteTaskId: updatedTask.flyteTaskId,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    logger.error('Error processing registration callback', error, {
      taskId: params.id,
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/tasks/:id/registration/callback',
      method: 'POST',
      statusCode: error instanceof z.ZodError ? 400 : 500,
      responseTime: Date.now() - startTime,
      userId: 'system',
      error: error.message,
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Invalid callback data', requestId, {
          details: error.issues,
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to process callback', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
