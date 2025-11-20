/**
 * Engine API - Data Proxy
 * Data upload/download location management endpoints
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';

import {
  CreateDownloadLinkRequestSchema,
  CreateUploadLocationRequestSchema,
  CreateDownloadLocationRequestSchema,
} from '../schemas';

/**
 * POST /api/v1/engine/data-proxy/upload
 * Create upload location for data artifacts
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action') || 'upload';

    // Determine RBAC config based on action
    const rbacConfig =
      action === 'upload'
        ? RBACDecorators.requirePermission('executions', 'create')
        : RBACDecorators.requirePermission('executions', 'read');

    const result = await requireSecureEngine(request, {
      serviceName: 'dataProxy',
      rbac: rbacConfig,
      checkSubscription: action === 'upload',
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager } = result;

    // Validate request body
    const body = await request.json();

    if (action === 'upload') {
      const validatedData = CreateUploadLocationRequestSchema.parse(body);
      const uploadResult = await engineManager.services.dataProxy!.createUploadLocation({
        project: validatedData.project,
        domain: validatedData.domain,
        filename: validatedData.filename,
        expiresIn: validatedData.expiresIn || undefined,
        contentMd5: validatedData.contentMd5 || undefined,
      } as any);
      return NextResponse.json({
        success: true,
        data: uploadResult,
      });
    }

    if (action === 'download') {
      const validatedData = CreateDownloadLocationRequestSchema.parse(body);
      const downloadResult = await engineManager.services.dataProxy!.createDownloadLocation({
        nativeUrl: validatedData.nativeUrl,
        expiresIn: validatedData.expiresIn || undefined,
      } as any);
      return NextResponse.json({
        success: true,
        data: downloadResult,
      });
    }

    if (action === 'download-link') {
      const validatedData = CreateDownloadLinkRequestSchema.parse(body);
      const linkResult = await engineManager.services.dataProxy!.createDownloadLink({
        artifactType: validatedData.artifactType,
        expiresIn: validatedData.expiresIn || undefined,
        nodeExecutionId: validatedData.nodeExecutionId,
      } as any);
      return NextResponse.json({
        success: true,
        data: linkResult,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Use ?action=upload, ?action=download, or ?action=download-link',
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create data location',
      },
      { status: 500 }
    );
  }
}
