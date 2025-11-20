// Organization Invitation Service
import { randomBytes } from 'crypto';
import type { OrganizationRole, InvitationStatus, OrganizationInvitation } from '@prisma/client';

import { prisma } from '@app/database';

export interface CreateInvitationInput {
  organizationId: string;
  email: string;
  role: OrganizationRole;
  invitedBy: string;
  message?: string;
  expiresInDays?: number;
}

export class OrganizationInvitationService {
  /**
   * Create invitation
   */
  static async createInvitation(data: CreateInvitationInput): Promise<OrganizationInvitation> {
    try {
      // Check if user already has a pending invitation
      const existingInvitation = await prisma.organizationInvitation.findFirst({
        where: {
          organizationId: data.organizationId,
          email: data.email,
          status: 'PENDING',
        },
      });

      if (existingInvitation) {
        throw new Error('User already has a pending invitation to this organization');
      }

      // Check if user is already a member
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        const existingMember = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: data.organizationId,
              userId: existingUser.id,
            },
          },
        });

        if (existingMember && existingMember.isActive) {
          throw new Error('User is already a member of this organization');
        }
      }

      // Generate secure token
      const token = randomBytes(32).toString('hex');

      // Calculate expiry (default 7 days)
      const expiresInDays = data.expiresInDays || 7;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      return await prisma.organizationInvitation.create({
        data: {
          organizationId: data.organizationId,
          email: data.email,
          role: data.role,
          token,
          invitedBy: data.invitedBy,
          message: data.message,
          status: 'PENDING',
          expiresAt,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error creating invitation:', error);
      throw error;
    }
  }

  /**
   * Get invitation by token
   */
  static async getInvitationByToken(token: string): Promise<OrganizationInvitation | null> {
    try {
      return await prisma.organizationInvitation.findUnique({
        where: { token },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              description: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error getting invitation by token:', error);
      throw error;
    }
  }

  /**
   * Get organization invitations
   */
  static async getOrganizationInvitations(
    organizationId: string,
    status?: InvitationStatus
  ): Promise<OrganizationInvitation[]> {
    try {
      return await prisma.organizationInvitation.findMany({
        where: {
          organizationId,
          ...(status && { status }),
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error('Error getting organization invitations:', error);
      throw error;
    }
  }

  /**
   * Accept invitation
   */
  static async acceptInvitation(
    token: string,
    userId: string
  ): Promise<{ invitation: OrganizationInvitation; membership: any }> {
    try {
      const invitation = await this.getInvitationByToken(token);

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'PENDING') {
        throw new Error(`Invitation is ${invitation.status.toLowerCase()}`);
      }

      if (new Date() > invitation.expiresAt) {
        // Mark as expired
        await prisma.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
        throw new Error('Invitation has expired');
      }

      // Check if user's email matches invitation
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.email !== invitation.email) {
        throw new Error('Invitation email does not match your account');
      }

      // Create or reactivate membership
      const existingMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId,
          },
        },
      });

      let membership;
      if (existingMember) {
        membership = await prisma.organizationMember.update({
          where: { id: existingMember.id },
          data: {
            role: invitation.role,
            isActive: true,
            leftAt: null,
          },
        });
      } else {
        membership = await prisma.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId,
            role: invitation.role,
            invitedBy: invitation.invitedBy,
            isActive: true,
          },
        });
      }

      // Mark invitation as accepted
      const updatedInvitation = await prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
        include: {
          organization: true,
        },
      });

      return { invitation: updatedInvitation, membership };
    } catch (error) {
      console.error('Error accepting invitation:', error);
      throw error;
    }
  }

  /**
   * Cancel invitation
   */
  static async cancelInvitation(invitationId: string): Promise<void> {
    try {
      await prisma.organizationInvitation.update({
        where: { id: invitationId },
        data: { status: 'CANCELLED' },
      });
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      throw error;
    }
  }

  /**
   * Resend invitation (create new token and extend expiry)
   */
  static async resendInvitation(invitationId: string): Promise<OrganizationInvitation> {
    try {
      const invitation = await prisma.organizationInvitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'PENDING' && invitation.status !== 'EXPIRED') {
        throw new Error('Can only resend pending or expired invitations');
      }

      // Generate new token
      const token = randomBytes(32).toString('hex');

      // Extend expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      return await prisma.organizationInvitation.update({
        where: { id: invitationId },
        data: {
          token,
          status: 'PENDING',
          expiresAt,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error resending invitation:', error);
      throw error;
    }
  }

  /**
   * Clean up expired invitations
   */
  static async cleanupExpiredInvitations(): Promise<number> {
    try {
      const result = await prisma.organizationInvitation.updateMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lt: new Date(),
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      return result.count;
    } catch (error) {
      console.error('Error cleaning up expired invitations:', error);
      throw error;
    }
  }
}
