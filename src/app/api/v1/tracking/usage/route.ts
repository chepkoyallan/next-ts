/**
 * Usage Tracking API
 * Query resource usage for billing and analytics
 */

import { NextRequest, NextResponse } from 'next/server';

// NOTE: Disabled - usage tracking functions not exported from usage-tracking-service
// import {
//   recordUsage,
//   getUserUsage,
//   getProjectUsage,
//   checkFeatureLimit,
// } from 'src/app/api/lib/services/usage-tracking-service';

/**
 * GET /api/v1/tracking/usage
 * Get usage data for user or project
 *
 * NOTE: Disabled - usage tracking service functions not available
 */
export async function GET(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: 'Usage tracking API is not available - service not configured',
      code: 'FEATURE_DISABLED',
    },
    { status: 501 }
  );
}

/* Disabled until usage tracking service is implemented
export async function GET_DISABLED(request: NextRequest) {
  try {
    // Authenticate user
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'tracking', action: 'read' }],
        },
      },
      {}
    );

    if (result instanceof NextResponse) {
      return result;
    }

    const { userId, context } = result;
    const { searchParams } = new URL(request.url);

    const scope = searchParams.get('scope') || 'user'; // 'user' or 'project'
    const targetId = searchParams.get('id') || userId;
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined;
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined;

    // Authorization check
    if (scope === 'user' && targetId !== userId) {
      const isAdmin = context.roles.some((r) => ['super-admin', 'system-admin'].includes(r));
      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'You can only view your own usage data',
            code: 'UNAUTHORIZED',
          },
          { status: 403 }
        );
      }
    }

    // Get usage data
    let usageData;
    if (scope === 'user') {
      usageData = await getUserUsage(targetId, startDate, endDate);
    } else if (scope === 'project') {
      usageData = await getProjectUsage(targetId, startDate, endDate);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid scope. Must be "user" or "project"',
          code: 'INVALID_SCOPE',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      scope,
      id: targetId,
      startDate,
      endDate,
      data: usageData,
    });
  } catch (error: any) {
    console.error('Error fetching usage data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch usage data',
        code: 'USAGE_FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/tracking/usage/check-limit
 * Check if user has reached feature limit
 *
 * NOTE: Disabled - usage tracking service functions not available
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error: 'Usage tracking API is not available - service not configured',
      code: 'FEATURE_DISABLED',
    },
    { status: 501 }
  );
}
