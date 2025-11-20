/**
 * Audit Logging Service
 * Tracks all user actions for compliance and security
 */

import { NextRequest } from 'next/server';

import { prisma } from '@app/database';

/**
 * Extract IP address and user agent from request
 */
function extractRequestMetadata(request?: NextRequest) {
  if (!request) {
    return { ipAddress: null, userAgent: null };
  }

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const userAgent = request.headers.get('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Log an audit event
 */
export async function logAuditEvent(params: {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  projectId?: string | null;
  details?: Record<string, any>;
  request?: NextRequest;
}): Promise<void> {
  const {
    userId,
    action,
    resource,
    resourceId = 'unknown',
    projectId = 'default',
    details = {},
    request,
  } = params;

  const { ipAddress, userAgent } = extractRequestMetadata(request);

  try {
    await prisma.auditLog.create({
      data: {
        user: {
          connect: { id: userId },
        },
        project: projectId ? { connect: { id: projectId } } : (undefined as any),
        action,
        resource,
        resourceId,
        ipAddress,
        userAgent,
        timestamp: new Date(),
        metadata: details || {},
      } as any, // Cast to bypass required field validation
    });

    console.log(`✅ Audit log: ${userId} → ${action} → ${resource}/${resourceId}`);
  } catch (error) {
    console.error('❌ Failed to create audit log:', error);
    // Fallback to console logging
    await logAuditToConsole(params);
  }
}

/**
 * Log resource creation
 */
export async function logResourceCreated(params: {
  userId: string;
  resourceType: string;
  resourceId: string;
  projectId?: string;
  details?: Record<string, any>;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: `${params.resourceType}_created`,
    resource: params.resourceType,
    resourceId: params.resourceId,
    projectId: params.projectId,
    details: params.details,
    request: params.request,
  });
}

/**
 * Log resource update
 */
export async function logResourceUpdated(params: {
  userId: string;
  resourceType: string;
  resourceId: string;
  projectId?: string;
  changes?: Record<string, any>;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: `${params.resourceType}_updated`,
    resource: params.resourceType,
    resourceId: params.resourceId,
    projectId: params.projectId,
    details: { changes: params.changes },
    request: params.request,
  });
}

/**
 * Log resource deletion
 */
export async function logResourceDeleted(params: {
  userId: string;
  resourceType: string;
  resourceId: string;
  projectId?: string;
  reason?: string;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: `${params.resourceType}_deleted`,
    resource: params.resourceType,
    resourceId: params.resourceId,
    projectId: params.projectId,
    details: { reason: params.reason },
    request: params.request,
  });
}

/**
 * Log execution termination
 */
export async function logExecutionTerminated(params: {
  userId: string;
  executionId: string;
  projectId: string;
  reason?: string;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: 'execution_terminated',
    resource: 'executions',
    resourceId: params.executionId,
    projectId: params.projectId,
    details: { reason: params.reason },
    request: params.request,
  });
}

/**
 * Log authentication event
 */
export async function logAuthEvent(params: {
  userId: string;
  action: 'login' | 'logout' | 'token_refresh' | 'password_change';
  success: boolean;
  details?: Record<string, any>;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: `auth_${params.action}`,
    resource: 'authentication',
    resourceId: params.userId,
    projectId: 'system',
    details: {
      success: params.success,
      ...params.details,
    },
    request: params.request,
  });
}

/**
 * Log login attempt
 */
export async function logLoginAttempt(params: {
  email: string;
  userId?: string;
  success: boolean;
  reason?: string;
  twoFactorRequired?: boolean;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId || 'anonymous',
    action: params.success ? 'login_success' : 'login_failed',
    resource: 'authentication',
    resourceId: params.email,
    projectId: 'system',
    details: {
      email: params.email,
      success: params.success,
      reason: params.reason,
      twoFactorRequired: params.twoFactorRequired,
    },
    request: params.request,
  });
}

/**
 * Log account lockout event
 */
export async function logAccountLockout(params: {
  email: string;
  userId?: string;
  duration: number;
  attempts: number;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId || 'anonymous',
    action: 'account_locked',
    resource: 'authentication',
    resourceId: params.email,
    projectId: 'system',
    details: {
      email: params.email,
      lockoutDuration: params.duration,
      failedAttempts: params.attempts,
      severity: 'warning',
    },
    request: params.request,
  });
}

/**
 * Log 2FA verification attempt
 */
