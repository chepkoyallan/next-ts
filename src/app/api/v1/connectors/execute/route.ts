/**
 * Connector Execution API Route
 * POST /api/v1/connectors/execute - Execute a connector
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { connectorService } from 'src/app/api/lib/connectors/connector-service';
import { isHeadlessMode, HEADLESS_USER_ID, getOrganizationId } from 'src/app/api/lib/headless-mode';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * Connector execution schema
 */
const ExecuteSchema = z.object({
  connectorId: z.string(),
  query: z
    .object({
      search: z.string().optional(),
      filters: z.record(z.string(), z.any()).optional(),
      sort: z
        .object({
          field: z.string(),
          direction: z.enum(['asc', 'desc']),
        })
        .optional(),
      pagination: z
        .object({
          page: z.number(),
          pageSize: z.number(),
        })
        .optional(),
      customParams: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
});

/**
 * POST /api/v1/connectors/execute
 * Execute a connector with query parameters
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

  try {
    // Get organization ID (handles headless mode)
    const organizationId = getOrganizationId(request);

    // Get user ID - use headless user in headless mode
    const userId = isHeadlessMode() ? HEADLESS_USER_ID : request.headers.get('x-user-id');

    if (!organizationId || !userId) {
      return NextResponse.json(
        createErrorEnvelope('UNAUTHORIZED', 'Organization ID and User ID required', requestId),
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = ExecuteSchema.parse(body);

    const result = await connectorService.executeConnector(
      validatedData.connectorId,
      validatedData.query || {},
      {
        userId,
        organizationId,
        requestId,
        timestamp: new Date(),
      }
    );

    const executionTime = Date.now() - startTime;

    return NextResponse.json(
      createSuccessEnvelope(
        {
          ...result,
          metadata: {
            requestId,
            totalExecutionTime: executionTime,
            cached: result.cached || false,
          },
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error executing connector:', error);

    const executionTime = Date.now() - startTime;

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Invalid execution request', requestId, {
          details: error.issues,
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createErrorEnvelope('EXECUTION_ERROR', 'Failed to execute connector', requestId, {
        message: error.message,
        executionTime,
      }),
      { status: 500 }
    );
  }
}
