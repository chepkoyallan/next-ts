/**
 * Mapping Templates API - Single Template Operations
 * GET /api/mapping-templates/[id] - Get template by ID
 * PUT /api/mapping-templates/[id] - Update template
 * DELETE /api/mapping-templates/[id] - Delete (archive) template
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
 * GET /api/mapping-templates/[id]
 * Get single mapping template by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return auth error
    }

    const { user } = authResult;
    const organizationId = request.headers.get('x-organization-id');
    const { id } = params;

    const template = await prisma.mappingTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Mapping template not found' }, { status: 404 });
    }

    // Check visibility permissions
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

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Error fetching mapping template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mapping template', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/mapping-templates/[id]
 * Update mapping template
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return auth error
    }

    const { user } = authResult;
    const organizationId = request.headers.get('x-organization-id');
    const { id } = params;
    const body = await request.json();

    // Fetch existing template
    const existingTemplate = await prisma.mappingTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Mapping template not found' }, { status: 404 });
    }

    // Check edit permissions
    const isAdmin = user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
    const isOwner = existingTemplate.createdBy === user.id;
    const isOrgTemplate =
      existingTemplate.visibility === 'ORGANIZATION' &&
      existingTemplate.organizationId === organizationId;

    const canEdit = isAdmin || isOwner || isOrgTemplate;

    if (!canEdit) {
      return NextResponse.json({ error: 'Access denied to edit this template' }, { status: 403 });
    }

    // Validate mappings if provided
    if (body.mappings) {
      if (!Array.isArray(body.mappings) || body.mappings.length === 0) {
        return NextResponse.json({ error: 'Mappings must be a non-empty array' }, { status: 400 });
      }

      const invalidMapping = body.mappings.find(
        (mapping: any) => !mapping.sourceField || !mapping.targetField
      );
      if (invalidMapping) {
        return NextResponse.json(
          { error: 'Each mapping must have sourceField and targetField' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};

    // Basic fields
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.provider !== undefined) updateData.provider = body.provider;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.service !== undefined) updateData.service = body.service;
    if (body.connectorType !== undefined) updateData.connectorType = body.connectorType;

    // Configuration fields
    if (body.rootPath !== undefined) updateData.rootPath = body.rootPath;
    if (body.mappings !== undefined) updateData.mappings = body.mappings;
    if (body.valueField !== undefined) updateData.valueField = body.valueField;
    if (body.displayField !== undefined) updateData.displayField = body.displayField;
    if (body.searchFields !== undefined) updateData.searchFields = body.searchFields;
    if (body.sampleData !== undefined) updateData.sampleData = body.sampleData;

    // Metadata fields
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl;
    if (body.documentation !== undefined) updateData.documentation = body.documentation;
    if (body.setupInstructions !== undefined) updateData.setupInstructions = body.setupInstructions;

    // Status and visibility (admin only for system templates)
    if (body.status !== undefined) {
      if (existingTemplate.isSystemTemplate && !isAdmin) {
        return NextResponse.json(
          { error: 'Only admins can change status of system templates' },
          { status: 403 }
        );
      }
      updateData.status = body.status;
    }

    if (body.visibility !== undefined) {
      if (existingTemplate.isSystemTemplate && !isAdmin) {
        return NextResponse.json(
          { error: 'Only admins can change visibility of system templates' },
          { status: 403 }
        );
      }
      updateData.visibility = body.visibility;
    }

    // Admin-only fields
    if (isAdmin) {
      if (body.isSystemTemplate !== undefined) updateData.isSystemTemplate = body.isSystemTemplate;
      if (body.isFeatured !== undefined) updateData.isFeatured = body.isFeatured;
      if (body.rating !== undefined) updateData.rating = body.rating;
      if (body.reviewCount !== undefined) updateData.reviewCount = body.reviewCount;
    }

    // Update template
    const template = await prisma.mappingTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Error updating mapping template:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A template with this provider, service, and connector type already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update mapping template', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mapping-templates/[id]
 * Delete (archive) mapping template
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return auth error
    }

    const { user } = authResult;
    const { id } = params;

    // Fetch existing template
    const existingTemplate = await prisma.mappingTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Mapping template not found' }, { status: 404 });
    }

    // Check delete permissions
    const isAdmin = user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
    const isOwner = existingTemplate.createdBy === user.id;

    const canDelete = isAdmin || isOwner;

    if (!canDelete) {
      return NextResponse.json({ error: 'Access denied to delete this template' }, { status: 403 });
    }

    // Prevent deletion of system templates (only archive)
    if (existingTemplate.isSystemTemplate && !isAdmin) {
      return NextResponse.json(
        { error: 'System templates can only be archived by admins' },
        { status: 403 }
      );
    }

    // Soft delete: Set status to ARCHIVED
    const template = await prisma.mappingTemplate.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    return NextResponse.json({
      success: true,
      message: 'Mapping template archived successfully',
      data: template,
    });
  } catch (error: any) {
    console.error('Error deleting mapping template:', error);
    return NextResponse.json(
      { error: 'Failed to delete mapping template', details: error.message },
      { status: 500 }
    );
  }
}
