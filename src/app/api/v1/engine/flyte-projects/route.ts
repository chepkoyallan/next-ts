/**
 * Flyte Projects API
 * Fetches actual Flyte projects from the engine (aus, automation, etc.)
 * These are Flyte namespaces, not user-created projects
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';

// Force dynamic rendering (uses cookies for auth)
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/engine/flyte-projects
 * List all Flyte projects (aus, automation, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: {}, // Authenticated users only
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager } = result;

    // Fetch projects from Flyte engine
    const flyteResponse = await engineManager.services.admin!.listProjects({
      limit: 100,
      sortBy: {
        key: 0, // CREATED_AT
        direction: 0, // DESCENDING
      },
    } as any);

    const flyteProjects = flyteResponse.projects || [];

    // Transform to consistent format
    const projects = flyteProjects.map((project: any) => ({
      id: project.id,
      name: project.name || project.id,
      description: project.description,
      domains: project.domains || [],
      state: project.state || 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        projects,
      },
    });
  } catch (error) {
    console.error('Error fetching Flyte projects:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Flyte projects',
      },
      { status: 500 }
    );
  }
}
