import { NextRequest, NextResponse } from 'next/server';

import { ApiResponse } from 'src/types/api';

/**
 * GET /api/v1/templates
 *
 * Fetch input templates for a workflow
 * Query params:
 *   - workflowId: string (format: project:domain:name:version)
 *   - userId: string (optional - for user-specific templates)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const userId = searchParams.get('userId');

    if (!workflowId) {
      return NextResponse.json<ApiResponse<any>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'workflowId is required',
          },
        },
        { status: 400 }
      );
    }

    // Parse workflow ID
    const [project, domain, name, version] = workflowId.split(':');

    if (!project || !domain || !name || !version) {
      return NextResponse.json<ApiResponse<any>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid workflowId format. Expected: project:domain:name:version',
          },
        },
        { status: 400 }
      );
    }

    // TODO: Fetch templates from database
    // const templates = await prisma.workflowTemplate.findMany({
    //   where: {
    //     workflowProject: project,
    //     workflowDomain: domain,
    //     workflowName: name,
    //     workflowVersion: version,
    //     ...(userId ? { OR: [{ userId }, { isPublic: true }] } : { isPublic: true }),
    //   },
    //   orderBy: { createdAt: 'desc' },
    // });

    // Mock templates for now
    const mockTemplates = [
      {
        id: 'template-prod',
        name: 'Production ML Training',
        description: 'Standard production configuration with optimized settings',
        workflowId: { project, domain, name, version },
        isPublic: true,
        createdBy: 'system',
        createdAt: new Date('2025-01-01').toISOString(),
        inputs: {
          input_file: 's3://prod-bucket/training-data.csv',
          batch_size: 100,
          enable_validation: true,
          max_retries: 3,
          timeout: 3600,
        },
      },
      {
        id: 'template-dev',
        name: 'Development/Testing Config',
        description: 'Faster configuration for development and testing',
        workflowId: { project, domain, name, version },
        isPublic: true,
        createdBy: 'system',
        createdAt: new Date('2025-01-01').toISOString(),
        inputs: {
          input_file: 's3://dev-bucket/sample-data.csv',
          batch_size: 10,
          enable_validation: false,
          max_retries: 1,
          timeout: 600,
        },
      },
    ];

    // Filter by userId if provided (for user-specific templates)
    const filteredTemplates = userId
      ? mockTemplates // In real implementation, would filter by userId
      : mockTemplates.filter((t) => t.isPublic);

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: {
          templates: filteredTemplates,
          total: filteredTemplates.length,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching templates:', error);

    return NextResponse.json<ApiResponse<any>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to fetch templates',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/templates
 *
 * Create a new input template
 * Body:
 *   - name: string
 *   - description: string (optional)
 *   - workflowId: string
 *   - inputs: Record<string, any>
 *   - isPublic: boolean (optional, default: false)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, workflowId, inputs, isPublic = false } = body;

    // Validation
    if (!name || !workflowId || !inputs) {
      return NextResponse.json<ApiResponse<any>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'name, workflowId, and inputs are required',
          },
        },
        { status: 400 }
      );
    }

    // Parse workflow ID
    const [project, domain, workflowName, version] = workflowId.split(':');

    if (!project || !domain || !workflowName || !version) {
      return NextResponse.json<ApiResponse<any>>(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Invalid workflowId format. Expected: project:domain:name:version',
          },
        },
        { status: 400 }
      );
    }

    // TODO: Save template to database
    // const template = await prisma.workflowTemplate.create({
    //   data: {
    //     name,
    //     description,
    //     workflowProject: project,
    //     workflowDomain: domain,
    //     workflowName,
    //     workflowVersion: version,
    //     inputs,
    //     isPublic,
    //     userId: currentUser.id, // Get from auth
    //   },
    // });

    // Mock response
    const newTemplate = {
      id: `template-${Date.now()}`,
      name,
      description,
      workflowId: { project, domain, name: workflowName, version },
      inputs,
      isPublic,
      createdBy: 'current-user', // TODO: Get from auth
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json<ApiResponse<any>>(
      {
        success: true,
        data: {
          template: newTemplate,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating template:', error);

    return NextResponse.json<ApiResponse<any>>(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to create template',
        },
      },
      { status: 500 }
    );
  }
}
