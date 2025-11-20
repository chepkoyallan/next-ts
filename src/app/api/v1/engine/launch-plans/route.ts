/**
 * Engine API - Launch Plans
 * Launch plan management endpoints using the engine
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import {
  trackEngineUsage,
  requireSecureEngine,
  auditEngineOperation,
} from 'src/app/api/lib/services/engine-helper-rbac';

import { LaunchPlanListQuerySchema, LaunchPlanCreateRequestSchema } from '../schemas';

/**
 * GET /api/v1/engine/launch-plans
 * List launch plans with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('launch-plans', 'read'),
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
    const validatedQuery = LaunchPlanListQuerySchema.parse(queryParams);

    // Get active launch plans if requested
    if (validatedQuery.active === 'true') {
      if (!validatedQuery.project || !validatedQuery.domain) {
        return NextResponse.json(
          { success: false, error: 'Project and domain required for active launch plans' },
          { status: 400 }
        );
      }

      const activeResult = await engineManager.services.admin!.listActiveLaunchPlans({
        project: validatedQuery.project,
        domain: validatedQuery.domain,
        limit: validatedQuery.limit,
        token: '',
        sortBy: undefined,
      });

      return NextResponse.json({
        success: true,
        data: {
          launchPlans: activeResult.launchPlans || [],
        },
      });
    }

    // List all launch plans
    const listResult = await engineManager.services.admin!.listLaunchPlans({
      id: {
        project: validatedQuery.project || '',
        domain: validatedQuery.domain || '',
        name: validatedQuery.name || '',
      },
      limit: validatedQuery.limit,
      token: '',
      filters: '',
      sortBy: undefined,
    } as any);

    return NextResponse.json({
      success: true,
      data: {
        launchPlans: listResult.launchPlans || [],
        token: listResult.token || '',
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
        error: error instanceof Error ? error.message : 'Failed to list launch plans',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/engine/launch-plans
 * Create a new launch plan
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('launch-plans', 'create'),
      checkSubscription: true,
      trackUsage: true,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId } = result;

    // Validate request body
    const body = await request.json();
    const validatedData = LaunchPlanCreateRequestSchema.parse(body);

    // Null safety check
    if (!validatedData.id) throw new Error('Launch plan ID is required');

    // Transform spec to match gRPC expectations
    const transformedSpec = validatedData.spec
      ? {
          ...validatedData.spec,
          // Convert boolean to BoolValue for gRPC
          interruptible:
            validatedData.spec.interruptible !== undefined
              ? { value: validatedData.spec.interruptible }
              : undefined,
        }
      : undefined;

    const launchPlanResult = await engineManager.services.admin!.createLaunchPlan({
      id: validatedData.id,
      spec: transformedSpec,
    } as any);

    // Track usage for billing
    await trackEngineUsage(userId, 'launch-plan', 1, {
      project: validatedData.id.project,
      domain: validatedData.id.domain,
      name: validatedData.id.name,
    });

    // Audit log
    await auditEngineOperation(
      userId,
      'launch_plan_created',
      'launch-plans',
      `${validatedData.id.project}:${validatedData.id.domain}:${validatedData.id.name}`,
      { version: validatedData.id.version }
    );

    return NextResponse.json({
      success: true,
      data: launchPlanResult,
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
        error: error instanceof Error ? error.message : 'Failed to create launch plan',
      },
      { status: 500 }
    );
  }
}
