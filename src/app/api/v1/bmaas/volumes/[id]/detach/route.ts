/**
 * BMaaS Volume Detach Action
 * Detach a volume from its instance
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
 * POST /api/v1/bmaas/volumes/:id/detach
 * Detach a volume from its instance
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

    // Get volume from database
    const volume = await prisma.bmaasVolume.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
      },
      include: {
        instance: true,
      },
    });

    if (!volume) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Volume not found', requestId), {
        status: 404,
      });
    }

    // Check if volume is attached
    if (!volume.instanceId || !volume.instance) {
      return NextResponse.json(
        createErrorEnvelope('CONFLICT', 'Volume is not attached to any instance', requestId),
        { status: 409 }
      );
    }

    // Detach volume in OpenStack
    const bmaasService = getBmaasService();
    await bmaasService.detachVolume(volume.instance.openstackId, volume.openstackId);

    // Update volume in database
    const updatedVolume = await prisma.bmaasVolume.update({
      where: { id: params.id },
      data: {
        instanceId: null,
        status: 'AVAILABLE',
        attachedDevice: null,
        updatedAt: new Date(),
      },
    });

    recordMetric({
      endpoint: `/api/v1/bmaas/volumes/${params.id}/detach`,
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          volume: updatedVolume,
          message: 'Volume detached successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error detaching volume:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/volumes/${params.id}/detach`,
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to detach volume', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