export async function log2FAAttempt(params: {
  userId: string;
  success: boolean;
  method: 'totp' | 'backup_code';
  isSetup?: boolean;
  remainingBackupCodes?: number;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: params.success ? '2fa_verify_success' : '2fa_verify_failed',
    resource: 'two_factor_auth',
    resourceId: params.userId,
    projectId: 'system',
    details: {
      method: params.method,
      isSetup: params.isSetup,
      remainingBackupCodes: params.remainingBackupCodes,
      success: params.success,
    },
    request: params.request,
  });
}

/**
 * Log 2FA setup/disable
 */
export async function log2FAChange(params: {
  userId: string;
  action: 'enabled' | 'disabled';
  backupCodesGenerated?: number;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: `2fa_${params.action}`,
    resource: 'two_factor_auth',
    resourceId: params.userId,
    projectId: 'system',
    details: {
      backupCodesGenerated: params.backupCodesGenerated,
    },
    request: params.request,
  });
}

/**
 * Log session creation
 */
export async function logSessionCreated(params: {
  userId: string;
  sessionId: string;
  deviceInfo?: string;
  ipAddress?: string;
  method: 'password' | 'oauth' | 'refresh';
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: 'session_created',
    resource: 'sessions',
    resourceId: params.sessionId,
    projectId: 'system',
    details: {
      method: params.method,
      deviceInfo: params.deviceInfo,
      ipAddress: params.ipAddress,
    },
    request: params.request,
  });
}

/**
 * Log session revocation
 */
export async function logSessionRevoked(params: {
  userId: string;
  sessionId: string;
  revokedBy: 'user' | 'system' | 'admin';
  reason?: string;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: 'session_revoked',
    resource: 'sessions',
    resourceId: params.sessionId,
    projectId: 'system',
    details: {
      revokedBy: params.revokedBy,
      reason: params.reason,
    },
    request: params.request,
  });
}

/**
 * Log all sessions revoked
 */
export async function logAllSessionsRevoked(params: {
  userId: string;
  sessionCount: number;
  revokedBy: 'user' | 'system' | 'admin';
  reason: string;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: 'all_sessions_revoked',
    resource: 'sessions',
    resourceId: params.userId,
    projectId: 'system',
    details: {
      sessionCount: params.sessionCount,
      revokedBy: params.revokedBy,
      reason: params.reason,
      severity: 'high',
    },
    request: params.request,
  });
}

/**
 * Log token refresh
 */
export async function logTokenRefresh(params: {
  userId: string;
  oldJti: string;
  newJti: string;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: 'token_refreshed',
    resource: 'tokens',
    resourceId: params.newJti,
    projectId: 'system',
    details: {
      oldJti: params.oldJti,
      newJti: params.newJti,
    },
    request: params.request,
  });
}

/**
 * Log suspicious token reuse detection
 */
export async function logTokenReuseDetected(params: {
  userId: string;
  jti: string;
  ipAddress?: string;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: 'token_reuse_detected',
    resource: 'tokens',
    resourceId: params.jti,
    projectId: 'system',
    details: {
      severity: 'critical',
      threat: 'token_theft',
      ipAddress: params.ipAddress,
      message: 'Possible token theft detected - all sessions revoked',
    },
    request: params.request,
  });
}

/**
 * Log OAuth authentication attempt
 */
export async function logOAuthAttempt(params: {
  email: string;
  userId?: string;
  provider: 'google' | 'github';
  success: boolean;
  isNewUser?: boolean;
  reason?: string;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId || 'anonymous',
    action: params.success ? 'oauth_success' : 'oauth_failed',
    resource: 'oauth',
    resourceId: params.email,
    projectId: 'system',
    details: {
      provider: params.provider,
      email: params.email,
      success: params.success,
      isNewUser: params.isNewUser,
      reason: params.reason,
    },
    request: params.request,
  });
}

/**
 * Log password reset request
 */
export async function logPasswordResetRequest(params: {
  email: string;
  userId?: string;
  success: boolean;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId || 'anonymous',
    action: 'password_reset_requested',
    resource: 'authentication',
    resourceId: params.email,
    projectId: 'system',
    details: {
      email: params.email,
      success: params.success,
    },
    request: params.request,
  });
}

/**
 * Log password change
 */
export async function logPasswordChange(params: {
  userId: string;
  method: 'reset' | 'change';
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: 'password_changed',
    resource: 'authentication',
    resourceId: params.userId,
    projectId: 'system',
    details: {
      method: params.method,
    },
    request: params.request,
  });
}

/**
 * Log suspicious activity
 */
