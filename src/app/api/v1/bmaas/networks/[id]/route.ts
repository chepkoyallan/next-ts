/**
 * BMaaS Network Detail API
 * Get and delete individual networks
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { recordMetric } from '../../../../lib/services/metrics-service';
import { getBmaasService } from '../../../../lib/services/bmaas-service';
import { getOrganizationContext } from '../../../../lib/middleware/tenant-scope';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * GET /api/v1/bmaas/networks/:id
 * Get network details
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

    // Fetch network from database
    const network = await prisma.bmaasNetwork.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
      },
      include: {
        subnets: true,
        ports: {
          include: {
            instance: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            ports: true,
          },
        },
      },
    });

    if (!network) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Network not found', requestId), {
        status: 404,
      });
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/networks/:id',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope({ network }, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching BMaaS network:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/networks/:id',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch network', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bmaas/networks/:id
 * Delete a network
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

    // Fetch network from database
    const network = await prisma.bmaasNetwork.findFirst({
      where: {
        id: params.id,
        organizationId,
        deletedAt: null,
      },
      include: {
        ports: true,
        subnets: true,
      },
    });

    if (!network) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Network not found', requestId), {
        status: 404,
      });
    }

    // Check if network has attached ports
    if (network.ports.length > 0) {
      return NextResponse.json(
        createErrorEnvelope(
          'NETWORK_IN_USE',
          `Cannot delete network. ${network.ports.length} port(s) are still attached.`,
          requestId
        ),
        { status: 409 }
      );
    }

    // Delete subnets from OpenStack first
    const bmaasService = getBmaasService();
    // eslint-disable-next-line no-restricted-syntax
    for (const subnet of network.subnets) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await bmaasService.deleteSubnet(subnet.openstackId);
      } catch (error: any) {
        console.warn(`Failed to delete subnet ${subnet.openstackId}:`, error.message);
      }
    }

    // Delete network from OpenStack
    try {
      await bmaasService.deleteNetwork(network.openstackId);
    } catch (error: any) {
      console.error('Error deleting network from OpenStack:', error);
      return NextResponse.json(
        createErrorEnvelope(
          'NETWORK_DELETE_ERROR',
          'Failed to delete network from OpenStack',
          requestId,
          { message: error.message }
        ),
        { status: 500 }
      );
    }

    // Delete subnets from database (hard delete)
    await prisma.bmaasSubnet.deleteMany({
      where: { networkId: network.id },
    });

    // Soft delete network from database
    await prisma.bmaasNetwork.update({
      where: { id: network.id },
      data: { deletedAt: new Date() },
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/networks/:id',
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Network deleted successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting BMaaS network:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/networks/:id',
      method: 'DELETE',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to delete network', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
