/**
 * Engine API - Launch Plan Activation
 * Activate/deactivate launch plans
 */

import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import {
  requireSecureEngine,
  auditEngineOperation,
} from 'src/app/api/lib/services/engine-helper-rbac';

/**
 * PATCH /api/v1/engine/launch-plans/[project]/[domain]/[name]/[version]/activate
 * Activate a launch plan
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { project: string; domain: string; name: string; version: string } }
) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('launch-plans', 'update'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId } = result;
    const { project, domain, name, version } = params;

    // Update launch plan state to ACTIVE
    const activateResult = await engineManager.services.admin!.updateLaunchPlan({
      id: {
        project,
        domain,
        name,
        version,
      },
      state: 1, // ACTIVE = 1
    });

    // Audit log
    await auditEngineOperation(
      userId,
      'launch_plan_activated',
      'launch-plans',
      `${project}:${domain}:${name}`,
      { version }
    );

    return NextResponse.json({
      success: true,
      data: activateResult,
    });
  } catch (error) {
    console.error('Launch plan activation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate launch plan',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/engine/launch-plans/[project]/[domain]/[name]/[version]/activate
 * Deactivate a launch plan
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { project: string; domain: string; name: string; version: string } }
) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('launch-plans', 'update'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId } = result;
    const { project, domain, name, version } = params;

    // Update launch plan state to INACTIVE
    const deactivateResult = await engineManager.services.admin!.updateLaunchPlan({
      id: {
        project,
        domain,
        name,
        version,
      },
      state: 0, // INACTIVE = 0
    });

    // Audit log
    await auditEngineOperation(
      userId,
      'launch_plan_deactivated',
      'launch-plans',
      `${project}:${domain}:${name}`,
      { version }
    );

    return NextResponse.json({
      success: true,
      data: deactivateResult,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate launch plan',
      },
      { status: 500 }
    );
  }
}
