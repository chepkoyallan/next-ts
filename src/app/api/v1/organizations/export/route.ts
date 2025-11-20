// Export Organizations Data
import { verify } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

import { parseAdvancedFilters } from '../../../lib/utils/advanced-filters';
import { OrganizationService } from '../../../lib/services/organization-service';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * Convert organizations to CSV format
 */
function toCSV(organizations: any[]): string {
  const headers = [
    'ID',
    'Name',
    'Slug',
    'Status',
    'Industry',
    'Size',
    'Website',
    'Members',
    'Projects',
    'Created At',
  ];

  const rows = organizations.map((org) => [
    org.id,
    org.name,
    org.slug,
    org.status,
    org.industry || '',
    org.size || '',
    org.website || '',
    org.members?.length || 0,
    org.projects?.length || 0,
    new Date(org.createdAt).toISOString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          // Escape cells that contain commas or quotes
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(',')
    ),
  ].join('\n');

  return csvContent;
}

/**
 * Convert organizations to JSON format
 */
function toJSON(organizations: any[]): string {
  const data = organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    description: org.description,
    logoUrl: org.logoUrl,
    website: org.website,
    industry: org.industry,
    size: org.size,
    memberCount: org.members?.length || 0,
    projectCount: org.projects?.length || 0,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  }));

  return JSON.stringify(data, null, 2);
}

/**
 * GET /api/v1/organizations/export
 * Export organizations data
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

    // Check if user is admin (only admins can export all organizations)
    const isAdmin = userRoles.some((role: string) =>
      ['super-admin', 'system-admin', 'admin'].includes(role)
    );

    if (!isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Admin access required to export organizations',
          },
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const format = queryParams.format || 'json'; // 'json' or 'csv'

    // Parse filters
    const advancedFilters = parseAdvancedFilters(queryParams);

    // Convert advanced filters to basic filters for the list method
    const filters: any = {
      status: advancedFilters.status?.[0] as any,
      industry: advancedFilters.industry?.[0],
      size: advancedFilters.size?.[0],
      search: advancedFilters.search,
    };

    // Fetch organizations (limit to 1000 for exports)
    const result = await OrganizationService.list(filters, 1, 1000);

    // Generate export based on format
    let content: string;
    let contentType: string;
    let filename: string;

    if (format === 'csv') {
      content = toCSV(result.organizations);
      contentType = 'text/csv';
      filename = `organizations-export-${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      content = toJSON(result.organizations);
      contentType = 'application/json';
      filename = `organizations-export-${new Date().toISOString().split('T')[0]}.json`;
    }

    // Return file as download
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to export organizations',
        },
      },
      { status: 500 }
    );
  }
}