export async function logSuspiciousActivity(params: {
  userId?: string;
  activityType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details?: Record<string, any>;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId || 'anonymous',
    action: 'suspicious_activity',
    resource: 'security',
    resourceId: params.activityType,
    projectId: 'system',
    details: {
      activityType: params.activityType,
      severity: params.severity,
      description: params.description,
      ...params.details,
    },
    request: params.request,
  });
}

/**
 * Log permission denied event
 */
export async function logPermissionDenied(params: {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  requiredPermission: string;
  request?: NextRequest;
}): Promise<void> {
  await logAuditEvent({
    userId: params.userId,
    action: 'permission_denied',
    resource: params.resource,
    resourceId: params.resourceId,
    projectId: 'system',
    details: {
      attemptedAction: params.action,
      requiredPermission: params.requiredPermission,
    },
    request: params.request,
  });
}

/**
 * Get audit trail for a project
 */
export async function getAuditTrail(params: {
  projectId: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
  resource?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: any[];
  total: number;
  hasMore: boolean;
}> {
  const {
    projectId,
    startDate,
    endDate,
    userId,
    action,
    resource,
    limit = 50,
    offset = 0,
  } = params;

  try {
    const where: any = { projectId };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resource) where.resource = resource;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      hasMore: offset + limit < total,
    };
  } catch (error) {
    console.error('❌ Failed to get audit trail:', error);
    return { logs: [], total: 0, hasMore: false };
  }
}

/**
 * Get audit trail for a specific user
 */
export async function getUserAuditTrail(params: {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: any[];
  total: number;
  hasMore: boolean;
}> {
  const { userId, startDate, endDate, limit = 50, offset = 0 } = params;

  try {
    const where: any = { userId };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      hasMore: offset + limit < total,
    };
  } catch (error) {
    console.error('❌ Failed to get user audit trail:', error);
    return { logs: [], total: 0, hasMore: false };
  }
}

/**
 * Get audit statistics
 */
export async function getAuditStats(params: {
  projectId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  totalEvents: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  byUser: Record<string, number>;
}> {
  const { projectId, userId, startDate, endDate } = params;

  try {
    const where: any = {};

    if (projectId) where.projectId = projectId;
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    // ⚡ Performance: Use aggregation instead of loading all logs
    const [totalCount, byActionData, byResourceData, byUserData] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
      }),
      prisma.auditLog.groupBy({
        by: ['resource'],
        where,
        _count: { resource: true },
      }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        where,
        _count: { userId: true },
      }),
    ]);

    // Convert aggregated data to record format
    const byAction = byActionData.reduce(
      (acc, item) => {
        acc[item.action] = item._count.action;
        return acc;
      },
      {} as Record<string, number>
    );

    const byResource = byResourceData.reduce(
      (acc, item) => {
        acc[item.resource] = item._count.resource;
        return acc;
      },
      {} as Record<string, number>
    );

    const byUser = byUserData.reduce(
      (acc, item) => {
        acc[item.userId] = item._count.userId;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalEvents: totalCount,
      byAction,
      byResource,
      byUser,
    };
  } catch (error) {
    console.error('❌ Failed to get audit stats:', error);
    return {
      totalEvents: 0,
      byAction: {},
      byResource: {},
      byUser: {},
    };
  }
}

/**
 * Get resources created by user
 */
export async function getUserResources(params: {
  userId: string;
  resourceType?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}): Promise<
  Array<{
    resourceType: string;
    resourceId: string;
    createdAt: Date;
    projectId: string;
  }>
> {
  const { userId, resourceType, projectId, limit = 100, offset = 0 } = params;

  try {
    const where: any = {
      userId,
      action: { endsWith: '_created' },
    };

    if (resourceType) where.resource = resourceType;
    if (projectId) where.projectId = projectId;

    // ⚡ Performance: Add pagination
    const logs = await prisma.auditLog.findMany({
      where,
      select: {
        resource: true,
        resourceId: true,
        timestamp: true,
        projectId: true,
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });

    return logs.map((log) => ({
      resourceType: log.resource,
      resourceId: log.resourceId,
      createdAt: log.timestamp,
      projectId: log.projectId,
    }));
  } catch (error) {
    console.error('❌ Failed to get user resources:', error);
    return [];
  }
}

/**
 * Fallback console logging
 */
async function logAuditToConsole(params: any): Promise<void> {
  console.log('📝 Audit log (console):', {
    userId: params.userId,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId,
    timestamp: new Date().toISOString(),
    details: params.details,
  });
}

/**
 * Cleanup - disconnect Prisma client
 * Note: Prisma client is now a singleton, cleanup handled globally
 */
export async function cleanup(): Promise<void> {
  // Singleton prisma client - no manual cleanup needed
}
