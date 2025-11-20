/**
 * Individual Connector API Routes
 * GET /api/v1/connectors/:id - Get connector
 * PATCH /api/v1/connectors/:id - Update connector
 * DELETE /api/v1/connectors/:id - Delete connector
 */

import { NextRequest, NextResponse } from 'next/server';

import { getOrganizationId } from 'src/app/api/lib/headless-mode';
import { connectorService } from 'src/app/api/lib/connectors/connector-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * GET /api/v1/connectors/:id
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const organizationId = getOrganizationId(request);
    if (!organizationId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID required', requestId),
        { status: 401 }
      );
    }

    const connector = await connectorService.getConnector(params.id, organizationId);

    if (!connector) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Connector not found', requestId), {
        status: 404,
      });
    }

    // Get statistics
    const stats = await connectorService.getExecutionStats(params.id);

    return NextResponse.json(
      createSuccessEnvelope(
        {
          connector,
          stats,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting connector:', error);

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to get connector', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/connectors/:id
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const organizationId = getOrganizationId(request);
    if (!organizationId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID required', requestId),
        { status: 401 }
      );
    }

    const body = await request.json();

    const connector = await connectorService.updateConnector(params.id, organizationId, body);

    return NextResponse.json(
      createSuccessEnvelope(
        {
          connector,
          message: 'Connector updated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating connector:', error);

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to update connector', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/connectors/:id
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const organizationId = getOrganizationId(request);
    if (!organizationId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID required', requestId),
        { status: 401 }
      );
    }

    const success = await connectorService.deleteConnector(params.id, organizationId);

    if (!success) {
      return NextResponse.json(createErrorEnvelope('NOT_FOUND', 'Connector not found', requestId), {
        status: 404,
      });
    }

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Connector deleted successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting connector:', error);

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to delete connector', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
