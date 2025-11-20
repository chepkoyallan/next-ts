/**
 * Engine API - Launch Plan Details
 * Get a specific launch plan by identifier
 */

import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';

/**
 * GET /api/v1/engine/launch-plans/[project]/[domain]/[name]/[version]
 * Get a specific launch plan
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { project: string; domain: string; name: string; version: string } }
) {
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
    const { project, domain, name, version } = params;

    // Get launch plan details
    const launchPlanResult = await engineManager.services.admin!.getLaunchPlan({
      project,
      domain,
      name,
      version,
    } as any);

    return NextResponse.json({
      success: true,
      data: launchPlanResult,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get launch plan',
      },
      { status: 500 }
    );
  }
}
