// Organization Service
import type { Organization, OrganizationRole, OrganizationStatus } from '@prisma/client';

import { prisma } from '@app/database';

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  industry?: string | null;
  size?: string | null;
  ownerId?: string | null;
  settings?: any;
  metadata?: any;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  industry?: string | null;
  size?: string | null;
  status?: OrganizationStatus;
  ownerId?: string | null;
  settings?: any;
  metadata?: any;
}

export interface OrganizationFilters {
  status?: OrganizationStatus;
  industry?: string;
  size?: string;
  ownerId?: string;
  search?: string;
}

export class OrganizationService {
  /**
   * Create a new organization
   */
  static async create(data: CreateOrganizationInput): Promise<Organization> {
    try {
      // Check if slug already exists
      const existing = await prisma.organization.findUnique({
        where: { slug: data.slug },
      });

      if (existing) {
        throw new Error(`Organization with slug '${data.slug}' already exists`);
      }

      const organization = await prisma.organization.create({
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          logoUrl: data.logoUrl,
          website: data.website,
          industry: data.industry,
          size: data.size,
          ownerId: data.ownerId,
          status: 'ACTIVE',
          settings: data.settings || {},
          metadata: data.metadata || {},
        },
      });

      // If ownerId is provided, add them as OWNER member
      if (data.ownerId) {
        await prisma.organizationMember.create({
          data: {
            organizationId: organization.id,
            userId: data.ownerId,
            role: 'OWNER',
            isActive: true,
          },
        });
      }

      return organization;
    } catch (error) {
      console.error('Error creating organization:', error);
      throw error;
    }
  }

  /**
   * Find organization by ID
   */
  static async findById(id: string): Promise<Organization | null> {
    try {
      return await prisma.organization.findUnique({
        where: { id },
        include: {
          members: {
            where: { isActive: true },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  photoURL: true,
                },
              },
            },
          },
          projects: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          billingAccounts: {
            select: {
              id: true,
              status: true,
              // balance removed
            },
          },
        },
      });
    } catch (error) {
      console.error('Error finding organization:', error);
      throw error;
    }
  }

  /**
   * Find organization by slug
   */
  static async findBySlug(slug: string): Promise<Organization | null> {
    try {
      return await prisma.organization.findUnique({
        where: { slug },
      });
    } catch (error) {
      console.error('Error finding organization by slug:', error);
      throw error;
    }
  }

  /**
   * List organizations with filters and pagination
   */
  static async list(
    filters?: OrganizationFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ organizations: Organization[]; total: number; pages: number }> {
    try {
      const where: any = {
        deletedAt: null,
      };

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.industry) {
        where.industry = filters.industry;
      }

      if (filters?.size) {
        where.size = filters.size;
      }

      if (filters?.ownerId) {
        where.ownerId = filters.ownerId;
      }

      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { slug: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [organizations, total] = await Promise.all([
        prisma.organization.findMany({
          where,
          include: {
            members: {
              where: { isActive: true },
              select: {
                id: true,
                role: true,
                userId: true,
              },
            },
            projects: {
              select: {
                id: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.organization.count({ where }),
      ]);

      return {
        organizations,
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error listing organizations:', error);
      throw error;
    }
  }

  /**
   * Update organization
   */
  static async update(id: string, data: UpdateOrganizationInput): Promise<Organization | null> {
    try {
      // If slug is being updated, check uniqueness
      if (data.slug) {
        const existing = await prisma.organization.findFirst({
          where: {
            slug: data.slug,
            id: { not: id },
          },
        });

        if (existing) {
          throw new Error(`Organization with slug '${data.slug}' already exists`);
        }
      }

      return await prisma.organization.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.slug && { slug: data.slug }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
          ...(data.website !== undefined && { website: data.website }),
          ...(data.industry !== undefined && { industry: data.industry }),
          ...(data.size !== undefined && { size: data.size }),
          ...(data.status && { status: data.status }),
          ...(data.ownerId !== undefined && { ownerId: data.ownerId }),
          ...(data.settings && { settings: data.settings }),
          ...(data.metadata && { metadata: data.metadata }),
        },
      });
    } catch (error) {
      console.error('Error updating organization:', error);
      throw error;
    }
  }

  /**
   * Soft delete organization
   */
  static async delete(id: string): Promise<void> {
    try {
      await prisma.organization.update({
        where: { id },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error deleting organization:', error);
      throw error;
    }
  }

  /**
   * Get user's organizations
   */
  static async getUserOrganizations(userId: string): Promise<Organization[]> {
    try {
      const memberships = await prisma.organizationMember.findMany({
        where: {
          userId,
          isActive: true,
        },
        include: {
          organization: {
            include: {
              members: {
                where: { isActive: true },
                select: {
                  id: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      return memberships.map((m) => m.organization);
    } catch (error) {
      console.error('Error getting user organizations:', error);
      throw error;
    }
  }

  /**
   * Check if user is member of organization
   */
  static async isMember(userId: string, organizationId: string): Promise<boolean> {
    try {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
      });

      return membership !== null && membership.isActive;
    } catch (error) {
      console.error('Error checking membership:', error);
      return false;
    }
  }

  /**
   * Get user's role in organization
   */
  static async getUserRole(
    userId: string,
    organizationId: string
  ): Promise<OrganizationRole | null> {
    try {
      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
      });

      return membership?.isActive ? membership.role : null;
    } catch (error) {
      console.error('Error getting user role:', error);
      return null;
    }
  }

  /**
   * Get organization statistics
   */
  static async getStats(organizationId: string): Promise<{
    memberCount: number;
    projectCount: number;
    activeProjectCount: number;
  }> {
    try {
      const [memberCount, projectCount, activeProjectCount] = await Promise.all([
        prisma.organizationMember.count({
          where: {
            organizationId,
            isActive: true,
          },
        }),
        prisma.project.count({
          where: {
            organizationId,
            deletedAt: null,
          },
        }),
        prisma.project.count({
          where: {
            organizationId,
            deletedAt: null,
          },
        }),
      ]);

      return {
        memberCount,
        projectCount,
        activeProjectCount,
      };
    } catch (error) {
      console.error('Error getting organization stats:', error);
      throw error;
    }
  }
}
