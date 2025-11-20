import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../lib/services/metrics-service';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';
import {
  getSchema,
  updateSchema,
  deleteSchema,
  CreateSchemaInput,
} from '../../../lib/services/form-generation-service';

/**
 * GET /api/v1/forms/[id]
 * Get a specific form schema by ID
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { id } = params;

    if (!id) {
      recordMetric({
        endpoint: '/api/v1/forms/[id]',
        method: 'GET',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Schema ID is required', requestId),
        { status: 400 }
      );
    }

    const schema = getSchema(id);

    if (!schema) {
      recordMetric({
        endpoint: '/api/v1/forms/[id]',
        method: 'GET',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Form schema not found', requestId),
        { status: 404 }
      );
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/[id]',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope({ schema }, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching form schema:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/[id]',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch form schema', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/forms/[id]
 * Update a form schema
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const traceId = request.headers.get('x-trace-id') || undefined;

  try {
    const { id } = params;
    const body = await request.json();

    if (!id) {
      recordMetric({
        endpoint: '/api/v1/forms/[id]',
        method: 'PUT',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Schema ID is required', requestId),
        { status: 400 }
      );
    }

    // Check if schema exists
    const existingSchema = getSchema(id);
    if (!existingSchema) {
      recordMetric({
        endpoint: '/api/v1/forms/[id]',
        method: 'PUT',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Form schema not found', requestId),
        { status: 404 }
      );
    }

    const updates: Partial<CreateSchemaInput> = {};

    // Only update provided fields
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.version !== undefined) updates.version = body.version;
    if (body.schema !== undefined) updates.schema = body.schema;
    if (body.uischema !== undefined) updates.uischema = body.uischema;
    if (body.dataSources !== undefined) updates.dataSources = body.dataSources;
    if (body.dependencies !== undefined) updates.dependencies = body.dependencies;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.category !== undefined) updates.category = body.category;

    const updatedSchema = await updateSchema(id, updates, traceId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/[id]',
      method: 'PUT',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          schema: updatedSchema,
          message: 'Form schema updated successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating form schema:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/[id]',
      method: 'PUT',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'UPDATE_ERROR',
        error.message || 'Failed to update form schema',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/v1/forms/[id]
 * Delete a form schema
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const traceId = request.headers.get('x-trace-id') || undefined;

  try {
    const { id } = params;

    if (!id) {
      recordMetric({
        endpoint: '/api/v1/forms/[id]',
        method: 'DELETE',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Schema ID is required', requestId),
        { status: 400 }
      );
    }

    // Check if schema exists
    const existingSchema = getSchema(id);
    if (!existingSchema) {
      recordMetric({
        endpoint: '/api/v1/forms/[id]',
        method: 'DELETE',
        statusCode: 404,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Form schema not found', requestId),
        { status: 404 }
      );
    }

    await deleteSchema(id, traceId);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/[id]',
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          message: 'Form schema deleted successfully',
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting form schema:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/[id]',
      method: 'DELETE',
      statusCode: 400,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'DELETE_ERROR',
        error.message || 'Failed to delete form schema',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 400 }
    );
  }
}
