/**
 * Connectors API Routes
 * GET /api/v1/connectors - List connectors
 * POST /api/v1/connectors - Create connector
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { authMiddleware } from 'src/app/api/lib/middleware/auth';
import { getOrganizationId } from 'src/app/api/lib/headless-mode';
import { connectorService } from 'src/app/api/lib/connectors/connector-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * Connector creation schema
 */
const ConnectorCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum([
    'rest_api',
    'database',
    'cloud_storage',
    'flyte_workflow',
    'graphql',
    'webhook',
    'custom',
  ]),
  configuration: z.any(),
  authentication: z.any().optional(),
  schema: z.any().optional(),
  dataMapping: z.any().optional(),
  caching: z.any().optional(),
  rateLimit: z.any().optional(),
  healthCheck: z.any().optional(),
  status: z.enum(['active', 'inactive', 'error', 'testing']).default('active'),
  tags: z.array(z.string()).optional(), // Tags for automatic field matching
  category: z.string().optional(), // Category for organization
});

/**
 * GET /api/v1/connectors
 * List connectors for the organization
 */
export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return auth error
    }

    // Get organization ID from header (set by axios interceptor) or use headless mock
    const organizationId = getOrganizationId(request);

    if (!organizationId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID required', requestId),
        { status: 401 }
      );
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const filters = {
      type: searchParams.get('type') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const connectors = await connectorService.listConnectors(organizationId, filters);

    return NextResponse.json(
      createSuccessEnvelope(
        {
          connectors,
          totalCount: connectors.length,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error listing connectors:', error);

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to list connectors', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/connectors
 * Create a new connector
 */
export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return auth error
    }

    // Get organization ID from header (set by axios interceptor) or use headless mock
    const organizationId = getOrganizationId(request);

    if (!organizationId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID required', requestId),
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = ConnectorCreateSchema.parse(body);

    const connector = await connectorService.createConnector({
      ...validatedData,
      organizationId,
      createdBy: authResult.user?.id || 'unknown', // Use authenticated user ID
    } as any);

    return NextResponse.json(
      createSuccessEnvelope(
        {
          connector,
          message: 'Connector created successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating connector:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Invalid connector data', requestId, {
          details: error.issues,
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to create connector', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
