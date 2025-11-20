/**
 * Audit Trail API
 * Query audit logs for compliance and security
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';
import {
  getAuditTrail,
  getAuditStats,
  getUserAuditTrail,
} from 'src/app/api/lib/services/audit-service';

/**
 * GET /api/v1/tracking/audit
 * Get audit trail for project or user
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'audit', action: 'read' }],
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
    const action = searchParams.get('action') || undefined;
    const resource = searchParams.get('resource') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Authorization check
    if (scope === 'user' && targetId !== userId) {
      const isAdmin = context.roles.some((r) => ['super-admin', 'system-admin'].includes(r));
      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'You can only view your own audit trail',
            code: 'UNAUTHORIZED',
          },
          { status: 403 }
        );
      }
    }

    if (scope === 'project') {
      const isAdmin = context.roles.some((r) =>
        ['super-admin', 'system-admin', 'project-admin'].includes(r)
      );
      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions to view project audit trail',
            code: 'UNAUTHORIZED',
          },
          { status: 403 }
        );
      }
    }

    // Get audit trail
    let auditData;
    if (scope === 'user') {
      auditData = await getUserAuditTrail({
        userId: targetId,
        startDate,
        endDate,
        limit,
        offset,
      });
    } else if (scope === 'project') {
      auditData = await getAuditTrail({
        projectId: targetId,
        startDate,
        endDate,
        userId: searchParams.get('userId') || undefined,
        action,
        resource,
        limit,
        offset,
      });
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
      ...auditData,
    });
  } catch (error: any) {
    console.error('Error fetching audit trail:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch audit trail',
        code: 'AUDIT_FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/tracking/audit/stats
 * Get audit statistics
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'audit', action: 'read' }],
        },
      },
      {}
    );

    if (result instanceof NextResponse) {
      return result;
    }

    const { userId, context } = result;
    const body = await request.json();

    const { projectId, targetUserId, startDate, endDate } = body;

    // Authorization check for project stats
    if (projectId) {
      const isAdmin = context.roles.some((r) =>
        ['super-admin', 'system-admin', 'project-admin'].includes(r)
      );
      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions to view project audit statistics',
            code: 'UNAUTHORIZED',
          },
          { status: 403 }
        );
      }
    }

    // Authorization check for user stats
    if (targetUserId && targetUserId !== userId) {
      const isAdmin = context.roles.some((r) => ['super-admin', 'system-admin'].includes(r));
      if (!isAdmin) {
        return NextResponse.json(
          {
            success: false,
            error: 'You can only view your own audit statistics',
            code: 'UNAUTHORIZED',
          },
          { status: 403 }
        );
      }
    }

    const stats = await getAuditStats({
      projectId,
      userId: targetUserId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('Error fetching audit statistics:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch audit statistics',
        code: 'AUDIT_STATS_ERROR',
      },
      { status: 500 }
    );
  }
}
