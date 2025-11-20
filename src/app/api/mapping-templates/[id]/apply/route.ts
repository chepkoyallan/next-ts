/**
 * Mapping Templates API - Apply Template
 * POST /api/mapping-templates/[id]/apply - Apply template and track usage
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { authMiddleware } from 'src/app/api/lib/middleware/auth';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * POST /api/mapping-templates/[id]/apply
 * Apply template to connector and increment usage count
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return auth error
    }

    const { user } = authResult;
    const organizationId = request.headers.get('x-organization-id');
    const { id } = params;

    // Fetch template
    const template = await prisma.mappingTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if template is active
    if (template.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Template is not active' }, { status: 400 });
    }

    // Check view permissions
    const canView =
      template.visibility === 'PUBLIC' ||
      template.isSystemTemplate ||
      (template.visibility === 'ORGANIZATION' && template.organizationId === organizationId) ||
      (template.visibility === 'PRIVATE' && template.createdBy === user.id) ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');

    if (!canView) {
      return NextResponse.json({ error: 'Access denied to this template' }, { status: 403 });
    }

    // Increment usage count
    const updatedTemplate = await prisma.mappingTemplate.update({
      where: { id },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    // Return template configuration
    return NextResponse.json({
      success: true,
      data: {
        rootPath: updatedTemplate.rootPath,
        mappings: updatedTemplate.mappings,
        valueField: updatedTemplate.valueField,
        displayField: updatedTemplate.displayField,
        searchFields: updatedTemplate.searchFields,
      },
      message: 'Template applied successfully',
    });
  } catch (error: any) {
    console.error('Error applying mapping template:', error);
    return NextResponse.json(
      { error: 'Failed to apply mapping template', details: error.message },
      { status: 500 }
    );
  }
}
