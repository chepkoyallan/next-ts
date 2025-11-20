/**
 * Engine API - Workflows
 * Workflow management endpoints using the engine
 */

import fs from 'fs';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import {
  trackEngineUsage,
  requireSecureEngine,
  auditEngineOperation,
} from 'src/app/api/lib/services/engine-helper-rbac';

import { WorkflowListQuerySchema, WorkflowCreateRequestSchema } from '../schemas';

/**
 * GET /api/v1/engine/workflows
 * List workflows with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'workflows',
      rbac: RBACDecorators.requirePermission('workflows', 'read'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager } = result;

    // Validate query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = WorkflowListQuerySchema.parse(queryParams);

    const queryResult = await engineManager.services.workflows!.queryWorkflows({
      project: validatedQuery.project || undefined,
      domain: validatedQuery.domain || undefined,
      name: validatedQuery.name || undefined,
      version: validatedQuery.version || undefined,
      limit: validatedQuery.limit,
    });

    return NextResponse.json({
      success: true,
      data: {
        workflows: queryResult.workflows || [],
        token: queryResult.token || '',
      },
    });
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
        error: error instanceof Error ? error.message : 'Failed to list workflows',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/engine/workflows
 * Create a new workflow
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('workflows', 'create'),
      checkSubscription: true,
      trackUsage: true,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { userId } = result;

    // Validate request body
    const body = await request.json();
    const validatedData = WorkflowCreateRequestSchema.parse(body);

    // Null safety check
    if (!validatedData.id) throw new Error('Workflow ID is required');

    console.log(
      '[WorkflowRoute] Creating workflow with payload:',
      JSON.stringify(
        {
          id: validatedData.id,
          spec: validatedData.spec,
        },
        null,
        2
      )
    );

    // Use HTTP API instead of gRPC to avoid "13 INTERNAL" errors
    const flyteAdminUrl = process.env.FLYTE_ADMIN_HTTP_URL || 'http://localhost:8088';
    console.log(
      `[WorkflowRoute] Sending workflow to Flyte Admin HTTP API: ${flyteAdminUrl}/api/v1/workflows`
    );

    // CRITICAL: Convert camelCase protobuf to snake_case JSON for Flyte Admin HTTP API
    // Flyte's HTTP API expects snake_case while protobuf JS uses camelCase
    const convertToSnakeCase = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) return obj.map(convertToSnakeCase);
      if (typeof obj !== 'object') return obj;

      const converted: any = {};
      Object.keys(obj).forEach((key) => {
        // Convert camelCase to snake_case
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        converted[snakeKey] = convertToSnakeCase(obj[key]);
      });
      return converted;
    };

    const requestPayload = convertToSnakeCase({
      id: validatedData.id,
      spec: validatedData.spec,
    });

    // Log a sample of the payload for debugging (not the full thing as it's huge)
    console.log('[WorkflowRoute] HTTP request payload structure:', {
      hasId: !!requestPayload.id,
      hasSpec: !!requestPayload.spec,
      hasTemplate: !!requestPayload.spec?.template,
      templateNodeCount: requestPayload.spec?.template?.nodes?.length,
      subWorkflowCount: requestPayload.spec?.sub_workflows?.length,
    });

    // DEBUG: Save payload to file for inspection
    const payloadPath = '/tmp/flyte-workflow-payload.json';
    fs.writeFileSync(payloadPath, JSON.stringify(requestPayload, null, 2));
    console.log(`[WorkflowRoute] Saved payload to ${payloadPath} for debugging`);

    const response = await fetch(`${flyteAdminUrl}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    console.log(`[WorkflowRoute] Flyte Admin response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WorkflowRoute] Flyte Admin error response:`, errorText);
      throw new Error(`Flyte Admin returned ${response.status}: ${errorText}`);
    }

    const workflowResult = await response.json();
    console.log(`[WorkflowRoute] Workflow created successfully via HTTP API`);

    // Track usage for billing
    await trackEngineUsage(userId, 'workflow', 1, {
      project: validatedData.id.project,
      domain: validatedData.id.domain,
      name: validatedData.id.name,
    });

    // Audit log
    await auditEngineOperation(
      userId,
      'workflow_created',
      'workflows',
      `${validatedData.id.project}:${validatedData.id.domain}:${validatedData.id.name}`,
      { version: validatedData.id.version }
    );

    return NextResponse.json({
      success: true,
      data: workflowResult,
    });
  } catch (error) {
    // Enhanced error logging
    console.error('[WorkflowRoute] Error creating workflow:', error);
    if (error instanceof Error) {
      console.error('[WorkflowRoute] Error message:', error.message);
      console.error('[WorkflowRoute] Error stack:', error.stack);
      console.error(
        '[WorkflowRoute] Error details:',
        JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
      );
    }

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

    // Check if it's a gRPC error with additional properties
    const grpcError = error as any;
    const errorMessage = grpcError.message || 'Failed to create workflow';
    const errorDetails = grpcError.details || grpcError.metadata || undefined;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
