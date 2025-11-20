/**
 * BMaaS Instance Floating IP API
 * Associate/Disassociate floating IPs with instances
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { getOrganizationContext } from 'src/app/api/lib/middleware/tenant-scope';
import { getOpenStackClient } from 'src/app/api/lib/services/bmaas/openstack-client';
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
 * POST /api/v1/bmaas/instances/[id]/floating-ip
 * Associate a floating IP with an instance
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

    // Parse request body
    const body = await request.json();
    const { floatingIpId, floatingNetworkId } = body;

    const client = getOpenStackClient();
    await client.authenticate();

    // Get instance ports to find the port to associate with
    const portsResponse = await client.listPorts({ device_id: instance.openstackId });
    const ports = portsResponse.ports || [];

    if (ports.length === 0) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'No network ports found for instance', requestId),
        { status: 404 }
      );
    }

    // Use the first port
    const port = ports[0];

    let floatingIp;

    if (floatingIpId) {
      // Associate existing floating IP
      floatingIp = await client.associateFloatingIP(floatingIpId, port.id);
    } else if (floatingNetworkId) {
      // Allocate and associate new floating IP
      floatingIp = await client.createFloatingIP({
        floatingNetworkId,
        portId: port.id,
        description: `Floating IP for ${instance.name}`,
      });
    } else {
      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'Either floatingIpId or floatingNetworkId is required',
          requestId
        ),
        { status: 400 }
      );
    }

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}/floating-ip`,
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          floatingIp,
          message: 'Floating IP associated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error associating floating IP:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}/floating-ip`,
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to associate floating IP', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bmaas/instances/[id]/floating-ip
 * Disassociate a floating IP from an instance
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
    });

    if (!instance) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Instance not found', requestId), {
        status: 404,
      });
    }

    // Parse request body
    const body = await request.json();
    const { floatingIpId } = body;

    if (!floatingIpId) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'floatingIpId is required', requestId),
        { status: 400 }
      );
    }

    const client = getOpenStackClient();
    await client.authenticate();

    // Disassociate floating IP
    await client.disassociateFloatingIP(floatingIpId);

    // Record metrics
    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}/floating-ip`,
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Floating IP disassociated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error disassociating floating IP:', error);

    recordMetric({
      endpoint: `/api/v1/bmaas/instances/${params.id}/floating-ip`,
      method: 'DELETE',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to disassociate floating IP', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
