/**
 * Admin API - Users Management
 * Manage all users across the platform
 */

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { requireAdmin } from 'src/app/api/lib/auth/admin-middleware';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Validation schemas
const UserQuerySchema = z.object({
  search: z.string().optional(),
  organizationId: z.string().optional(),
  emailVerified: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
  sortBy: z.enum(['createdAt', 'email', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const CreateUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  emailVerified: z.boolean().optional().default(false),
  organizationId: z.string().optional(),
  role: z.enum(['admin', 'developer', 'operator', 'viewer']).optional().default('viewer'),
  sendInvite: z.boolean().optional().default(true),
});

/**
 * GET /api/v1/admin/users
 * List all users with filtering and search
 */
export async function GET(request: NextRequest) {
  try {
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
    const validatedQuery = UserQuerySchema.parse(queryParams);

    // Build where clause
    const where: any = {};

    if (validatedQuery.search) {
      where.OR = [
        { email: { contains: validatedQuery.search, mode: 'insensitive' } },
        { name: { contains: validatedQuery.search, mode: 'insensitive' } },
      ];
    }

    if (validatedQuery.organizationId) {
      where.organizationMembers = {
        some: {
          organizationId: validatedQuery.organizationId,
          isActive: true,
        },
      };
    }

    if (validatedQuery.emailVerified !== undefined) {
      where.emailVerified = validatedQuery.emailVerified;
    }

    // ⚡ Performance: Get total count and users in parallel with caching
    const [total, users] = await Promise.all([
      prisma.user.count({
        where,
        cacheStrategy: { ttl: 60, swr: 10 },
      } as any),
      prisma.user.findMany({
        where,
        take: validatedQuery.limit || 50,
        skip: validatedQuery.offset || 0,
        orderBy: {
          [validatedQuery.sortBy || 'createdAt']: validatedQuery.sortOrder || 'desc',
        },
        include: {
          organizationMembers: {
            where: { isActive: true },
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
          userRoles: {
            include: {
              role: {
                select: {
                  name: true,
                  hierarchy: true,
                },
              },
            },
          },
        },
        cacheStrategy: { ttl: 60, swr: 10 },
      } as any),
    ]);

    // Format response (exclude sensitive data)
    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      organizations: (user as any).organizationMembers.map((om: any) => ({
        id: om.organization.id,
        name: om.organization.name,
        status: om.organization.status,
        role: om.role,
      })),
      roles: (user as any).userRoles.map((ur: any) => ({
        name: ur.role.name,
        hierarchy: ur.role.hierarchy,
      })),
    }));

    return NextResponse.json({
      success: true,
      data: {
        users: formattedUsers,
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

    console.error('Error listing users:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list users',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/admin/users
 * Create a new user
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
    const validatedData = CreateUserSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'A user with this email already exists',
        },
        { status: 409 }
      );
    }

    // Generate password if not provided
    const password = validatedData.password || generateRandomPassword();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        name: validatedData.name,
        passwordHash: hashedPassword,
        emailVerified: validatedData.emailVerified,
      },
      include: {
        organizationMembers: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        },
        userRoles: {
          include: {
            role: {
              select: {
                name: true,
                hierarchy: true,
              },
            },
          },
        },
      },
    });

    // Add user to organization if provided
    if (validatedData.organizationId) {
      await prisma.organizationMember.create({
        data: {
          organizationId: validatedData.organizationId,
          userId: user.id,
          role: validatedData.role.toUpperCase() as any, // Convert 'admin' -> 'ADMIN'
          isActive: true,
          invitedBy: adminContext.userId,
        },
      });
    }

    // Send invitation email if sendInvite is true
    if (validatedData.sendInvite) {
      try {
        const { emailService } = await import('src/app/api/lib/services/email-service');
        await emailService.sendWelcomeEmail(validatedData.email, password, validatedData.name);
      } catch (emailError) {
        // Log the error but don't fail the user creation
        console.error('Failed to send invitation email:', emailError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
          },
          // Only return password if it was auto-generated and no invite sent
          temporaryPassword:
            !validatedData.password && !validatedData.sendInvite ? password : undefined,
        },
        message: 'User created successfully',
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

    console.error('Error creating user:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate a cryptographically secure random password
 */
function generateRandomPassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const buffer = randomBytes(length);

  return Array.from(buffer)
    .map((byte: number) => charset[byte % charset.length])
    .join('');
}
