/**
 * BMaaS Instances API
 * Manage bare-metal compute instances
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
 * GET /api/v1/bmaas/instances
 * List all instances for the current organization
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
    const flavorId = searchParams.get('flavorId');

    // Build where clause
    const where: any = {
      deletedAt: null,
    };

    // Regular users: filter by their organization
    // Superadmins: see all organizations (no organizationId filter)
    if (!isSuperAdmin && organizationId) {
      where.organizationId = organizationId;
    }

    if (status) {
      where.status = status;
    }

    if (flavorId) {
      where.flavorId = flavorId;
    }

    // Fetch instances from database
    const instances = await prisma.bmaasInstance.findMany({
      where,
      include: {
        flavor: true,
        volumes: {
          where: { deletedAt: null },
        },
        networkPorts: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Fetch real-time status from OpenStack for all instances
    const bmaasService = getBmaasService();
    const instancesWithStatus = await Promise.all(
      instances.map(async (instance) => {
        if (!instance.openstackId) {
          return instance;
        }

        try {
          const openstackData = await bmaasService.getInstanceDetails(instance.openstackId);

          // Update database with latest status in background (don't await)
          prisma.bmaasInstance
            .update({
              where: { id: instance.id },
              data: {
                status: openstackData.status,
                powerState: openstackData['OS-EXT-STS:power_state']?.toString() || null,
                taskState: openstackData['OS-EXT-STS:task_state'] || null,
              },
            })
            .catch((err) => console.warn('Failed to update instance status:', err));

          // Return instance with updated status
          return {
            ...instance,
            status: openstackData.status,
            powerState: openstackData['OS-EXT-STS:power_state'],
            taskState: openstackData['OS-EXT-STS:task_state'],
            addresses: openstackData.addresses,
          };
        } catch (error) {
          console.warn(`Failed to fetch OpenStack data for instance ${instance.id}:`, error);
          return instance;
        }
      })
    );

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/instances',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          instances: instancesWithStatus,
          total: instancesWithStatus.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching BMaaS instances:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/instances',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch instances', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bmaas/instances
 * Create a new instance
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
    const {
      name,
      description,
      flavorId,
      imageId,
      imageName,
      availabilityZone,
      networks,
      metadata,
      tags,
      userData,
    } = body;

    // Validate required fields
    if (!name || !flavorId) {
      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'Missing required fields: name, flavorId',
          requestId
        ),
        { status: 400 }
      );
    }

    // Get default project for organization
    const project = await prisma.project.findFirst({
      where: { organizationId },
    });

    if (!project) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'No project found for organization', requestId),
        { status: 404 }
      );
    }

    // Get flavor for pricing
    const flavor = await prisma.bmaasFlavor.findUnique({
      where: { id: flavorId },
    });

    if (!flavor) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Flavor not found', requestId), {
        status: 404,
      });
    }

    // Check quota
    const quota = await prisma.bmaasQuota.findUnique({
      where: { organizationId },
    });

    if (quota) {
      if (quota.usedInstances >= quota.maxInstances) {
        return NextResponse.json(
          createErrorEnvelope(
            'QUOTA_EXCEEDED',
            `Instance quota exceeded. Maximum: ${quota.maxInstances}`,
            requestId
          ),
          { status: 429 }
        );
      }

      if (quota.usedVcpus + flavor.vcpus > quota.maxVcpus) {
        return NextResponse.json(
          createErrorEnvelope(
            'QUOTA_EXCEEDED',
            `vCPU quota exceeded. Available: ${quota.maxVcpus - quota.usedVcpus}, Required: ${
              flavor.vcpus
            }`,
            requestId
          ),
          { status: 429 }
        );
      }

      const ramMb = flavor.ram;
      if (quota.usedRamMb + ramMb > quota.maxRamMb) {
        return NextResponse.json(
          createErrorEnvelope(
            'QUOTA_EXCEEDED',
            `RAM quota exceeded. Available: ${
              (quota.maxRamMb - quota.usedRamMb) / 1024
            } GB, Required: ${ramMb / 1024} GB`,
            requestId
          ),
          { status: 429 }
        );
      }
    }

    // Convert network IDs from database IDs to OpenStack UUIDs
    let openstackNetworks = networks;
    if (networks && Array.isArray(networks)) {
      openstackNetworks = await Promise.all(
        networks.map(async (net: any) => {
          // If it's already an OpenStack UUID format (not a cuid), use as-is
          if (typeof net === 'string' && net.includes('-') && net.length > 30) {
            return { uuid: net };
          }

          // If it's an object with uuid property, use as-is
          if (net.uuid && net.uuid.includes('-') && net.uuid.length > 30) {
            return net;
          }

          // Otherwise, it's a database ID - look up the OpenStack ID
          const networkId = typeof net === 'string' ? net : net.uuid;
          const dbNetwork = await prisma.bmaasNetwork.findUnique({
            where: { id: networkId },
            select: { openstackId: true },
          });

          if (!dbNetwork) {
            throw new Error(`Network not found: ${networkId}`);
          }

          return { uuid: dbNetwork.openstackId };
        })
      );
    }

    // Get BMaaS service and create instance in OpenStack
    const bmaasService = getBmaasService();
    const openstackInstance = await bmaasService.createInstance({
      name,
      flavorId: flavor.openstackId || flavorId,
      imageId,
      availabilityZone,
      networks: openstackNetworks,
      metadata,
      userData,
    });

    // Create instance in database
    const instance = await prisma.bmaasInstance.create({
      data: {
        organizationId,
        projectId: project.id,
        name,
        description,
        flavorId,
        openstackId: openstackInstance.id,
        openstackProjectId: openstackInstance.project_id,
        imageId,
        imageName,
        hypervisor: openstackInstance.hypervisor_hostname,
        availabilityZone: openstackInstance.availability_zone,
        status: 'BUILDING',
        powerState: openstackInstance.power_state,
        taskState: openstackInstance.task_state,
        hourlyRate: flavor.hourlyRate,
        currency: flavor.currency,
        metadata: metadata || {},
        tags: tags || [],
        createdBy: userId,
      },
      include: {
        flavor: true,
      },
    });

    // Update quota
    if (quota) {
      await prisma.bmaasQuota.update({
        where: { organizationId },
        data: {
          usedInstances: { increment: 1 },
          usedVcpus: { increment: flavor.vcpus },
          usedRamMb: { increment: flavor.ram },
        },
      });
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/instances',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          instance,
          message: 'Instance creation initiated',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating BMaaS instance:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/instances',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to create instance', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
