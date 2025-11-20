/**
 * Connector Test API Route
 * POST /api/v1/connectors/:id/test - Test connector connection
 */

import { NextRequest, NextResponse } from 'next/server';

import { getOrganizationId } from 'src/app/api/lib/headless-mode';
import { connectorService } from 'src/app/api/lib/connectors/connector-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * POST /api/v1/connectors/:id/test
 * Test connector connection
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const organizationId = getOrganizationId(request);
    if (!organizationId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID required', requestId),
        { status: 401 }
      );
    }

    const result = await connectorService.testConnection(params.id, organizationId);

    return NextResponse.json(
      createSuccessEnvelope(
        {
          test: result,
          message: result.status === 'healthy' ? 'Connection successful' : 'Connection failed',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error testing connector:', error);

    return NextResponse.json(
      createErrorEnvelope('TEST_ERROR', 'Failed to test connector', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
