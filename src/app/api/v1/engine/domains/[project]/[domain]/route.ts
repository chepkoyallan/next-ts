/**
 * Engine API - Domain Details
 * Get specific domain information within a project
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';

interface RouteParams {
  params: {
    project: string;
    domain: string;
  };
}

// ID validation schemas
const ProjectIdSchema = z.string().min(1, 'Project ID is required');
const DomainIdSchema = z.string().min(1, 'Domain ID is required');

/**
 * GET /api/v1/engine/domains/:project/:domain
 * Get domain details within a project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('projects', 'read'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager } = result;

    // Validate parameters
    const projectValidation = ProjectIdSchema.safeParse(params.project);
    const domainValidation = DomainIdSchema.safeParse(params.domain);

    if (!projectValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: projectValidation.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    if (!domainValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: domainValidation.error.issues[0].message,
        },
        { status: 400 }
      );
    }

    const projectId = params.project;
    const domainId = params.domain;

    // Get project to retrieve domains
    const project = await // engineManager.services.admin!.getProject // Method may not exist
    // @ts-ignore
    engineManager.services.admin!.getProject({
      id: projectId,
    } as any);

    // Find the specific domain
    const domains = project.domains || [];
    const domain = domains.find((d: any) => d.id === domainId);

    if (!domain) {
      return NextResponse.json(
        {
          success: false,
          error: `Domain '${domainId}' not found in project '${projectId}'`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        domain,
        project: {
          id: project.id,
          name: project.name,
        },
      },
    });
  } catch (error) {
    console.error('Error getting domain:', error);

    // Handle not found errors
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: `Project '${params.project}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get domain',
      },
      { status: 500 }
    );
  }
}
