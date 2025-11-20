import { verify } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// ----------------------------------------------------------------------

/**
 * GET /api/v1/users
 * Get users list with admin metrics (admin access required)
 */
export async function GET(request: NextRequest) {
  try {
    // Simple JWT authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const decoded = verify(token, jwtSecret) as any;
    const userRoles = decoded.roles || [decoded.role] || ['viewer'];

    // Check if user has admin privileges
    const hasAdminAccess = userRoles.some((role: string) =>
      ['super-admin', 'system-admin', 'project-admin'].includes(role)
    );

    if (!hasAdminAccess) {
      return NextResponse.json(
        {
          error: 'Insufficient permissions. Admin access required.',
        },
        { status: 403 }
      );
    }

    // Get user statistics for admin overview
    const [totalUsers, activeUsers, newUsersThisMonth] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { emailVerified: true },
      }),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    // Get recent users for admin interface
    const recentUsers = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const userData = {
      total: totalUsers,
      active: activeUsers,
      newThisMonth: newUsersThisMonth,
      recentUsers,
    };

    return NextResponse.json({
      success: true,
      data: userData,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Users API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch user data',
      },
      { status: 500 }
    );
  }
}
