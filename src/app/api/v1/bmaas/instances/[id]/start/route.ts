/**
 * BMaaS Instance Start Action
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { recordMetric } from '../../../../../lib/services/metrics-service';
import { getBmaasService } from '../../../../../lib/services/bmaas-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/bmaas/instances/:id/start
 * Start an instance
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const instanceId = params.id;

    // Get instance from database
    const instance = await prisma.bmaasInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Instance not found', requestId), {
        status: 404,
      });
    }

    // Start instance in OpenStack
    const bmaasService = getBmaasService();
    await bmaasService.startInstance(instance.openstackId);

    // Update status in database
    await prisma.bmaasInstance.update({
      where: { id: instanceId },
      data: {
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
    });

    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${instanceId}/start`,
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope({ message: 'Instance start initiated' }, requestId),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error starting instance:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}/start`,
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to start instance', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
