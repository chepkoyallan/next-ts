/**
 * Engine API - Domain Attributes
 * Manage domain-level workflow execution attributes
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import {
  trackEngineUsage,
  requireSecureEngine,
  auditEngineOperation,
} from 'src/app/api/lib/services/engine-helper-rbac';

interface RouteParams {
  params: {
    project: string;
    domain: string;
  };
}

// Project-Domain attributes schema (based on flyteidl.admin.IProjectDomainAttributes)
const ProjectDomainAttributesSchema = z.object({
  project: z.string().optional().nullable(),
  domain: z.string().optional().nullable(),
  matchingAttributes: z
    .object({
      taskResourceAttributes: z.any().optional().nullable(),
      clusterResourceAttributes: z.any().optional().nullable(),
      executionQueueAttributes: z.any().optional().nullable(),
      executionClusterLabel: z.any().optional().nullable(),
      qualityOfService: z.any().optional().nullable(),
      pluginOverrides: z.any().optional().nullable(),
      workflowExecutionConfig: z.any().optional().nullable(),
      clusterAssignment: z.any().optional().nullable(),
    })
    .optional()
    .nullable(),
});

// Update request schema
const DomainAttributesUpdateSchema = z.object({
  attributes: ProjectDomainAttributesSchema,
});

/**
 * GET /api/v1/engine/domains/:project/:domain/attributes
 * Get domain-level workflow execution attributes
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

    const { project, domain } = params;

    try {
      // Get project-domain attributes from Flyte
      const attributes = await engineManager.services.admin!.getProjectDomainAttributes({
        project,
        domain,
      } as any);

      return NextResponse.json({
        success: true,
        data: attributes,
      });
    } catch (error: any) {
      // If method not found or not implemented, return empty attributes
      if (
        error.message?.includes('not implemented') ||
        error.message?.includes('not found') ||
        error.code === 12 // UNIMPLEMENTED gRPC code
      ) {
        return NextResponse.json({
          success: true,
          data: {
            project,
            domain,
            matchingAttributes: null,
          },
          message: 'Domain attributes feature not available in this Flyte version',
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error getting domain attributes:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get domain attributes',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/engine/domains/:project/:domain/attributes
 * Update domain-level workflow execution attributes
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('projects', 'update'),
      checkSubscription: true,
      trackUsage: true,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId } = result;

    // Validate request body
    const body = await request.json();
    const validatedData = DomainAttributesUpdateSchema.parse(body);

    const { project, domain } = params;

    // Ensure project and domain match
    const attributesData = {
      ...validatedData.attributes,
      project,
      domain,
    };

    try {
      // Update project-domain attributes via Flyte admin
      const updateResult = await engineManager.services.admin!.updateProjectDomainAttributes({
        attributes: attributesData,
      } as any);

      // Track usage for billing
      await trackEngineUsage(userId, 'domain-attributes-update', 1, {
        project,
        domain,
      });

      // Audit log
      await auditEngineOperation(
        userId,
        'domain_attributes_updated',
        'domains',
        `${project}:${domain}`,
        {
          hasAttributes: !!attributesData.matchingAttributes,
        }
      );

      return NextResponse.json({
        success: true,
        data: updateResult,
        message: 'Domain attributes updated successfully',
      });
    } catch (error: any) {
      // If method not found or not implemented
      if (
        error.message?.includes('not implemented') ||
        error.message?.includes('not found') ||
        error.code === 12 // UNIMPLEMENTED gRPC code
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Domain attributes feature not available in this Flyte version',
            message:
              'This Flyte deployment does not support domain-level attributes. Please upgrade Flyte or use workflow-level configurations.',
          },
          { status: 501 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Error updating domain attributes:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update domain attributes',
      },
      { status: 500 }
    );
  }
}
