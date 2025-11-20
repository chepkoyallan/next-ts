/**
 * BMaaS Volume Attach Action
 * Attach a volume to an instance
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { getBmaasService } from 'src/app/api/lib/services/bmaas-service';
import { getOrganizationContext } from 'src/app/api/lib/middleware/tenant-scope';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

export const dynamic = 'force-dynamic';

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * POST /api/v1/bmaas/volumes/:id/attach
 * Attach a volume to an instance
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    // Check if BMaaS is enabled
    if (!isBmaasEnabled()) {
      return NextResponse.json(
        createErrorEnvelope('FEATURE_DISABLED', 'BMaaS feature is not enabled', requestId),
        { status: 403 }
      );
    }

    // Get organization context
    const { organizationId } = await getOrganizationContext(request);

    // Parse request body
    const body = await request.json();
    const { instanceId, device } = body;

    // Validate required fields
    if (!instanceId) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Missing required field: instanceId', requestId),
        { status: 400 }
      );
    }

    // Get volume from database
    const volume = await prisma.bmaasVolume.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!volume) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Volume not found', requestId), {
        status: 404,
      });
    }

    // Check if volume is already attached
    if (volume.instanceId) {
      return NextResponse.json(
        createErrorEnvelope(
          'CONFLICT',
          'Volume is already attached to an instance. Detach it first.',
          requestId
        ),
        { status: 409 }
      );
    }

    // Get instance from database
    const instance = await prisma.bmaasInstance.findFirst({
      where: {
        id: instanceId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!instance) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Instance not found', requestId), {
        status: 404,
      });
    }

    // Check if instance is in a valid state for attachment
    const validStates = ['ACTIVE', 'PAUSED', 'SUSPENDED', 'SHUTOFF'];
    if (!validStates.includes(instance.status)) {
      return NextResponse.json(
        createErrorEnvelope(
          'INVALID_STATE',
          `Instance must be in one of these states: ${validStates.join(', ')}. Current state: ${
            instance.status
          }`,
          requestId
        ),
        { status: 409 }
      );
    }

    // Attach volume in OpenStack
    const bmaasService = getBmaasService();
    await bmaasService.attachVolume(instance.openstackId, volume.openstackId, device);

    // Update volume in database
    const updatedVolume = await prisma.bmaasVolume.update({
      where: { id: params.id },
      data: {
        instanceId,
        status: 'IN_USE',
        attachedDevice: device || null,
        updatedAt: new Date(),
      },
      include: {
        instance: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    recordMetric({
      endpoint: `/api/v1/bmaas/volumes/${params.id}/attach`,
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          volume: updatedVolume,
          message: 'Volume attached successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error attaching volume:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/volumes/${params.id}/attach`,
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to attach volume', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
