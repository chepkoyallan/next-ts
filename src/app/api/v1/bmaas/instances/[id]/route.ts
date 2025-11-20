/**
 * BMaaS Single Instance API
 * Get, update, or delete a specific instance
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
 * GET /api/v1/bmaas/instances/[id]
 * Get details of a specific instance
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

    // Fetch instance from database
    const instance = await prisma.bmaasInstance.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
      },
      include: {
        flavor: true,
        volumes: {
          where: { deletedAt: null },
        },
        networkPorts: true,
      },
    });

    if (!instance) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Instance not found', requestId), {
        status: 404,
      });
    }

    // Fetch real-time data from OpenStack if instance has openstackId
    let openstackData = null;
    if (instance.openstackId) {
      try {
        const bmaasService = getBmaasService();
        openstackData = await bmaasService.getInstanceDetails(instance.openstackId);

        // Update database with latest status
        await prisma.bmaasInstance.update({
          where: { id: instance.id },
          data: {
            status: openstackData.status,
            powerState: openstackData['OS-EXT-STS:power_state']?.toString() || null,
            taskState: openstackData['OS-EXT-STS:task_state'] || null,
          },
        });
      } catch (error) {
        console.warn('Failed to fetch OpenStack data:', error);
        // Continue with database data if OpenStack fetch fails
      }
    }

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}`,
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          instance: {
            ...instance,
            // Merge OpenStack real-time data if available
            ...(openstackData && {
              status: openstackData.status,
              powerState: openstackData['OS-EXT-STS:power_state'],
              taskState: openstackData['OS-EXT-STS:task_state'],
              addresses: openstackData.addresses,
              openstackData,
            }),
          },
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS instance:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}`,
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch instance', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/bmaas/instances/[id]
 * Update instance details
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
    const { name, description, tags } = body;

    // Find instance
    const instance = await prisma.bmaasInstance.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
      },
    });

    if (!instance) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Instance not found', requestId), {
        status: 404,
      });
    }

    // Update instance
    const updatedInstance = await prisma.bmaasInstance.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(tags && { tags }),
      },
      include: {
        flavor: true,
      },
    });

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}`,
      method: 'PATCH',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          instance: updatedInstance,
          message: 'Instance updated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating BMaaS instance:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}`,
      method: 'PATCH',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to update instance', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bmaas/instances/[id]
 * Delete an instance
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

    // Find instance
    const instance = await prisma.bmaasInstance.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
      },
      include: {
        flavor: true,
      },
    });

    if (!instance) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Instance not found', requestId), {
        status: 404,
      });
    }

    // Delete instance from OpenStack
    const bmaasService = getBmaasService();
    await bmaasService.deleteInstance(instance.openstackId);

    // Soft delete instance in database
    await prisma.bmaasInstance.update({
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
          usedInstances: { decrement: 1 },
          usedVcpus: { decrement: instance.flavor.vcpus },
          usedRamMb: { decrement: instance.flavor.ram },
        },
      });
    }

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}`,
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Instance deleted successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting BMaaS instance:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}`,
      method: 'DELETE',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to delete instance', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
