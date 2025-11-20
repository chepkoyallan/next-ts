import { NextRequest, NextResponse } from 'next/server';

import { recordMetric } from '../../../lib/services/metrics-service';
import { validateJsonSchema } from '../../../lib/services/form-generation-service';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';

/**
 * POST /api/v1/forms/validate
 * Validate a JSON schema structure
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const body = await request.json();

    if (!body.schema) {
      recordMetric({
        endpoint: '/api/v1/forms/validate',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Schema is required for validation', requestId),
        { status: 400 }
      );
    }

    const validationResult = validateJsonSchema(body.schema);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/validate',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          valid: validationResult.isValid,
          isValid: validationResult.isValid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error validating schema:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/validate',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope(
        'VALIDATION_ERROR',
        error.message || 'Failed to validate schema',
        requestId,
        {
          details: error.message,
        }
      ),
      { status: 500 }
    );
  }
}
