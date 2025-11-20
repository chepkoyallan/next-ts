/**
 * BMaaS Subnet Detail API
 * Get and delete individual subnets
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
 * GET /api/v1/bmaas/subnets/:id
 * Get subnet details
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

    // Fetch subnet from database
    const subnet = await prisma.bmaasSubnet.findFirst({
      where: {
        id: params.id,
      },
      include: {
        network: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
      },
    });

    if (!subnet || subnet.network.organizationId !== organizationId) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Subnet not found', requestId), {
        status: 404,
      });
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/subnets/:id',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope({ subnet }, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching BMaaS subnet:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/subnets/:id',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch subnet', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bmaas/subnets/:id
 * Delete a subnet
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

    // Fetch subnet from database
    const subnet = await prisma.bmaasSubnet.findFirst({
      where: {
        id: params.id,
      },
      include: {
        network: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            ports: true,
          },
        },
      },
    });

    if (!subnet || subnet.network.organizationId !== organizationId) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Subnet not found', requestId), {
        status: 404,
      });
    }

    // Check if network has ports that might use this subnet
    if (subnet.network.ports.length > 0) {
      return NextResponse.json(
        createErrorEnvelope(
          'SUBNET_IN_USE',
          `Cannot delete subnet. Network has ${subnet.network.ports.length} port(s) attached.`,
          requestId
        ),
        { status: 409 }
      );
    }

    // Delete subnet from OpenStack
    const bmaasService = getBmaasService();
    try {
      await bmaasService.deleteSubnet(subnet.openstackId);
    } catch (error: any) {
      console.error('Error deleting subnet from OpenStack:', error);
      return NextResponse.json(
        createErrorEnvelope(
          'SUBNET_DELETE_ERROR',
          'Failed to delete subnet from OpenStack',
          requestId,
          { message: error.message }
        ),
        { status: 500 }
      );
    }

    // Delete subnet from database
    await prisma.bmaasSubnet.delete({
      where: { id: subnet.id },
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/subnets/:id',
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Subnet deleted successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting BMaaS subnet:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/subnets/:id',
      method: 'DELETE',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to delete subnet', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
