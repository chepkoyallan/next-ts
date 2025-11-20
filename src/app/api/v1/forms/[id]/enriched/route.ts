/**
 * Enriched Form Schema API
 * GET /api/v1/forms/:id/enriched - Get form schema with automatic connector enrichment
 */

import { NextRequest, NextResponse } from 'next/server';

import { authMiddleware } from 'src/app/api/lib/middleware/auth';
import { getOrganizationId } from 'src/app/api/lib/headless-mode';
import { getEnrichedSchema } from 'src/app/api/lib/services/form-generation-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * GET /api/v1/forms/:id/enriched
 * Get form schema with automatic connector data sources
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    // Authenticate user
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return auth error
    }

    // Get organization ID from header
    const organizationId = getOrganizationId(request);
    if (!organizationId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID required', requestId),
        { status: 401 }
      );
    }

    // Get query parameters for enrichment options
    const { searchParams } = new URL(request.url);
    const autoEnrich = searchParams.get('autoEnrich') !== 'false'; // Default: true
    const matchThreshold = parseFloat(searchParams.get('matchThreshold') || '0.6');
    const excludeFields = searchParams.get('excludeFields')?.split(',') || [];

    // Get enriched schema
    const enrichedSchema = await getEnrichedSchema(params.id, organizationId, {
      autoEnrich,
      matchThreshold,
      excludeFields,
    });

    if (!enrichedSchema) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Form schema not found', requestId),
        { status: 404 }
      );
    }

    return NextResponse.json(
      createSuccessEnvelope(
        {
          schema: enrichedSchema,
          message: 'Form schema retrieved with connector enrichment',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error getting enriched schema:', error);

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to get enriched schema', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
