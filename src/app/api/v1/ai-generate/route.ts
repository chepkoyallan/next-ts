/**
 * AI Code Generation API
 * Generate, explain, improve, and refactor task code using AI
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { getUserContext } from '../../lib/middleware/auth-scope';
import { recordMetric } from '../../lib/services/metrics-service';
import { getOrganizationContext } from '../../lib/middleware/tenant-scope';
import { AIGenerationService } from '../../lib/services/ai-generation-service';
import { createErrorEnvelope, createSuccessEnvelope } from '../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/ai-generate
 * Generate code using AI
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { userId } = await getUserContext(request);
    const { organizationId } = await getOrganizationContext(request);

    const body = await request.json();
    const {
      taskId,
      taskName,
      description,
      inputSchemaId,
      outputSchemaId,
      functionName,
      parameterName,
      inputTypeName,
      outputTypeName,
      existingCode,
      generationType,
      userDescription,
      providerKeyId,
      temperature,
      maxTokens,
    } = body;

    // Validation
    if (
      !generationType ||
      !['generate', 'explain', 'improve', 'refactor'].includes(generationType)
    ) {
      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'generationType must be one of: generate, explain, improve, refactor',
          requestId
        ),
        { status: 400 }
      );
    }

    if (!taskName) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'taskName is required', requestId),
        { status: 400 }
      );
    }

    if (!inputSchemaId || !outputSchemaId) {
      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'inputSchemaId and outputSchemaId are required',
          requestId
        ),
        { status: 400 }
      );
    }

    // Fetch schemas
    const [inputSchema, outputSchema] = await Promise.all([
      prisma.formSchema.findFirst({
        where: { id: inputSchemaId, organizationId },
      }),
      prisma.formSchema.findFirst({
        where: { id: outputSchemaId, organizationId },
      }),
    ]);

    if (!inputSchema) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Input schema not found', requestId),
        { status: 404 }
      );
    }

    if (!outputSchema) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'Output schema not found', requestId),
        { status: 404 }
      );
    }

    // Build context
    const context = {
      taskId,
      taskName,
      description,
      inputSchema: inputSchema.schema,
      outputSchema: outputSchema.schema,
      functionName: functionName || 'process_data',
      parameterName: parameterName || 'input_data',
      inputTypeName: inputTypeName || 'InputType',
      outputTypeName: outputTypeName || 'OutputType',
      existingCode,
    };

    // Generate code using AI
    const result = await AIGenerationService.generateCode(userId, organizationId, context, {
      generationType,
      userDescription,
      providerKeyId,
      temperature,
      maxTokens,
    });

    recordMetric({
      endpoint: '/api/v1/ai-generate',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          generatedCode: result.generatedCode,
          explanation: result.explanation,
          model: result.model,
          provider: result.provider,
          tokensUsed: result.tokensUsed,
          costUsd: result.costUsd,
          generationLogId: result.generationLogId,
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error generating code:', error);

    recordMetric({
      endpoint: '/api/v1/ai-generate',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('GENERATION_ERROR', 'Failed to generate code', requestId, {
        message: error.message,
        provider: error.provider,
      }),
      { status: 500 }
    );
  }
}
