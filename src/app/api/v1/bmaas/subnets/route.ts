/**
 * BMaaS Subnets API
 * Manage network subnets
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { recordMetric } from '../../../lib/services/metrics-service';
import { getBmaasService } from '../../../lib/services/bmaas-service';
import { getBmaasContext, getOrganizationContext } from '../../../lib/middleware/tenant-scope';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * GET /api/v1/bmaas/subnets
 * List subnets for a network
 */
export async function GET(request: NextRequest) {
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

    // Get BMaaS context (allows superadmins to see all orgs)
    const { organizationId, isSuperAdmin } = await getBmaasContext(request);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const networkId = searchParams.get('networkId');

    // Build where clause
    const where: any = {};

    if (networkId) {
      // Verify network belongs to organization (or superadmin)
      const networkWhere: any = {
        id: networkId,
        deletedAt: null,
      };

      if (!isSuperAdmin && organizationId) {
        networkWhere.organizationId = organizationId;
      }

      const network = await prisma.bmaasNetwork.findFirst({
        where: networkWhere,
      });

      if (!network) {
        return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Network not found', requestId), {
          status: 404,
        });
      }

      where.networkId = networkId;
    }

    // Fetch subnets from database
    const subnets = await prisma.bmaasSubnet.findMany({
      where,
      include: {
        network: {
          select: {
            id: true,
            name: true,
            organizationId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter by organization if no networkId specified
    const filteredSubnets = networkId
      ? subnets
      : subnets.filter((subnet) => subnet.network.organizationId === organizationId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/subnets',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          subnets: filteredSubnets,
          total: filteredSubnets.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS subnets:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/subnets',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch subnets', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bmaas/subnets
 * Create a new subnet
 */
export async function POST(request: NextRequest) {
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
    const { networkId, name, description, cidr, gateway, ipVersion, enableDhcp, dnsNameservers } =
      body;

    // Validate required fields
    if (!networkId || !name || !cidr) {
      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'Missing required fields: networkId, name, cidr',
          requestId
        ),
        { status: 400 }
      );
    }

    // Verify network belongs to organization
    const network = await prisma.bmaasNetwork.findFirst({
      where: {
        id: networkId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!network) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Network not found', requestId), {
        status: 404,
      });
    }

    // Get BMaaS service and create subnet in OpenStack
    const bmaasService = getBmaasService();
    const openstackSubnet = await bmaasService.createSubnet({
      networkId: network.openstackId,
      name,
      cidr,
      ipVersion: ipVersion || 4,
      gateway,
      enableDhcp: enableDhcp !== false,
    });

    // Create subnet in database
    const subnet = await prisma.bmaasSubnet.create({
      data: {
        networkId: network.id,
        name,
        description,
        openstackId: openstackSubnet.id,
        cidr,
        gateway: gateway || openstackSubnet.gateway_ip,
        ipVersion: ipVersion || 4,
        enableDhcp: enableDhcp !== false,
        dnsNameservers: dnsNameservers || [],
        allocationPools: openstackSubnet.allocation_pools || [],
      },
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/subnets',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          subnet,
          message: 'Subnet created successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating BMaaS subnet:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/subnets',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('SUBNET_CREATE_ERROR', 'Failed to create subnet', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
