/**
 * Mapping Templates API - List and Create
 * GET /api/mapping-templates - List templates with filters
 * POST /api/mapping-templates - Create new template
 */

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { authMiddleware } from 'src/app/api/lib/middleware/auth';

/**
 * GET /api/mapping-templates
 * List mapping templates with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return auth error
    }

    const { user } = authResult;
    const organizationId = request.headers.get('x-organization-id');
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const provider = searchParams.get('provider');
    const category = searchParams.get('category');
    const connectorType = searchParams.get('connectorType');
    const visibility = searchParams.get('visibility');
    const status = searchParams.get('status') || 'ACTIVE';
    const search = searchParams.get('search');
    const featured = searchParams.get('featured');
    const sortBy = searchParams.get('sortBy') || 'usageCount';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build where clause
    const where: any = {
      status: status || 'ACTIVE',
    };

    // Visibility filter
    if (visibility) {
      where.visibility = visibility;
    } else {
      // Default: Show PUBLIC + organization-specific + user's private templates
      where.OR = [
        { visibility: 'PUBLIC' },
        { visibility: 'ORGANIZATION', organizationId: organizationId || undefined },
        { visibility: 'PRIVATE', createdBy: user.id },
      ];
    }

    // Provider filter
    if (provider) {
      where.provider = provider;
    }

    // Category filter
    if (category) {
      where.category = category;
    }

    // Connector type filter
    if (connectorType) {
      where.connectorType = connectorType;
    }

    // Featured filter
    if (featured === 'true') {
      where.isFeatured = true;
    }

    // Search filter (name, description, tags)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy === 'usageCount') {
      orderBy.usageCount = sortOrder;
    } else if (sortBy === 'rating') {
      orderBy.rating = sortOrder;
    } else if (sortBy === 'name') {
      orderBy.name = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else {
      orderBy.usageCount = 'desc';
    }

    // Execute query
    const [templates, total] = await Promise.all([
      prisma.mappingTemplate.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          provider: true,
          category: true,
          service: true,
          connectorType: true,
          usageCount: true,
          rating: true,
          reviewCount: true,
          status: true,
          visibility: true,
          tags: true,
          icon: true,
          logoUrl: true,
          isSystemTemplate: true,
          isFeatured: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.mappingTemplate.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: templates,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + templates.length < total,
      },
    });
  } catch (error: any) {
    console.error('Error listing mapping templates:', error);
    return NextResponse.json(
      { error: 'Failed to list mapping templates', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mapping-templates
 * Create new mapping template
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return auth error
    }

    const { user } = authResult;
    const organizationId = request.headers.get('x-organization-id');
    const body = await request.json();

    // Validate required fields
    const {
      name,
      description,
      provider,
      category,
      service,
      connectorType,
      rootPath,
      mappings,
      valueField,
      displayField,
      searchFields,
      sampleData,
      visibility,
      tags,
      icon,
      logoUrl,
      documentation,
      setupInstructions,
      isSystemTemplate,
      isFeatured,
    } = body;

    if (!name || !provider || !category || !connectorType || !mappings) {
      return NextResponse.json(
        { error: 'Missing required fields: name, provider, category, connectorType, mappings' },
        { status: 400 }
      );
    }

    // Validate mappings structure
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return NextResponse.json({ error: 'Mappings must be a non-empty array' }, { status: 400 });
    }

    const invalidMapping = mappings.find(
      (mapping: any) => !mapping.sourceField || !mapping.targetField
    );
    if (invalidMapping) {
      return NextResponse.json(
        { error: 'Each mapping must have sourceField and targetField' },
        { status: 400 }
      );
    }

    // Only admins can create system templates or featured templates
    const isAdmin = user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN');
    const effectiveIsSystemTemplate = isAdmin && isSystemTemplate;
    const effectiveIsFeatured = isAdmin && isFeatured;

    // Determine organization ID based on visibility
    let effectiveOrganizationId = null;
    if (visibility === 'ORGANIZATION' || visibility === 'PRIVATE') {
      if (!organizationId) {
        return NextResponse.json(
          { error: 'Organization required for non-public templates' },
          { status: 400 }
        );
      }
      effectiveOrganizationId = organizationId;
    }

    // Create template
    const template = await prisma.mappingTemplate.create({
      data: {
        name,
        description: description || null,
        provider,
        category,
        service: service || null,
        connectorType,
        rootPath: rootPath || null,
        mappings,
        valueField: valueField || null,
        displayField: displayField || null,
        searchFields: searchFields || null,
        sampleData: sampleData || null,
        visibility: visibility || 'PRIVATE',
        tags: tags || [],
        icon: icon || null,
        logoUrl: logoUrl || null,
        documentation: documentation || null,
        setupInstructions: setupInstructions || null,
        isSystemTemplate: effectiveIsSystemTemplate || false,
        isFeatured: effectiveIsFeatured || false,
        organizationId: effectiveOrganizationId,
        createdBy: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Error creating mapping template:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A template with this provider, service, and connector type already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create mapping template', details: error.message },
      { status: 500 }
    );
  }
}
