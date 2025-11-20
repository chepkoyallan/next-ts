/**
 * Admin API - Organizations Management
 * Manage all organizations across the platform
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schemas
const OrganizationQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED']).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
  sortBy: z.enum(['createdAt', 'name', 'userCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const CreateOrganizationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .max(50)
    .optional()
    .or(z.literal('')),
  email: z.string().email().max(255).optional().or(z.literal('')).or(z.null()),
  domain: z.string().max(255).optional().or(z.literal('')).or(z.null()),
  description: z.string().max(500).optional().or(z.literal('')),
  website: z.string().url().max(255).optional().or(z.literal('')).or(z.null()),
  industry: z.string().optional().or(z.literal('')),
  size: z.string().optional().or(z.literal('')),
  ownerId: z.string().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * GET /api/v1/admin/organizations
 * List all organizations with filtering and search
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin access (requires system-admin or super-admin)
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');

    // Parse and validate query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = OrganizationQuerySchema.parse(queryParams);

    // Build where clause
    const where: any = {};

    if (validatedQuery.search) {
      where.OR = [
        { name: { contains: validatedQuery.search, mode: 'insensitive' } },
        { domain: { contains: validatedQuery.search, mode: 'insensitive' } },
        { email: { contains: validatedQuery.search, mode: 'insensitive' } },
      ];
    }

    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }

    // ⚡ Performance: Get total count and organizations in parallel with caching
    const [total, organizations] = await Promise.all([
      prisma.organization.count({
        where,
        cacheStrategy: { ttl: 60, swr: 10 },
      } as any),
      prisma.organization.findMany({
        where,
        take: validatedQuery.limit || 50,
        skip: validatedQuery.offset || 0,
        orderBy: {
          [validatedQuery.sortBy || 'createdAt']: validatedQuery.sortOrder || 'desc',
        },
        include: {
          _count: {
            select: {
              members: true,
              projects: true,
              billingAccounts: true,
            },
          },
          billingAccounts: {
            take: 1,
            include: {
              subscriptions: {
                where: {
                  status: { in: ['ACTIVE', 'TRIALING'] },
                },
                include: {
                  plan: {
                    select: {
                      name: true,
                      tier: true,
                    },
                  },
                },
                take: 1,
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
        cacheStrategy: { ttl: 60, swr: 10 },
      } as any),
    ]);

    // Format response
    const formattedOrgs = organizations.map((org: any) => {
      const billingAccount = org.billingAccounts[0];
      const subscription = billingAccount?.subscriptions?.[0];
      const metadata = (org.metadata || {}) as any;

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        // domain removed,
        // email removed,
        status: org.status,
        size: metadata.size || null,
        industry: metadata.industry || null,
        logoUrl: metadata.logoUrl || null,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        metadata: metadata as any,
        counts: {
          members: org._count.members,
          projects: org._count.projects,
          billingAccounts: org._count.billingAccounts,
        },
        stats: {
          memberCount: org._count.members,
          projectCount: org._count.projects,
        },
        currentSubscription: subscription
          ? {
              plan: subscription.plan.name,
              tier: subscription.plan.tier,
              status: subscription.status,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        organizations: formattedOrgs,
        pagination: {
          total,
          limit: validatedQuery.limit || 50,
          offset: validatedQuery.offset || 0,
        },
      },
    });
  } catch (error) {
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

    console.error('Error listing organizations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list organizations',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/organizations
 * Create a new organization
 */
export async function POST(request: NextRequest) {
  try {
    const adminContext = await requireAdmin(request, {
      requiredRole: 'system-admin',
      auditLog: true,
    });

    if (adminContext instanceof NextResponse) {
      return adminContext;
    }

    const { prisma } = await import('src/lib/prisma');
    const body = await request.json();
    const validatedData = CreateOrganizationSchema.parse(body);

    // Generate slug from name if not provided
    const slug = validatedData.slug || generateSlug(validatedData.name);

    // Check if organization with slug already exists
    const existingOrg = await prisma.organization.findUnique({
      where: { slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        {
          success: false,
          error: 'An organization with this slug already exists',
        },
        { status: 409 }
      );
    }

    // Get free plan for default subscription
    const freePlan = await prisma.subscriptionPlan.findFirst({
      where: { tier: 'FREE' },
    });

    if (!freePlan) {
      return NextResponse.json(
        {
          success: false,
          error: 'Free plan not found. Please create a free plan first.',
        },
        { status: 500 }
      );
    }

    // Build metadata with size, industry, description
    const metadata = validatedData.metadata || {};
    if (validatedData.size && validatedData.size !== '') metadata.size = validatedData.size;
    if (validatedData.industry && validatedData.industry !== '')
      metadata.industry = validatedData.industry;
    if (validatedData.description && validatedData.description !== '')
      metadata.description = validatedData.description;

    // Create organization with billing account and free subscription
    const organization = await prisma.organization.create({
      data: {
        name: validatedData.name,
        slug,
        // email: validatedData.email && validatedData.email !== '' ? validatedData.email : null, // Field doesn't exist
        // domain: validatedData.domain && validatedData.domain !== '' ? validatedData.domain : null, // Field doesn't exist
        website:
          validatedData.website && validatedData.website !== '' ? validatedData.website : null,
        ownerId: validatedData.ownerId || adminContext.userId,
        settings: (validatedData.settings as any) || {},
        metadata: metadata as any,
        status: 'ACTIVE',
        billingAccounts: {
          create: {
            name: validatedData.name || 'Default Billing Account',
            email: 'billing@example.com',
            // isDefault: true, // Field may not exist
            subscriptions: {
              create: {
                planId: freePlan.id,
                projectId: 'default', // Required field
                status: 'ACTIVE',
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
              },
            },
          } as any,
        },
      },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
            billingAccounts: true,
          },
        },
        billingAccounts: {
          take: 1,
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: {
                plan: {
                  select: {
                    name: true,
                    tier: true,
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    // Add owner as member if ownerId provided
    if (validatedData.ownerId) {
      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: validatedData.ownerId,
          role: 'ADMIN',
          isActive: true,
          invitedBy: adminContext.userId,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            status: organization.status,
            createdAt: organization.createdAt,
            subscription: (organization as any).billingAccounts?.[0]?.subscriptions?.[0],
          },
        },
        message: 'Organization created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
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

    console.error('Error creating organization:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create organization',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a URL-safe slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
