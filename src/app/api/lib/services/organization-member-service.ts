// Organization Member Service
import type { OrganizationRole, OrganizationMember } from '@prisma/client';

import { prisma } from '@app/database';

export interface AddMemberInput {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  invitedBy?: string;
}

export interface UpdateMemberInput {
  role?: OrganizationRole;
  isActive?: boolean;
}

export class OrganizationMemberService {
  /**
   * Add member to organization
   */
  static async addMember(data: AddMemberInput): Promise<OrganizationMember> {
    try {
      // Check if user is already a member
      const existing = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: data.organizationId,
            userId: data.userId,
          },
        },
      });

      if (existing) {
        // If member exists but is inactive, reactivate them
        if (!existing.isActive) {
          return await prisma.organizationMember.update({
            where: { id: existing.id },
            data: {
              isActive: true,
              role: data.role,
              leftAt: null,
            },
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
          });
        }
        throw new Error('User is already a member of this organization');
      }

      return await prisma.organizationMember.create({
        data: {
          organizationId: data.organizationId,
          userId: data.userId,
          role: data.role,
          invitedBy: data.invitedBy,
          isActive: true,
        },
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
      });
    } catch (error) {
      console.error('Error adding member:', error);
      throw error;
    }
  }

  /**
   * Get organization members
   */
  static async getMembers(
    organizationId: string,
    activeOnly: boolean = true
  ): Promise<OrganizationMember[]> {
    try {
      return await prisma.organizationMember.findMany({
        where: {
          organizationId,
          ...(activeOnly && { isActive: true }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              photoURL: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'desc' }],
      });
    } catch (error) {
      console.error('Error getting members:', error);
      throw error;
    }
  }

  /**
   * Get single member
   */
  static async getMember(memberId: string): Promise<OrganizationMember | null> {
    try {
      return await prisma.organizationMember.findUnique({
        where: { id: memberId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              photoURL: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error getting member:', error);
      throw error;
    }
  }

  /**
   * Update member role or status
   */
  static async updateMember(
    memberId: string,
    data: UpdateMemberInput
  ): Promise<OrganizationMember> {
    try {
      return await prisma.organizationMember.update({
        where: { id: memberId },
        data: {
          ...(data.role && { role: data.role }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.isActive === false && { leftAt: new Date() }),
        },
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
      });
    } catch (error) {
      console.error('Error updating member:', error);
      throw error;
    }
  }

  /**
   * Remove member from organization (soft delete)
   */
  static async removeMember(memberId: string): Promise<void> {
    try {
      await prisma.organizationMember.update({
        where: { id: memberId },
        data: {
          isActive: false,
          leftAt: new Date(),
        },
      });
    } catch (error) {
      console.error('Error removing member:', error);
      throw error;
    }
  }

  /**
   * Hard delete member
   */
  static async deleteMember(memberId: string): Promise<void> {
    try {
      await prisma.organizationMember.delete({
        where: { id: memberId },
      });
    } catch (error) {
      console.error('Error deleting member:', error);
      throw error;
    }
  }

  /**
   * Get member by user and organization
   */
  static async getMemberByUserAndOrg(
    userId: string,
    organizationId: string
  ): Promise<OrganizationMember | null> {
    try {
      return await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
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
      });
    } catch (error) {
      console.error('Error getting member by user and org:', error);
      throw error;
    }
  }

  /**
   * Check if user can manage member (based on role hierarchy)
   */
  static async canManageMember(
    managerUserId: string,
    organizationId: string,
    targetMemberId: string
  ): Promise<boolean> {
    try {
      const [manager, targetMember] = await Promise.all([
        this.getMemberByUserAndOrg(managerUserId, organizationId),
        this.getMember(targetMemberId),
      ]);

      if (!manager || !targetMember) return false;
      if (!manager.isActive || !targetMember.isActive) return false;

      // OWNER can manage everyone
      if (manager.role === 'OWNER') return true;

      // ADMIN can manage MEMBER and VIEWER
      if (manager.role === 'ADMIN') {
        return ['MEMBER', 'VIEWER'].includes(targetMember.role);
      }

      return false;
    } catch (error) {
      console.error('Error checking can manage member:', error);
      return false;
    }
  }

  /**
   * Get member count by role
   */
  static async getMemberCountByRole(organizationId: string): Promise<Record<string, number>> {
    try {
      const members = await prisma.organizationMember.findMany({
        where: {
          organizationId,
          isActive: true,
        },
        select: {
          role: true,
        },
      });

      return members.reduce(
        (acc, member) => {
          acc[member.role] = (acc[member.role] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    } catch (error) {
      console.error('Error getting member count by role:', error);
      throw error;
    }
  }
}
