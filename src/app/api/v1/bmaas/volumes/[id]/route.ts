/**
 * BMaaS Single Volume API
 * Get, update, or delete a specific volume
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
 * GET /api/v1/bmaas/volumes/[id]
 * Get details of a specific volume
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Fetch volume from database
    const volume = await prisma.bmaasVolume.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
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

    if (!volume) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Volume not found', requestId), {
        status: 404,
      });
    }

    // Get real-time data from OpenStack
    let openstackVolume = null;
    let openstackError = null;

    try {
      const bmaasService = getBmaasService();
      openstackVolume = await bmaasService.getVolume(volume.openstackId);
    } catch (error: any) {
      console.error('Failed to get OpenStack volume details:', error.message);
      openstackError = error.message;
      // Continue with database data only
    }

    // Merge database and OpenStack data
    const volumeDetails = {
      ...volume,
      // Override with real-time OpenStack data if available
      ...(openstackVolume && {
        status: mapOpenstackStatus(openstackVolume.status),
        bootable: openstackVolume.bootable || false,
        encrypted: openstackVolume.encrypted || false,
        availabilityZone: openstackVolume.availability_zone,
        attachments: openstackVolume.attachments || [],
        volumeImageMetadata: openstackVolume.volume_image_metadata || null,
        size: openstackVolume.size, // Real-time size from OpenStack
        openstackStatus: openstackVolume.status, // Original OpenStack status
      }),
      // Add flag to indicate if OpenStack data is available
      openstackDataAvailable: !!openstackVolume,
      openstackError,
    };

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/volumes/${params.id}`,
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          volume: volumeDetails,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS volume:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/volumes/${params.id}`,
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch volume', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/bmaas/volumes/[id]
 * Update volume metadata
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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
    const { name, description } = body;

    // Find volume
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

    // Update volume
    const updatedVolume = await prisma.bmaasVolume.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
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

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/volumes/${params.id}`,
      method: 'PATCH',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          volume: updatedVolume,
          message: 'Volume updated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating BMaaS volume:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/volumes/${params.id}`,
      method: 'PATCH',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to update volume', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bmaas/volumes/[id]
 * Delete a volume
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Find volume
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

    // Check if volume is attached
    if (volume.instanceId) {
      return NextResponse.json(
        createErrorEnvelope(
          'CONFLICT',
          'Cannot delete volume while it is attached to an instance. Detach it first.',
          requestId
        ),
        { status: 409 }
      );
    }

    // Delete volume from OpenStack
    const bmaasService = getBmaasService();
    await bmaasService.deleteVolume(volume.openstackId);

    // Soft delete volume in database
    await prisma.bmaasVolume.update({
      where: { id: params.id },
      data: {
        deletedAt: new Date(),
        status: 'DELETED',
      },
    });

    // Update quota
    const quota = await prisma.bmaasQuota.findUnique({
      where: { organizationId },
    });

    if (quota) {
      await prisma.bmaasQuota.update({
        where: { organizationId },
        data: {
          usedVolumes: { decrement: 1 },
          usedStorageGb: { decrement: volume.sizeGb },
        },
      });
    }

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/volumes/${params.id}`,
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Volume deleted successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting BMaaS volume:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/volumes/${params.id}`,
      method: 'DELETE',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to delete volume', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * Map OpenStack status to BMaaS status
 */
function mapOpenstackStatus(osStatus: string): string {
  const statusMap: Record<string, string> = {
    creating: 'CREATING',
    available: 'AVAILABLE',
    'in-use': 'IN_USE',
    deleting: 'DELETING',
    error: 'ERROR',
    error_deleting: 'ERROR',
    backing_up: 'BACKING_UP',
    restoring_backup: 'RESTORING',
    error_backing_up: 'ERROR',
    error_restoring: 'ERROR',
    downloading: 'DOWNLOADING',
    uploading: 'UPLOADING',
  };

  return statusMap[osStatus.toLowerCase()] || osStatus.toUpperCase();
}
