/**
 * Sync Projects to Flyte
 * This endpoint registers existing database projects in Flyte
 * Useful for:
 * - Migrating seeded projects
 * - Fixing sync issues
 * - Recovering from Flyte failures
 */

import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';
import { ProjectRegistrationService } from 'src/app/api/lib/services/project-registration-service';

/**
 * POST /api/v1/engine/projects/sync-to-flyte
 * Sync all organization projects to Flyte
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requireRole('super-admin', 'system-admin'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, context } = result;
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

    // Sync projects
    const syncResult = await ProjectRegistrationService.syncExistingProjects(
      organizationId,
      engineManager
    );

    return NextResponse.json({
      success: true,
      data: {
        total: syncResult.total,
        synced: syncResult.synced,
        skipped: syncResult.skipped,
        errors: syncResult.errors,
      },
      message: `Synced ${syncResult.synced} of ${syncResult.total} projects to Flyte`,
    });
  } catch (error) {
    console.error('Error syncing projects to Flyte:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync projects',
      },
      { status: 500 }
    );
  }
}
