/**
 * AI Provider Keys API
 * Manage user API keys for AI providers (OpenAI, Anthropic, Google, Azure)
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { encrypt } from '../../lib/services/encryption-service';
import { getUserContext } from '../../lib/middleware/auth-scope';
import { recordMetric } from '../../lib/services/metrics-service';
import { getOrganizationContext } from '../../lib/middleware/tenant-scope';
import { createErrorEnvelope, createSuccessEnvelope } from '../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

// Supported AI providers
const VALID_PROVIDERS = ['openai', 'anthropic', 'google', 'azure_openai'];

/**
 * GET /api/v1/ai-keys
 * List all AI provider keys for the current user
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { userId } = await getUserContext(request);
    const { organizationId } = await getOrganizationContext(request);

    // Get query parameters
    const { searchParams } = request.nextUrl;
    const provider = searchParams.get('provider');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // Build where clause
    const where: any = {
      userId,
      organizationId,
    };

    if (provider && VALID_PROVIDERS.includes(provider)) {
      where.provider = provider;
    }

    if (activeOnly) {
      where.isActive = true;
    }

    // Fetch keys (without decrypted values)
    const keys = await prisma.aIProviderKey.findMany({
      where,
      select: {
        id: true,
        userId: true,
        organizationId: true,
        provider: true,
        keyName: true,
        model: true,
        isDefault: true,
        isActive: true,
        usageCount: true,
        lastUsedAt: true,
        totalCostUsd: true,
        lastTestedAt: true,
        testStatus: true,
        testError: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        // DO NOT return encryptedKey in list
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    recordMetric({
      endpoint: '/api/v1/ai-keys',
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope({ keys, total: keys.length }, requestId), {
      status: 200,
    });
  } catch (error: any) {
    console.error('Error fetching AI keys:', error);

    recordMetric({
      endpoint: '/api/v1/ai-keys',
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch AI provider keys', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/ai-keys
 * Create a new AI provider key
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { userId } = await getUserContext(request);
    const { organizationId } = await getOrganizationContext(request);

    const body = await request.json();
    const { provider, keyName, apiKey, model, isDefault } = body;

    // Validation
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}`,
          requestId
        ),
        { status: 400 }
      );
    }

    if (!keyName || !keyName.trim()) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Key name is required', requestId),
        { status: 400 }
      );
    }

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'API key is required', requestId),
        { status: 400 }
      );
    }

    // Check for duplicate key name for this provider
    const existing = await prisma.aIProviderKey.findUnique({
      where: {
        userId_provider_keyName: {
          userId,
          provider,
          keyName: keyName.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        createErrorEnvelope(
          'DUPLICATE_KEY',
          `A key named "${keyName}" already exists for provider "${provider}"`,
          requestId
        ),
        { status: 409 }
      );
    }

    // If this should be default, unset other defaults for this provider
    if (isDefault) {
      await prisma.aIProviderKey.updateMany({
        where: {
          userId,
          provider,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Create the key with encrypted API key
    const createdKey = await prisma.aIProviderKey.create({
      data: {
        userId,
        organizationId,
        provider,
        keyName: keyName.trim(),
        encryptedKey: encrypt(apiKey.trim()),
        model: model?.trim() || null,
        isDefault: isDefault || false,
        isActive: true,
        usageCount: 0,
        totalCostUsd: 0,
        metadata: {},
      },
    });

    // Return without the encrypted key
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedKey, ...keyResponse } = createdKey;

    recordMetric({
      endpoint: '/api/v1/ai-keys',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope({ key: keyResponse }, requestId), {
      status: 201,
    });
  } catch (error: any) {
    console.error('Error creating AI key:', error);

    recordMetric({
      endpoint: '/api/v1/ai-keys',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to create AI provider key', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
