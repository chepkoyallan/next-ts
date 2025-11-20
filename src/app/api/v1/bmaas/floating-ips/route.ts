/**
 * BMaaS Floating IPs API
 * Manage floating IP addresses for instances
 */

import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../lib/services/metrics-service';
import { getOrganizationContext } from '../../../lib/middleware/tenant-scope';
import { getOpenStackClient } from '../../../lib/services/bmaas/openstack-client';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

// Check if BMaaS is enabled
function isBmaasEnabled(): boolean {
  return process.env.BMAAS === 'true';
}

/**
 * GET /api/v1/bmaas/floating-ips
 * List all floating IPs
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

    // Get organization context
    await getOrganizationContext(request);

    // Get floating IPs from OpenStack
    const client = getOpenStackClient();
    await client.authenticate();
    const response = await client.listFloatingIPs();

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/floating-ips',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          floatingIps: response.floatingips || [],
          total: response.floatingips?.length || 0,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching floating IPs:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/floating-ips',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch floating IPs', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/bmaas/floating-ips
 * Allocate a new floating IP
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
    await getOrganizationContext(request);

    // Parse request body
    const body = await request.json();
    const { floatingNetworkId, description } = body;

    // Validate required fields
    if (!floatingNetworkId) {
      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'Missing required field: floatingNetworkId',
          requestId
        ),
        { status: 400 }
      );
    }

    // Allocate floating IP from OpenStack
    const client = getOpenStackClient();
    await client.authenticate();
    const floatingIp = await client.createFloatingIP({
      floatingNetworkId,
      description,
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/bmaas/floating-ips',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          floatingIp,
          message: 'Floating IP allocated successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error allocating floating IP:', error);

    recordMetric({
      endpoint: '/api/v1/bmaas/floating-ips',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to allocate floating IP', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
