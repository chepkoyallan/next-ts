// Organization Reports and Analytics
import { verify } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/organizations/reports
 * Generate comprehensive organization reports
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'Server configuration error',
          },
        },
        { status: 500 }
      );
    }

    const decoded: any = verify(token, jwtSecret);
    const userRoles = decoded.roles || [decoded.role] || [];

    // Check if user is admin
    const isAdmin = userRoles.some((role: string) =>
      ['super-admin', 'system-admin', 'admin'].includes(role)
    );

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admin access required for reports',
          },
        },
        { status: 403 }
      );
    }

    // Generate comprehensive reports
    const [
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      totalMembers,
      totalProjects,
      organizationsBySize,
      organizationsByIndustry,
      // recentOrganizations,
      topOrganizationsByMembers,
      topOrganizationsByProjects,
    ] = await Promise.all([
      // Total organizations
      prisma.organization.count({
        where: { deletedAt: null },
      }),

      // Active organizations
      prisma.organization.count({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
        },
      }),

      // Suspended organizations
      prisma.organization.count({
        where: {
          status: 'SUSPENDED',
          deletedAt: null,
        },
      }),

      // Total members across all organizations
      prisma.organizationMember.count({
        where: { isActive: true },
      }),

      // Total projects
      prisma.project.count(),

      // Organizations by size
      prisma.organization.groupBy({
        by: ['size'],
        where: { deletedAt: null },
        _count: true,
      }),

      // Organizations by industry
      prisma.organization.groupBy({
        by: ['industry'],
        where: {
          deletedAt: null,
          industry: { not: null },
        },
        _count: true,
        orderBy: {
          _count: {
            industry: 'desc',
          },
        },
        take: 10,
      }),

      // Total count of organizations created in last 30 days (for growth calculation)
      prisma.organization.count({
        where: {
          deletedAt: null,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Top organizations by member count
      prisma.organization
        .findMany({
          where: { deletedAt: null },
          include: {
            members: {
              where: { isActive: true },
              select: { id: true },
            },
          },
          take: 1000,
        })
        .then((orgs) =>
          orgs
            .map((org) => ({
              id: org.id,
              name: org.name,
              slug: org.slug,
              memberCount: org.members.length,
            }))
            .sort((a, b) => b.memberCount - a.memberCount)
            .slice(0, 10)
        ),

      // Top organizations by project count
      prisma.organization
        .findMany({
          where: { deletedAt: null },
          include: {
            projects: {
              select: { id: true },
            },
          },
          take: 1000,
        })
        .then((orgs) =>
          orgs
            .map((org) => ({
              id: org.id,
              name: org.name,
              slug: org.slug,
              projectCount: org.projects.length,
            }))
            .sort((a, b) => b.projectCount - a.projectCount)
            .slice(0, 10)
        ),
    ]);

    // Calculate growth metrics (compare last 30 days to previous 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [recentGrowth, previousGrowth] = await Promise.all([
      prisma.organization.count({
        where: {
          deletedAt: null,
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
      }),
      prisma.organization.count({
        where: {
          deletedAt: null,
          createdAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo,
          },
        },
      }),
    ]);

    const growthRate =
      previousGrowth > 0 ? ((recentGrowth - previousGrowth) / previousGrowth) * 100 : 0;

    // Compile report
    const report = {
      summary: {
        totalOrganizations,
        activeOrganizations,
        suspendedOrganizations,
        totalMembers,
        totalProjects,
        averageMembersPerOrg:
          totalOrganizations > 0 ? Math.round((totalMembers / totalOrganizations) * 10) / 10 : 0,
        averageProjectsPerOrg:
          totalOrganizations > 0 ? Math.round((totalProjects / totalOrganizations) * 10) / 10 : 0,
      },
      growth: {
        last30Days: recentGrowth,
        previous30Days: previousGrowth,
        growthRate: Math.round(growthRate * 10) / 10,
        growthCount: recentGrowth - previousGrowth,
      },
      distribution: {
        bySize: organizationsBySize.map((item) => ({
          size: item.size || 'Unknown',
          count: item._count,
        })),
        byIndustry: organizationsByIndustry.map((item) => ({
          industry: item.industry || 'Unknown',
          count: item._count,
        })),
      },
      topOrganizations: {
        byMembers: topOrganizationsByMembers,
        byProjects: topOrganizationsByProjects,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate report',
        },
      },
      { status: 500 }
    );
  }
}
