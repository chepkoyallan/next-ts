/**
 * Resource Tracking API
 * Query which user created what resources
 */

import { NextRequest, NextResponse } from 'next/server';

import { getUserResources } from 'src/app/api/lib/services/audit-service';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';

// Force dynamic rendering (uses cookies for auth)
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tracking/resources
 * Get resources created by a user
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'resources', action: 'read' }],
        },
      },
      {}
    );

    if (result instanceof NextResponse) {
      return result;
    }

    const { userId, context } = result;
    const { searchParams } = new URL(request.url);

    const targetUserId = searchParams.get('userId') || userId;
    const resourceType = searchParams.get('resourceType') || undefined;
    const projectId = searchParams.get('projectId') || undefined;

    // Authorization check
    if (targetUserId !== userId) {
      const isAdmin = context.roles.some((r) => ['super-admin', 'system-admin'].includes(r));
      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'You can only view your own resources',
            code: 'UNAUTHORIZED',
          },
          { status: 403 }
        );
      }
    }

    // Get user resources
    const resources = await getUserResources({
      userId: targetUserId,
      resourceType,
      projectId,
    });

    // Group by resource type
    const groupedByType = resources.reduce(
      (acc, resource) => {
        if (!acc[resource.resourceType]) {
          acc[resource.resourceType] = [];
        }
        acc[resource.resourceType].push(resource);
        return acc;
      },
      {} as Record<string, typeof resources>
    );

    // Count by type
    const countByType = Object.entries(groupedByType).reduce(
      (acc, [type, items]) => {
        acc[type] = items.length;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      userId: targetUserId,
      total: resources.length,
      countByType,
      resources,
      groupedByType,
    });
  } catch (error: any) {
    console.error('Error fetching user resources:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch user resources',
        code: 'RESOURCES_FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}
