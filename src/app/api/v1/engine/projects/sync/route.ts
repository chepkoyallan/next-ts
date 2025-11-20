/**
 * Sync Flyte Projects with Database
 * This endpoint syncs projects from Flyte to the local database
 * Use this to reconcile any projects that exist in Flyte but not in DB
 */

import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';
import {
  generateOrgPrefix,
  parseFlyteProjectId,
  syncProjectToDatabase,
} from 'src/app/api/lib/services/resource-isolation-helper';

/**
 * POST /api/v1/engine/projects/sync
 * Sync Flyte projects to database (admin only)
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

    // Get all projects from Flyte
    const flyteProjects = await engineManager.services.admin!.listProjects({
      limit: 1000,
      sortBy: { key: 0, direction: 0 },
    } as any);

    const projects = flyteProjects.projects || [];
    const orgPrefix = generateOrgPrefix(organizationId);

    // Filter projects belonging to this organization
    const orgProjects = projects.filter((p: any) => p.id?.startsWith(orgPrefix));

    // Import to database
    const { prisma } = await import('src/lib/prisma');

    // Process all projects in parallel
    const results = await Promise.all(
      orgProjects.map(async (flyteProject) => {
        try {
          const flyteProjectId = flyteProject.id;
          const parsed = parseFlyteProjectId(flyteProjectId!);

          if (!parsed) {
            console.warn(`Invalid Flyte project ID format: ${flyteProjectId}`);
            return { type: 'skipped', flyteProjectId };
          }

          // Check if project already exists in database
          const existingProject = await prisma.project.findFirst({
            where: { flyteProjectId },
          });

          if (!existingProject) {
            // Sync to database
            await syncProjectToDatabase(flyteProjectId!, organizationId, userId, {
              name: flyteProject.name || parsed.userProjectId,
              description: flyteProject.description,
              state: flyteProject.state || 0,
              domains: flyteProject.domains || [],
            });

            console.log(`Synced project: ${flyteProjectId}`);

            return {
              type: 'synced',
              flyteProjectId,
              userProjectId: parsed.userProjectId,
              name: flyteProject.name,
            };
          }

          return { type: 'exists', flyteProjectId };
        } catch (error) {
          console.error(`Error syncing project ${flyteProject.id}:`, error);
          return {
            type: 'error',
            projectId: flyteProject.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Separate results by type
    const syncedProjects = results
      .filter((r) => r.type === 'synced')
      .map((r) => ({
        flyteProjectId: r.flyteProjectId,
        userProjectId: (r as any).userProjectId,
        name: (r as any).name,
      }));

    const errors = results
      .filter((r) => r.type === 'error')
      .map((r) => ({
        projectId: (r as any).projectId,
        error: (r as any).error,
      }));

    return NextResponse.json({
      success: true,
      data: {
        totalFlyteProjects: projects.length,
        organizationProjects: orgProjects.length,
        syncedProjects: syncedProjects.length,
        synced: syncedProjects,
        errors,
      },
      message: `Synced ${syncedProjects.length} projects from Flyte to database`,
    });
  } catch (error) {
    console.error('Error syncing projects:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync projects',
      },
      { status: 500 }
    );
  }
}
