/**
 * Mapping Templates API - Clone Template
 * POST /api/mapping-templates/[id]/clone - Clone existing template
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
 * POST /api/mapping-templates/[id]/clone
 * Clone existing mapping template
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
    const body = await request.json();

    // Fetch source template
    const sourceTemplate = await prisma.mappingTemplate.findUnique({
      where: { id },
    });

    if (!sourceTemplate) {
      return NextResponse.json({ error: 'Source template not found' }, { status: 404 });
    }

    // Check view permissions on source template
    const canView =
      sourceTemplate.visibility === 'PUBLIC' ||
      sourceTemplate.isSystemTemplate ||
      (sourceTemplate.visibility === 'ORGANIZATION' &&
        sourceTemplate.organizationId === organizationId) ||
      (sourceTemplate.visibility === 'PRIVATE' && sourceTemplate.createdBy === user.id) ||
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN');

    if (!canView) {
      return NextResponse.json({ error: 'Access denied to clone this template' }, { status: 403 });
    }

    // Prepare clone data
    const { name, description, visibility, tags, icon, logoUrl, documentation, setupInstructions } =
      body;

    // Generate clone name if not provided
    const cloneName = name || `${sourceTemplate.name} (Copy)`;

    // Determine visibility (default to PRIVATE)
    const cloneVisibility = visibility || 'PRIVATE';

    // Determine organization ID
    let cloneOrganizationId = null;
    if (cloneVisibility === 'ORGANIZATION' || cloneVisibility === 'PRIVATE') {
      if (!organizationId) {
        return NextResponse.json(
          { error: 'Organization required for non-public templates' },
          { status: 400 }
        );
      }
      cloneOrganizationId = organizationId;
    }

    // Create cloned template
    const clonedTemplate = await prisma.mappingTemplate.create({
      data: {
        // New metadata
        name: cloneName,
        description: description || sourceTemplate.description,
        visibility: cloneVisibility,
        tags: tags || sourceTemplate.tags,
        icon: icon || sourceTemplate.icon,
        logoUrl: logoUrl || sourceTemplate.logoUrl,
        documentation: documentation || sourceTemplate.documentation,
        setupInstructions: setupInstructions || sourceTemplate.setupInstructions,

        // Copy from source
        provider: sourceTemplate.provider,
        category: sourceTemplate.category,
        service: sourceTemplate.service,
        connectorType: sourceTemplate.connectorType,
        rootPath: sourceTemplate.rootPath,
        mappings: sourceTemplate.mappings as any,
        valueField: sourceTemplate.valueField,
        displayField: sourceTemplate.displayField,
        searchFields: sourceTemplate.searchFields as any,
        sampleData: sourceTemplate.sampleData as any,

        // Reset stats
        usageCount: 0,
        rating: 0,
        reviewCount: 0,

        // Status and ownership
        status: 'ACTIVE',
        isSystemTemplate: false, // Clones are never system templates
        isFeatured: false, // Clones are never featured
        organizationId: cloneOrganizationId,
        createdBy: user.id,
      },
    });

    // Optionally increment usage count on source template
    await prisma.mappingTemplate.update({
      where: { id: sourceTemplate.id },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: clonedTemplate,
      message: 'Template cloned successfully',
    });
  } catch (error: any) {
    console.error('Error cloning mapping template:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          error:
            'A template with this name already exists. Please provide a different name when cloning.',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to clone mapping template', details: error.message },
      { status: 500 }
    );
  }
}
