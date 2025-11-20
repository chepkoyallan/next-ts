/**
 * Connector Field Discovery API Route
 * POST /api/v1/connectors/[id]/discover - Discover fields from connector data
 */

import { NextRequest, NextResponse } from 'next/server';

import { authMiddleware } from 'src/app/api/lib/middleware/auth';
import { getOrganizationId } from 'src/app/api/lib/headless-mode';
import { connectorService } from 'src/app/api/lib/connectors/connector-service';
import { analyzeResponseData } from 'src/app/api/lib/connectors/utils/field-analyzer';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * POST /api/v1/connectors/:id/discover
 * Execute connector and discover fields from the response
 *
 * Supports two modes:
 * 1. Saved connector: Use params.id to execute an existing connector
 * 2. Test mode: Send connector configuration in request body for temporary execution
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  try {
    // Authenticate
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const organizationId = getOrganizationId(request);
    const userId = authResult.user.id;

    if (!organizationId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID required', requestId),
        { status: 401 }
      );
    }

    // Check if this is test mode (connector config in body)
    const body = await request.json().catch(() => ({}));
    const isTestMode = params.id === 'temp' || params.id === 'test' || body.connector;

    let result;

    if (isTestMode && body.connector) {
      // Test mode: Execute temporary connector configuration
      const { connector } = body;

      // Use testExecutor to execute without saving
      result = await connectorService.testExecutor(
        connector.type,
        connector.configuration,
        connector.authentication,
        {
          pagination: { page: 0, pageSize: 5 }, // Page 0 = first 5 records
        },
        {
          userId,
          organizationId,
          requestId,
          timestamp: new Date(),
        }
      );
    } else {
      // Normal mode: Execute saved connector
      result = await connectorService.executeConnector(
        params.id,
        {
          pagination: { page: 0, pageSize: 5 }, // Page 0 = first 5 records
        },
        {
          userId,
          organizationId,
          requestId,
          timestamp: new Date(),
        }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        createErrorEnvelope(
          'EXECUTION_ERROR',
          result.error || 'Failed to execute connector',
          requestId
        ),
        { status: 500 }
      );
    }

    // Analyze response data to discover fields
    const discovery = analyzeResponseData(result.data);

    return NextResponse.json(
      createSuccessEnvelope(
        {
          discovery,
          message: 'Fields discovered successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error discovering fields:', error);

    return NextResponse.json(
      createErrorEnvelope('DISCOVERY_ERROR', 'Failed to discover fields', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
