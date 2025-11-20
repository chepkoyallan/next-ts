/**
 * BMaaS Networks API
 * Manage virtual networks and subnets
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
 * GET /api/v1/bmaas/networks
 * List all networks for the current organization
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
    const status = searchParams.get('status');

    // Build where clause
    const where: any = {
      deletedAt: null,
    };

    // Regular users: filter by their organization
    // Superadmins: see all organizations
    if (!isSuperAdmin && organizationId) {
      where.organizationId = organizationId;
    }

    if (status) {
      where.status = status;
    }

    // Fetch networks from database
    const networks = await prisma.bmaasNetwork.findMany({
      where,
      include: {
        subnets: true,
        _count: {
          select: {
            ports: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/networks',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          networks,
          total: networks.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS networks:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/networks',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch networks', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bmaas/networks
 * Create a new network
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
    const { organizationId, userId } = await getOrganizationContext(request);

    // Parse request body
    const body = await request.json();
    const { name, description, isPublic, isExternal, adminStateUp } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Missing required field: name', requestId),
        { status: 400 }
      );
    }

    // Check quota
    const quota = await prisma.bmaasQuota.findUnique({
      where: { organizationId },
    });

    if (quota) {
      const networkCount = await prisma.bmaasNetwork.count({
        where: { organizationId, deletedAt: null },
      });

      if (networkCount >= quota.maxNetworks) {
        return NextResponse.json(
          createErrorEnvelope(
            'QUOTA_EXCEEDED',
            `Network quota exceeded. Maximum: ${quota.maxNetworks}`,
            requestId
          ),
          { status: 429 }
        );
      }
    }

    // Get BMaaS service and create network in OpenStack
    const bmaasService = getBmaasService();
    const result = await bmaasService.createNetwork({
      name,
      adminStateUp: adminStateUp !== false,
      shared: isPublic || false,
      external: isExternal || false,
    });

    // Extract network from result (bmaasService returns { network })
    const openstackNetwork = result.network;

    // Create network in database
    const network = await prisma.bmaasNetwork.create({
      data: {
        organizationId,
        projectId: (await prisma.project.findFirst({ where: { organizationId } }))!.id,
        name,
        description,
        openstackId: openstackNetwork.id,
        status: 'ACTIVE',
        isPublic: isPublic || false,
        isExternal: isExternal || false,
        monthlyRate: 5.0, // $5/month for network
        currency: 'USD',
        createdBy: userId,
      },
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/networks',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          network,
          message: 'Network created successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating BMaaS network:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/networks',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('NETWORK_CREATE_ERROR', 'Failed to create network', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
