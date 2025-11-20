/**
 * Engine API - Executions
 * Execution management endpoints using the engine
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import {
  trackEngineUsage,
  requireSecureEngine,
  auditEngineOperation,
} from 'src/app/api/lib/services/engine-helper-rbac';

import { IdentifierSchema, ExecutionListQuerySchema } from '../schemas';

// Simplified execution creation schema (for createExecutionSimple)
const ExecutionCreateSimpleSchema = z
  .object({
    project: z.string().min(1),
    domain: z.string().min(1),
    name: z.string().min(1),
    workflowId: IdentifierSchema.optional(),
    launchPlanId: IdentifierSchema.optional(),
    inputs: z.record(z.string(), z.any()).optional(),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
  })
  .refine((data) => data.workflowId || data.launchPlanId, {
    message: 'Either workflowId or launchPlanId is required',
  });

/**
 * GET /api/v1/engine/executions
 * List executions with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'workflows',
      rbac: RBACDecorators.requirePermission('executions', 'read'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { context } = result;
    const { organizationId } = context;

    if (!organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization ID not found',
        },
        { status: 400 }
      );
    }

    // Validate query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = ExecutionListQuerySchema.parse(queryParams);

    // Use database as source of truth (filtered by organization)
    const { prisma } = await import('src/lib/prisma');

    // Get execution status summary if requested
    if (validatedQuery.summary === 'true') {
      if (!validatedQuery.project) {
        return NextResponse.json(
          { success: false, error: 'Project parameter required for summary' },
          { status: 400 }
        );
      }

      const where: any = {
        organizationId,
        projectId: validatedQuery.project,
      };

      if (validatedQuery.domain) where.domain = validatedQuery.domain;

      const summary = await prisma.workflowExecution.groupBy({
        by: ['phase'],
        where,
        _count: { id: true },
      });

      return NextResponse.json({
        success: true,
        data: {
          summary: summary.map((s) => ({ phase: s.phase, count: s._count.id })),
        },
      });
    }

    // Get engine manager from the result we already have
    const { engineManager } = result;

    if (!engineManager?.services?.workflows) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow service not available',
        },
        { status: 503 }
      );
    }

    // List executions from Flyte using queryExecutions
    const flyteExecutions = await engineManager.services.workflows!.queryExecutions({
      project: validatedQuery.project || organizationId,
      domain: validatedQuery.domain || 'development',
      limit: validatedQuery.limit || 50,
    });

    // Convert Flyte format to API format
    const apiExecutions = (flyteExecutions.executions || []).map((exec: any) => {
      // Extract project, domain, name from execution ID
      const project = exec.id?.project || validatedQuery.project || organizationId || 'aus';
      const domain = exec.id?.domain || validatedQuery.domain || 'development';
      const name = exec.id?.name || 'unknown';

      return {
        id: {
          project,
          domain,
          name,
        },
        name,
        workflowId: exec.spec?.workflowId || exec.closure?.workflowId,
        status: exec.closure?.phase || 'UNKNOWN',
        phase: exec.closure?.phase || 'UNKNOWN',
        startedAt: (() => {
          if (exec.closure?.startedAt?.seconds) {
            return new Date(Number(exec.closure.startedAt.seconds) * 1000).toISOString();
          }
          if (exec.closure?.createdAt?.seconds) {
            return new Date(Number(exec.closure.createdAt.seconds) * 1000).toISOString();
          }
          return undefined;
        })(),
        duration: exec.closure?.duration?.seconds ? `${exec.closure.duration.seconds}s` : undefined,
        inputs: exec.spec?.inputs,
        outputs: exec.closure?.outputs,
        error: exec.closure?.error,
        createdAt: exec.closure?.createdAt?.seconds
          ? new Date(Number(exec.closure.createdAt.seconds) * 1000).toISOString()
          : undefined,
        updatedAt: exec.closure?.updatedAt?.seconds
          ? new Date(Number(exec.closure.updatedAt.seconds) * 1000).toISOString()
          : undefined,
      };
    });

    // Helper function to convert Flyte phase (int or string) to Prisma enum
    const convertPhaseToEnum = (
      phase: any
    ):
      | 'UNDEFINED'
      | 'QUEUED'
      | 'RUNNING'
      | 'SUCCEEDED'
      | 'FAILED'
      | 'FAILING'
      | 'ABORTED'
      | 'TIMED_OUT' => {
      // If it's already a string, return as-is
      if (typeof phase === 'string') {
        return phase as any;
      }

      // Convert Flyte integer phase to string enum
      // https://github.com/flyteorg/flyteidl/blob/master/protos/flyteidl/core/execution.proto
      const phaseMap: Record<
        number,
        | 'UNDEFINED'
        | 'QUEUED'
        | 'RUNNING'
        | 'SUCCEEDED'
        | 'FAILED'
        | 'FAILING'
        | 'ABORTED'
        | 'TIMED_OUT'
      > = {
        0: 'UNDEFINED',
        1: 'QUEUED',
        2: 'RUNNING',
        3: 'SUCCEEDED',
        4: 'FAILED',
        5: 'FAILING',
        6: 'ABORTED',
        7: 'TIMED_OUT',
      };

      return phaseMap[phase] || 'UNDEFINED';
    };

    // Sync to database for offline access (async, don't wait)
    // Note: This is best-effort caching, failures are logged but don't affect the response
    prisma.workflowExecution
      .createMany({
        data: apiExecutions.map((exec: any) => ({
          executionId: exec.name,
          projectId: exec.id.project,
          organizationId,
          domain: exec.id.domain,
          name: exec.name,
          workflowId: null, // Don't link to workflow table to avoid FK constraint issues
          launchPlanId: null,
          phase: convertPhaseToEnum(exec.phase),
          startedAt: exec.startedAt ? new Date(exec.startedAt) : null,
          duration: exec.duration,
          inputs: exec.inputs || {},
          outputs: exec.outputs || {},
          error: exec.error || null,
          flyteExecutionId: `${exec.id.project}:${exec.id.domain}:${exec.id.name}`,
          createdBy: organizationId,
        })),
        skipDuplicates: true,
      })
      .catch((err) => {
        // Silently fail - this is just background caching
        console.debug('Background execution sync skipped:', err.message);
      });

    return NextResponse.json({
      success: true,
      data: {
        executions: apiExecutions,
        token: flyteExecutions.token || '',
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
        error: error instanceof Error ? error.message : 'Failed to list executions',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/engine/executions
 * Create a new execution
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'workflows',
      rbac: RBACDecorators.requirePermission('executions', 'create'),
      checkSubscription: true,
      trackUsage: true,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId, context } = result;
    const { organizationId } = context;

    if (!organizationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Organization ID not found',
        },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = ExecutionCreateSimpleSchema.parse(body);

    // Check tier limits for execution creation
    const { checkTierLimit } = await import('src/app/api/lib/services/engine-helper-rbac');
    const tierCheck = await checkTierLimit(
      userId,
      context.subscriptionTier || 'free',
      'executions',
      'create'
    );

    if (!tierCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: tierCheck.reason,
          code: 'TIER_LIMIT_EXCEEDED',
          upgradeUrl: tierCheck.upgradeUrl,
          current: tierCheck.current,
          limit: tierCheck.limit,
        },
        { status: 402 } // Payment Required
      );
    }

    // Generate Flyte execution ID with organization prefix
    const { generateFlyteExecutionId } = await import(
      'src/app/api/lib/services/resource-isolation-helper'
    );

    const flyteExecutionId = generateFlyteExecutionId(
      organizationId,
      validatedData.project,
      validatedData.domain,
      validatedData.name
    );

    // Create execution in Flyte with org-prefixed project
    const executionResult = await engineManager.services.workflows!.createExecutionSimple({
      project: flyteExecutionId.split(':')[0], // Use org-prefixed project
      domain: validatedData.domain,
      name: validatedData.name,
      workflowId: validatedData.workflowId,
      launchPlanId: validatedData.launchPlanId,
      inputs: validatedData.inputs,
      labels: validatedData.labels,
      annotations: validatedData.annotations,
    } as any);

    // Sync to database
    const { prisma } = await import('src/lib/prisma');

    // Get the execution ID from the result (if available)
    const executionId = executionResult?.id?.name || validatedData.name;

    await prisma.workflowExecution.create({
      data: {
        executionId,
        projectId: validatedData.project, // User-friendly project ID
        organizationId,
        domain: validatedData.domain,
        name: validatedData.name,
        workflowId: validatedData.workflowId
          ? `${validatedData.workflowId.project}:${validatedData.workflowId.domain}:${validatedData.workflowId.name}:${validatedData.workflowId.version}`
          : null,
        launchPlanId: validatedData.launchPlanId
          ? `${validatedData.launchPlanId.project}:${validatedData.launchPlanId.domain}:${validatedData.launchPlanId.name}:${validatedData.launchPlanId.version}`
          : null,
        inputs: validatedData.inputs || {},
        flyteExecutionId,
        createdBy: userId,
      },
    });

    // Track usage for billing
    await trackEngineUsage(userId, 'execution', 1, {
      project: validatedData.project,
      domain: validatedData.domain,
      name: validatedData.name,
    });

    // Audit log
    await auditEngineOperation(
      userId,
      'execution_created',
      'executions',
      `${validatedData.project}:${validatedData.domain}:${validatedData.name}`,
      {
        workflowId: validatedData.workflowId,
        launchPlanId: validatedData.launchPlanId,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        ...executionResult,
        id: {
          project: validatedData.project, // Return user-friendly project ID
          domain: validatedData.domain,
          name: validatedData.name,
        },
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
        error: error instanceof Error ? error.message : 'Failed to create execution',
      },
      { status: 500 }
    );
  }
}
