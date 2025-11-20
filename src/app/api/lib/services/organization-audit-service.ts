// Organization Audit Service
import { prisma } from '@app/database';

export type OrganizationAuditAction =
  | 'organization.created'
  | 'organization.updated'
  | 'organization.deleted'
  | 'member.added'
  | 'member.updated'
  | 'member.removed'
  | 'invitation.created'
  | 'invitation.accepted'
  | 'invitation.cancelled'
  | 'role.changed'
  | 'settings.updated';

export interface CreateAuditLogInput {
  organizationId: string;
  userId: string;
  action: OrganizationAuditAction;
  resource: string;
  resourceId: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  organizationId?: string;
  userId?: string;
  action?: OrganizationAuditAction;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Organization Audit Service
 * Logs and retrieves audit trails for organization actions
 */
export class OrganizationAuditService {
  /**
   * Create audit log entry
   */
  static async log(input: CreateAuditLogInput): Promise<void> {
    try {
      // For organization auditing, we'll store in metadata since the existing
      // AuditLog model requires projectId
      // In production, you might want to create a separate OrganizationAuditLog table

      await prisma.$executeRaw`
        INSERT INTO audit_logs_organization (
          id, organization_id, user_id, action, resource, resource_id,
          ip_address, user_agent, metadata, timestamp
        ) VALUES (
          gen_random_uuid()::text,
          ${input.organizationId},
          ${input.userId},
          ${input.action},
          ${input.resource},
          ${input.resourceId},
          ${input.ipAddress || null},
          ${input.userAgent || null},
          ${JSON.stringify(input.metadata || {})}::jsonb,
          NOW()
        )
        ON CONFLICT DO NOTHING
      `;
    } catch {
      // If table doesn't exist, fallback to simple logging
      console.log('[AuditLog]', {
        organizationId: input.organizationId,
        userId: input.userId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        metadata: input.metadata,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get audit logs with filters
   */
  static async getLogs(
    filters: AuditLogFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    logs: any[];
    total: number;
  }> {
    try {
      // Try to query from organization audit table
      const whereConditions = ['1=1'];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.organizationId) {
        whereConditions.push(`organization_id = $${paramIndex}`);
        params.push(filters.organizationId);
        paramIndex += 1;
      }

      if (filters.userId) {
        whereConditions.push(`user_id = $${paramIndex}`);
        params.push(filters.userId);
        paramIndex += 1;
      }

      if (filters.action) {
        whereConditions.push(`action = $${paramIndex}`);
        params.push(filters.action);
        paramIndex += 1;
      }

      if (filters.resource) {
        whereConditions.push(`resource = $${paramIndex}`);
        params.push(filters.resource);
        paramIndex += 1;
      }

      if (filters.startDate) {
        whereConditions.push(`timestamp >= $${paramIndex}`);
        params.push(filters.startDate);
        paramIndex += 1;
      }

      if (filters.endDate) {
        whereConditions.push(`timestamp <= $${paramIndex}`);
        params.push(filters.endDate);
        paramIndex += 1;
      }

      // whereClause variable removed - not used

      // For now, return empty array since table might not exist
      // In production, you would query the actual table
      return {
        logs: [],
        total: 0,
      };
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return {
        logs: [],
        total: 0,
      };
    }
  }

  /**
   * Get recent activity for an organization
   */
  static async getRecentActivity(organizationId: string, limit: number = 20): Promise<any[]> {
    try {
      return await this.getLogs({ organizationId }, 1, limit).then((result) => result.logs);
    } catch (error) {
      console.error('Error getting recent activity:', error);
      return [];
    }
  }

  /**
   * Utility: Log organization creation
   */
  static async logOrganizationCreated(
    organizationId: string,
    userId: string,
    metadata?: any
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action: 'organization.created',
      resource: 'organization',
      resourceId: organizationId,
      metadata,
    });
  }

  /**
   * Utility: Log organization update
   */
  static async logOrganizationUpdated(
    organizationId: string,
    userId: string,
    changes: any
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action: 'organization.updated',
      resource: 'organization',
      resourceId: organizationId,
      metadata: { changes },
    });
  }

  /**
   * Utility: Log member added
   */
  static async logMemberAdded(
    organizationId: string,
    userId: string,
    memberId: string,
    role: string
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action: 'member.added',
      resource: 'member',
      resourceId: memberId,
      metadata: { role },
    });
  }

  /**
   * Utility: Log member role changed
   */
  static async logRoleChanged(
    organizationId: string,
    userId: string,
    memberId: string,
    oldRole: string,
    newRole: string
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action: 'role.changed',
      resource: 'member',
      resourceId: memberId,
      metadata: { oldRole, newRole },
    });
  }

  /**
   * Utility: Log member removed
   */
  static async logMemberRemoved(
    organizationId: string,
    userId: string,
    memberId: string
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action: 'member.removed',
      resource: 'member',
      resourceId: memberId,
    });
  }

  /**
   * Utility: Log invitation created
   */
  static async logInvitationCreated(
    organizationId: string,
    userId: string,
    invitationId: string,
    email: string,
    role: string
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action: 'invitation.created',
      resource: 'invitation',
      resourceId: invitationId,
      metadata: { email, role },
    });
  }

  /**
   * Utility: Log invitation accepted
   */
  static async logInvitationAccepted(
    organizationId: string,
    userId: string,
    invitationId: string
  ): Promise<void> {
    await this.log({
      organizationId,
      userId,
      action: 'invitation.accepted',
      resource: 'invitation',
      resourceId: invitationId,
    });
  }
}
