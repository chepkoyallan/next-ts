/**
 * AI Provider Key Management (Single Key)
 * Update, delete, and test individual AI provider keys
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { encrypt } from '../../../lib/services/encryption-service';
import { getUserContext } from '../../../lib/middleware/auth-scope';
import { recordMetric } from '../../../lib/services/metrics-service';
import { getOrganizationContext } from '../../../lib/middleware/tenant-scope';
import { createErrorEnvelope, createSuccessEnvelope } from '../../../lib/middleware/transformation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/ai-keys/[id]
 * Get a specific AI provider key (without revealing the actual API key)
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { id } = params;
    const { userId } = await getUserContext(request);
    const { organizationId } = await getOrganizationContext(request);

    const key = await prisma.aIProviderKey.findFirst({
      where: {
        id,
        userId,
        organizationId,
      },
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
      },
    });

    if (!key) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'AI provider key not found', requestId),
        { status: 404 }
      );
    }

    recordMetric({
      endpoint: `/api/v1/ai-keys/${id}`,
      method: 'GET',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope({ key }, requestId), { status: 200 });
  } catch (error: any) {
    console.error('Error fetching AI key:', error);

    recordMetric({
      endpoint: `/api/v1/ai-keys/${params.id}`,
      method: 'GET',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to fetch AI provider key', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/ai-keys/[id]
 * Update an AI provider key (name, model, default status, active status)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { id } = params;
    const { userId } = await getUserContext(request);
    const { organizationId } = await getOrganizationContext(request);

    const body = await request.json();
    const { keyName, model, isDefault, isActive, apiKey } = body;

    // Verify key exists and belongs to user
    const existingKey = await prisma.aIProviderKey.findFirst({
      where: {
        id,
        userId,
        organizationId,
      },
    });

    if (!existingKey) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'AI provider key not found', requestId),
        { status: 404 }
      );
    }

    // Build update data
    const updateData: any = {};

    if (keyName !== undefined && keyName.trim()) {
      // Check for duplicate key name
      const duplicate = await prisma.aIProviderKey.findFirst({
        where: {
          userId,
          provider: existingKey.provider,
          keyName: keyName.trim(),
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          createErrorEnvelope(
            'DUPLICATE_KEY',
            `A key named "${keyName}" already exists for this provider`,
            requestId
          ),
          { status: 409 }
        );
      }

      updateData.keyName = keyName.trim();
    }

    if (model !== undefined) {
      updateData.model = model?.trim() || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = Boolean(isActive);
    }

    if (isDefault !== undefined) {
      const shouldBeDefault = Boolean(isDefault);

      if (shouldBeDefault) {
        // Unset other defaults for this provider
        await prisma.aIProviderKey.updateMany({
          where: {
            userId,
            provider: existingKey.provider,
            isDefault: true,
            id: { not: id },
          },
          data: {
            isDefault: false,
          },
        });
      }

      updateData.isDefault = shouldBeDefault;
    }

    // Update API key if provided (re-encrypt)
    if (apiKey && apiKey.trim()) {
      updateData.encryptedKey = encrypt(apiKey.trim());
      updateData.testStatus = null; // Reset test status when key changes
      updateData.testError = null;
      updateData.lastTestedAt = null;
    }

    // Update the key
    const updated = await prisma.aIProviderKey.update({
      where: { id },
      data: updateData,
    });

    // Return without encrypted key
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { encryptedKey, ...keyResponse } = updated;

    recordMetric({
      endpoint: `/api/v1/ai-keys/${id}`,
      method: 'PATCH',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(createSuccessEnvelope({ key: keyResponse }, requestId), {
      status: 200,
    });
  } catch (error: any) {
    console.error('Error updating AI key:', error);

    recordMetric({
      endpoint: `/api/v1/ai-keys/${params.id}`,
      method: 'PATCH',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to update AI provider key', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/ai-keys/[id]
 * Delete an AI provider key
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const { id } = params;
    const { userId } = await getUserContext(request);
    const { organizationId } = await getOrganizationContext(request);

    // Verify key exists and belongs to user
    const existingKey = await prisma.aIProviderKey.findFirst({
      where: {
        id,
        userId,
        organizationId,
      },
    });

    if (!existingKey) {
      return NextResponse.json(
        createErrorEnvelope('NOT_FOUND', 'AI provider key not found', requestId),
        { status: 404 }
      );
    }

    // Delete the key
    await prisma.aIProviderKey.delete({
      where: { id },
    });

    recordMetric({
      endpoint: `/api/v1/ai-keys/${id}`,
      method: 'DELETE',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope({ message: 'AI provider key deleted successfully' }, requestId),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting AI key:', error);

    recordMetric({
      endpoint: `/api/v1/ai-keys/${params.id}`,
      method: 'DELETE',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to delete AI provider key', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
