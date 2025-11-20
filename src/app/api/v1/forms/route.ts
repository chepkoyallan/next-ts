import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../lib/services/metrics-service';
import { getOrganizationContext } from '../../lib/middleware/tenant-scope';
import { createErrorEnvelope, createSuccessEnvelope } from '../../lib/middleware/transformation';
import {
  createSchema,
  getAllSchemas,
  getAvailableTags,
  CreateSchemaInput,
  getAvailableCategories,
} from '../../lib/services/form-generation-service';

/**
 * GET /api/v1/forms
 * Get all form schemas with optional filtering
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    // Get organization context for multi-tenancy
    const { organizationId } = await getOrganizationContext(request);

    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search') || undefined;
    const category = searchParams.get('category') || undefined;
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const createdBy = searchParams.get('createdBy') || undefined;
    const includeCategories = searchParams.get('includeCategories') === 'true';
    const includeTags = searchParams.get('includeTags') === 'true';

    const allSchemas = await getAllSchemas({
      search,
      category,
      tags,
      createdBy,
      organizationId, // CRITICAL: Filter by organization
    });

    const response: any = {
      schemas: allSchemas,
      total: allSchemas.length,
    };

    if (includeCategories) {
      response.availableCategories = getAvailableCategories();
    }

    if (includeTags) {
      response.availableTags = getAvailableTags();
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope(response, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching form schemas:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch form schemas', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/forms
 * Create a new form schema
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const traceId = request.headers.get('x-trace-id') || undefined;

  try {
    // Get organization context for multi-tenancy
    const { organizationId, userId } = await getOrganizationContext(request);

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      recordMetric({
        endpoint: '/api/v1/forms',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Schema name is required', requestId),
        { status: 400 }
      );
    }

    if (!body.schema) {
      recordMetric({
        endpoint: '/api/v1/forms',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Schema definition is required', requestId),
        { status: 400 }
      );
    }

    const input: CreateSchemaInput = {
      name: body.name,
      description: body.description,
      version: body.version || '1.0.0',
      schema: body.schema,
      uischema: body.uischema,
      dataSources: body.dataSources,
      dependencies: body.dependencies,
      tags: body.tags || [],
      category: body.category || 'general',
    };

    const newSchema = await createSchema(input, userId, organizationId, traceId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          schema: newSchema,
          message: 'Form schema created successfully',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating form schema:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms',
      method: 'POST',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'CREATE_ERROR',
        error.message || 'Failed to create form schema',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}
