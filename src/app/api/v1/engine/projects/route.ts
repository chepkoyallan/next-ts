/**
 * Engine API - Projects
 * Project management endpoints using the engine
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@app/utils/logger';
import { ErrorMessages } from '@app/utils/error-messages';
import { validateLabels, ProjectIdSchema } from '@app/utils/validation';

import { isHeadlessMode } from 'src/app/api/lib/headless-mode';
import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import {
  trackEngineUsage,
  requireSecureEngine,
  auditEngineOperation,
} from 'src/app/api/lib/services/engine-helper-rbac';

import { ProjectRegisterRequestSchema } from '../schemas';

/**
 * GET /api/v1/engine/projects
 * List all projects (with organization filtering, pagination, search, and filters)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

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

    const { context, userId } = result;
    const { organizationId } = context;

    if (!organizationId) {
      logger.warn('Organization ID missing in request context', {
        requestId,
        userId,
      });
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.ORGANIZATION_REQUIRED,
          code: 'ORGANIZATION_REQUIRED',
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const search = searchParams.get('search') || '';
    const includeArchived = searchParams.get('includeArchived') === 'true';
    const state = searchParams.get('state'); // 'active' | 'archived'
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    logger.info('Listing projects', {
      requestId,
      userId,
      organizationId,
      page,
      limit,
      search,
      includeArchived,
    });

    // Use database as source of truth (more efficient and secure)
    const { prisma } = await import('src/lib/prisma');

    // Build where clause - in headless mode, skip organization filter
    const where: any = {
      ...(isHeadlessMode() ? {} : { organizationId }),
      deletedAt: null,
    };

    // Filter by state
    if (state === 'archived' || (!includeArchived && !state)) {
      where.isArchived = state === 'archived';
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count and projects in parallel
    const [total, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: (() => {
          if (sortBy === 'name') return { name: sortOrder };
          if (sortBy === 'updatedAt') return { updatedAt: sortOrder };
          return { createdAt: sortOrder };
        })(),
        take: limit,
        skip: (page - 1) * limit,
      }),
    ]);

    // Convert database projects to API format
    const apiProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      state: project.flyteState,
      isArchived: project.isArchived,
      domains: project.flyteDomains as any,
      labels: (project.metadata as any)?.labels || {},
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      // Organization context
      organization: {
        id: project.organization.id,
        name: project.organization.name,
        slug: project.organization.slug,
      },
      // Flyte integration details
      flyteProjectId: project.flyteProjectId,
      flyteOrgPrefix: project.flyteOrgPrefix,
    }));

    const duration = Date.now() - startTime;
    logger.info('Projects listed successfully', {
      requestId,
      count: apiProjects.length,
      total,
      duration,
    });

    return NextResponse.json({
      success: true,
      data: {
        projects: apiProjects,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasMore: page * limit < total,
        },
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error listing projects', error, {
      requestId,
      duration,
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.VALIDATION_FAILED,
          code: 'VALIDATION_ERROR',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: ErrorMessages.SERVER_ERROR,
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/engine/projects
 * Register a new project (with organization isolation, tier limits, validation)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  let createdProjectId: string | null = null;

  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'admin',
      rbac: RBACDecorators.requirePermission('projects', 'create'),
      checkSubscription: true,
      trackUsage: true,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId, context } = result;
    const { organizationId } = context;

    if (!organizationId) {
      logger.warn('Organization ID missing in request context', {
        requestId,
        userId,
      });
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.ORGANIZATION_REQUIRED,
          code: 'ORGANIZATION_REQUIRED',
        },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validatedData = ProjectRegisterRequestSchema.parse(body);

    // Null safety check
    if (!validatedData.project) {
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.VALIDATION_FAILED,
          code: 'MISSING_PROJECT_DATA',
        },
        { status: 400 }
      );
    }

    const projectData = validatedData.project;
    const userProjectId = projectData.id || '';

    logger.info('Project creation requested', {
      requestId,
      userId,
      organizationId,
      projectId: userProjectId,
      name: projectData.name,
    });

    // Validate project ID format
    const projectIdValidation = ProjectIdSchema.safeParse(userProjectId);
    if (!projectIdValidation.success) {
      logger.warn('Invalid project ID format', {
        requestId,
        projectId: userProjectId,
        errors: projectIdValidation.error.issues,
      });
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.PROJECT_INVALID_ID,
          code: 'INVALID_PROJECT_ID',
          details: projectIdValidation.error.issues,
        },
        { status: 400 }
      );
    }

    // Validate labels if provided
    if (projectData.labels) {
      const labelsValidation = validateLabels(projectData.labels as any);
      if (!labelsValidation.valid) {
        logger.warn('Invalid labels', {
          requestId,
          projectId: userProjectId,
          errors: labelsValidation.errors,
        });
        return NextResponse.json(
          {
            success: false,
            error: `Label validation failed: ${labelsValidation.errors?.join(', ')}`,
            code: 'INVALID_LABELS',
            details: labelsValidation.errors,
          },
          { status: 400 }
        );
      }
    }

    const { prisma } = await import('src/lib/prisma');

    // Use transaction for tier limit check + project creation (prevents race conditions)
    const createdProject = await prisma.$transaction(async (tx) => {
      // 1. Check if project ID already exists
      const existingProject = await tx.project.findFirst({
        where: {
          id: userProjectId,
          ...(isHeadlessMode() ? {} : { organizationId }),
        },
      });

      if (existingProject) {
        logger.warn('Project ID already exists', {
          requestId,
          projectId: userProjectId,
          organizationId,
        });
        throw new Error('PROJECT_EXISTS');
      }

      // 2. Check tier limits with row locking (prevents race condition)
      const projectCount = await tx.project.count({
        where: {
          ...(isHeadlessMode() ? {} : { organizationId }),
          deletedAt: null,
        },
      });

      // Get tier limits
      const { getTierLimits } = await import('src/app/api/lib/billing/tier-limits');
      const limits = getTierLimits(context.subscriptionTier || 'free');

      if (projectCount >= limits.maxProjects) {
        logger.warn('Project limit exceeded', {
          requestId,
          userId,
          organizationId,
          current: projectCount,
          limit: limits.maxProjects,
          tier: context.subscriptionTier,
        });
        throw new Error(
          JSON.stringify({
            code: 'TIER_LIMIT_EXCEEDED',
            current: projectCount,
            limit: limits.maxProjects,
          })
        );
      }

      // 3. Check for domain name conflicts
      const domains = projectData.domains || [
        { id: 'development', name: 'Development' },
        { id: 'staging', name: 'Staging' },
        { id: 'production', name: 'Production' },
      ];

      const proposedDomains = domains.map((d) => `${userProjectId}-${d.id}`);

      const existingProjects = await tx.project.findMany({
        where: { ...(isHeadlessMode() ? {} : { organizationId }), deletedAt: null },
        select: { flyteDomains: true },
      });

      const existingDomains = existingProjects.flatMap((p) =>
        ((p.flyteDomains as any[]) || []).map((d) => d.id)
      );

      const conflicts = proposedDomains.filter((d) => existingDomains.includes(d));

      if (conflicts.length > 0) {
        logger.warn('Domain name conflicts detected', {
          requestId,
          projectId: userProjectId,
          conflicts,
        });
        throw new Error('DOMAIN_CONFLICT');
      }

      // 4. Create project record (mark as pending sync)
      const project = await tx.project.create({
        data: {
          id: userProjectId,
          organizationId,
          name: projectData.name || '',
          description: projectData.description || null,
          flyteProjectId: 'aus', // Will be set by registration service
          flyteOrgPrefix: `org-${organizationId.substring(0, 8)}`,
          flyteState: projectData.state || 0,
          flyteDomains: domains as any,
          createdBy: userId,
          metadata: {
            labels: projectData.labels || {},
            syncStatus: 'PENDING',
          },
        },
      });

      logger.info('Project created in database', {
        requestId,
        projectId: userProjectId,
      });

      return project;
    });

    createdProjectId = createdProject.id;

    // 5. Register in Flyte (outside transaction, with rollback on failure)
    try {
      const { ProjectRegistrationService } = await import(
        'src/app/api/lib/services/project-registration-service'
      );

      const registrationResult = await ProjectRegistrationService.registerProject(
        {
          userProjectId,
          organizationId,
          userId,
          name: projectData.name || '',
          description: projectData.description || undefined,
          domains: (projectData.domains || []).filter(
            (d): d is { id: string; name: string } => !!d.id && !!d.name
          ),
          state: projectData.state || 0,
        },
        engineManager
      );

      if (!registrationResult.success) {
        logger.error('Flyte registration failed, rolling back database', null, {
          requestId,
          projectId: userProjectId,
          error: registrationResult.error,
        });

        // Rollback: Delete from database
        await prisma.project.delete({
          where: { id: userProjectId },
        });

        throw new Error(registrationResult.error || 'Failed to register project in Flyte');
      }

      // Update sync status
      await prisma.project.update({
        where: { id: userProjectId },
        data: {
          metadata: {
            ...((createdProject.metadata as any) || {}),
            syncStatus: 'SYNCED',
          },
        },
      });

      logger.info('Project registered successfully', {
        requestId,
        projectId: userProjectId,
        flyteProjectId: registrationResult.flyteProjectId,
      });

      // Track usage for billing
      await trackEngineUsage(userId, 'project', 1, {
        projectId: userProjectId,
        flyteProjectId: registrationResult.flyteProjectId,
        name: projectData.name,
      });

      // Audit log
      await auditEngineOperation(userId, 'project_created', 'projects', userProjectId, {
        name: projectData.name,
        flyteProjectId: registrationResult.flyteProjectId,
        organizationId,
      });

      const duration = Date.now() - startTime;
      logger.info('Project creation completed', {
        requestId,
        projectId: userProjectId,
        duration,
      });

      // Return user-friendly project ID
      return NextResponse.json({
        success: true,
        data: {
          id: userProjectId,
          flyteProjectId: registrationResult.flyteProjectId,
          name: projectData.name,
          description: projectData.description,
          domains: createdProject.flyteDomains,
          registered: registrationResult.registered,
        },
        message: `Project "${projectData.name}" created successfully!`,
      });
    } catch (flyteError) {
      // Rollback database record if Flyte registration failed
      if (createdProjectId) {
        logger.error('Rolling back project creation due to Flyte error', flyteError, {
          requestId,
          projectId: createdProjectId,
        });

        await prisma.project
          .delete({
            where: { id: createdProjectId },
          })
          .catch((deleteError) => {
            logger.error('Failed to rollback project', deleteError, {
              requestId,
              projectId: createdProjectId ?? undefined,
            });
          });
      }

      throw flyteError;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Project creation failed', error, {
      requestId,
      projectId: createdProjectId ?? undefined,
      duration,
    });

    // Handle specific error codes
    if (error.message === 'PROJECT_EXISTS') {
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.PROJECT_ALREADY_EXISTS,
          code: 'PROJECT_EXISTS',
        },
        { status: 409 }
      );
    }

    if (error.message === 'DOMAIN_CONFLICT') {
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.PROJECT_DOMAIN_CONFLICT,
          code: 'DOMAIN_CONFLICT',
        },
        { status: 409 }
      );
    }

    // Handle tier limit errors
    if (error.message?.includes('TIER_LIMIT_EXCEEDED')) {
      const errorData = JSON.parse(error.message);
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.PROJECT_LIMIT_REACHED,
          code: 'TIER_LIMIT_EXCEEDED',
          upgradeUrl: '/dashboard/billing/plans',
          current: errorData.current,
          limit: errorData.limit,
        },
        { status: 402 }
      );
    }

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: ErrorMessages.VALIDATION_FAILED,
          code: 'VALIDATION_ERROR',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    // Generic error
    return NextResponse.json(
      {
        success: false,
        error: ErrorMessages.PROJECT_CREATION_FAILED,
        code: 'CREATION_FAILED',
      },
      { status: 500 }
    );
  }
}
