// Feature Flag Service
// Manages feature flags with multi-level overrides and caching

/* eslint-disable max-classes-per-file */
import crypto from 'crypto';
import { Prisma, FeatureFlagType, FeatureFlagScope } from '@prisma/client';

import { prisma } from '@app/database';
import { logger } from 'src/app/api/lib/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface FlagContext {
  userId?: string;
  organizationId?: string;
  roles?: string[];
  environment?: string;
}

export interface CreateFlagInput {
  key: string;
  name: string;
  description?: string;
  type?: FeatureFlagType;
  enabled?: boolean;
  rolloutPercentage?: number;
  enabledFrom?: Date;
  enabledUntil?: Date;
  environments?: string[];
  category?: string;
  tags?: string[];
  dependsOn?: string[];
  createdBy?: string;
}

export interface UpdateFlagInput {
  name?: string;
  description?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  enabledFrom?: Date;
  enabledUntil?: Date;
  environments?: string[];
  category?: string;
  tags?: string[];
  dependsOn?: string[];
  updatedBy?: string;
}

export interface FlagOverride {
  scope: FeatureFlagScope;
  userId?: string;
  organizationId?: string;
  roleId?: string;
  enabled: boolean;
  createdBy?: string;
}

export interface FlagStats {
  key: string;
  totalChecks: number;
  enabledChecks: number;
  disabledChecks: number;
  uniqueUsers: Set<string>;
  lastChecked: Date;
}

// ============================================================================
// In-Memory Cache
// ============================================================================

class FeatureFlagCache {
  private cache = new Map<string, any>();

  private stats = new Map<string, FlagStats>();

  private ttl = 5 * 60 * 1000; // 5 minutes

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  set(key: string, value: any): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  recordCheck(flagKey: string, enabled: boolean, userId?: string): void {
    let stats = this.stats.get(flagKey);

    if (!stats) {
      stats = {
        key: flagKey,
        totalChecks: 0,
        enabledChecks: 0,
        disabledChecks: 0,
        uniqueUsers: new Set<string>(),
        lastChecked: new Date(),
      };
      this.stats.set(flagKey, stats);
    }

    stats.totalChecks += 1;
    if (enabled) {
      stats.enabledChecks += 1;
    } else {
      stats.disabledChecks += 1;
    }

    if (userId) {
      stats.uniqueUsers.add(userId);
    }

    stats.lastChecked = new Date();
  }

  getStats(flagKey: string): FlagStats | null {
    return this.stats.get(flagKey) || null;
  }
}

const cache = new FeatureFlagCache();

// ============================================================================
// Feature Flag Service
// ============================================================================

export class FeatureFlagService {
  /**
   * Check if a feature flag is enabled for the given context
   */
  static async isEnabled(key: string, context: FlagContext = {}): Promise<boolean> {
    try {
      // 1. Get flag (with caching)
      const flag = await this.getFlag(key);

      if (!flag) {
        logger.warn(`Feature flag not found: ${key}`);
        return false;
      }

      // 2. Check if flag is expired
      if (this.isExpired(flag)) {
        return false;
      }

      // 3. Check environment restrictions
      if (!this.isEnvironmentAllowed(flag, context.environment)) {
        return false;
      }

      // 4. Check user-level override (highest priority)
      if (context.userId) {
        const userOverride = await this.getUserOverride(flag.id, context.userId);
        if (userOverride !== null) {
          this.logCheck(key, userOverride, context);
          return userOverride;
        }
      }

      // 5. Check organization-level override
      if (context.organizationId) {
        const orgOverride = await this.getOrgOverride(flag.id, context.organizationId);
        if (orgOverride !== null) {
          this.logCheck(key, orgOverride, context);
          return orgOverride;
        }
      }

      // 6. Check role-based override
      if (context.roles && context.roles.length > 0) {
        const roleOverride = await this.getRoleOverride(flag.id, context.roles);
        if (roleOverride !== null) {
          this.logCheck(key, roleOverride, context);
          return roleOverride;
        }
      }

      // 7. Check percentage rollout
      if (flag.type === 'PERCENTAGE' && flag.rolloutPercentage !== null) {
        const inRollout = this.isInRollout(
          context.userId || context.organizationId || 'anonymous',
          flag.rolloutPercentage
        );
        this.logCheck(key, inRollout, context);
        return inRollout;
      }

      // 8. Return global default
      const { enabled } = flag;
      this.logCheck(key, enabled, context);
      return enabled;
    } catch (error) {
      logger.error(`Error checking feature flag: ${key}`, error as Error, { context });
      return false; // Fail closed
    }
  }

  /**
   * Get a specific feature flag
   */
  static async getFlag(key: string) {
    // Check cache first
    const cached = cache.get(`flag:${key}`);
    if (cached) {
      return cached;
    }

    // Fetch from database
    const flag = await prisma.featureFlag.findUnique({
      where: { key },
    });

    if (flag) {
      cache.set(`flag:${key}`, flag);
    }

    return flag;
  }

  /**
   * Get all feature flags
   */
  static async getAllFlags(filters?: { category?: string; enabled?: boolean; search?: string }) {
    const where: Prisma.FeatureFlagWhereInput = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.enabled !== undefined) {
      where.enabled = filters.enabled;
    }

    if (filters?.search) {
      where.OR = [
        { key: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return prisma.featureFlag.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new feature flag
   */
  static async createFlag(input: CreateFlagInput) {
    const flag = await prisma.featureFlag.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description,
        type: input.type || 'BOOLEAN',
        enabled: input.enabled ?? false,
        rolloutPercentage: input.rolloutPercentage,
        enabledFrom: input.enabledFrom,
        enabledUntil: input.enabledUntil,
        environments: input.environments ? (input.environments as any) : undefined,
        category: input.category,
        tags: input.tags ? (input.tags as any) : undefined,
        dependsOn: input.dependsOn ? (input.dependsOn as any) : undefined,
        createdBy: input.createdBy,
      },
    });

    // Clear cache
    cache.delete(`flag:${flag.key}`);

    // Log audit
    await this.logAudit(flag.id, 'created', null, flag, input.createdBy);

    logger.info(`Feature flag created: ${flag.key}`, { flagId: flag.id });

    return flag;
  }

  /**
   * Update a feature flag
   */
  static async updateFlag(key: string, input: UpdateFlagInput) {
    const existing = await this.getFlag(key);

    if (!existing) {
      throw new Error(`Feature flag not found: ${key}`);
    }

    const updated = await prisma.featureFlag.update({
      where: { key },
      data: {
        name: input.name,
        description: input.description,
        enabled: input.enabled,
        rolloutPercentage: input.rolloutPercentage,
        enabledFrom: input.enabledFrom,
        enabledUntil: input.enabledUntil,
        environments: input.environments ? (input.environments as any) : undefined,
        category: input.category,
        tags: input.tags ? (input.tags as any) : undefined,
        dependsOn: input.dependsOn ? (input.dependsOn as any) : undefined,
        updatedBy: input.updatedBy,
      },
    });

    // Clear cache
    cache.delete(`flag:${key}`);

    // Log audit
    await this.logAudit(existing.id, 'updated', existing, updated, input.updatedBy);

    logger.info(`Feature flag updated: ${key}`, { flagId: existing.id });

    return updated;
  }

  /**
   * Delete a feature flag
   */
  static async deleteFlag(key: string, deletedBy?: string) {
    const flag = await this.getFlag(key);

    if (!flag) {
      throw new Error(`Feature flag not found: ${key}`);
    }

    await prisma.featureFlag.delete({
      where: { key },
    });

    // Clear cache
    cache.delete(`flag:${key}`);

    // Log audit
    await this.logAudit(flag.id, 'deleted', flag, null, deletedBy);

    logger.info(`Feature flag deleted: ${key}`, { flagId: flag.id });
  }

  /**
   * Add an override
   */
  static async addOverride(flagKey: string, override: FlagOverride) {
    const flag = await this.getFlag(flagKey);

    if (!flag) {
      throw new Error(`Feature flag not found: ${flagKey}`);
    }

    const created = await prisma.featureFlagOverride.create({
      data: {
        flagId: flag.id,
        scope: override.scope,
        userId: override.userId,
        organizationId: override.organizationId,
        roleId: override.roleId,
        enabled: override.enabled,
        createdBy: override.createdBy,
      },
    });

    // Clear relevant caches
    this.clearOverrideCaches(flag.id, override);

    // Log audit
    await this.logAudit(flag.id, 'override_added', null, created, override.createdBy);

    logger.info(`Feature flag override added: ${flagKey}`, {
      flagId: flag.id,
      overrideId: created.id,
      scope: override.scope,
    });

    return created;
  }

  /**
   * Remove an override
   */
  static async removeOverride(overrideId: string, removedBy?: string) {
    const override = await prisma.featureFlagOverride.findUnique({
      where: { id: overrideId },
      include: { flag: true },
    });

    if (!override) {
      throw new Error('Override not found');
    }

    await prisma.featureFlagOverride.delete({
      where: { id: overrideId },
    });

    // Clear relevant caches
    this.clearOverrideCaches(override.flagId, override);

    // Log audit
    await this.logAudit(override.flagId, 'override_removed', override, null, removedBy);

    logger.info(`Feature flag override removed: ${override.flag.key}`, {
      flagId: override.flagId,
      overrideId,
    });
  }

  /**
   * Get overrides for a flag
   */
  static async getOverrides(flagKey: string) {
    const flag = await this.getFlag(flagKey);

    if (!flag) {
      throw new Error(`Feature flag not found: ${flagKey}`);
    }

    return prisma.featureFlagOverride.findMany({
      where: { flagId: flag.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Batch evaluate multiple flags
   */
  static async evaluateBatch(
    keys: string[],
    context: FlagContext = {}
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      keys.map(async (key) => {
        results[key] = await this.isEnabled(key, context);
      })
    );

    return results;
  }

  /**
   * Get flag statistics
   */
  static async getFlagStats(key: string) {
    const stats = cache.getStats(key);

    if (!stats) {
      return null;
    }

    return {
      key: stats.key,
      totalChecks: stats.totalChecks,
      enabledChecks: stats.enabledChecks,
      disabledChecks: stats.disabledChecks,
      uniqueUsers: stats.uniqueUsers.size,
      lastChecked: stats.lastChecked,
      enabledPercentage: (stats.enabledChecks / stats.totalChecks) * 100,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private static async getUserOverride(flagId: string, userId: string): Promise<boolean | null> {
    const cacheKey = `override:user:${flagId}:${userId}`;
    const cached = cache.get(cacheKey);

    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const override = await prisma.featureFlagOverride.findFirst({
      where: {
        flagId,
        scope: 'USER',
        userId,
      },
    });

    const result = override ? override.enabled : null;
    cache.set(cacheKey, result);

    return result;
  }

  private static async getOrgOverride(
    flagId: string,
    organizationId: string
  ): Promise<boolean | null> {
    const cacheKey = `override:org:${flagId}:${organizationId}`;
    const cached = cache.get(cacheKey);

    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const override = await prisma.featureFlagOverride.findFirst({
      where: {
        flagId,
        scope: 'ORGANIZATION',
        organizationId,
      },
    });

    const result = override ? override.enabled : null;
    cache.set(cacheKey, result);

    return result;
  }

  private static async getRoleOverride(flagId: string, roles: string[]): Promise<boolean | null> {
    // Check cache for all roles
    const cachedRole = roles.find((role) => {
      const cacheKey = `override:role:${flagId}:${role}`;
      const cached = cache.get(cacheKey);
      return cached !== null && cached !== undefined;
    });

    if (cachedRole !== undefined) {
      const cacheKey = `override:role:${flagId}:${cachedRole}`;
      return cache.get(cacheKey);
    }

    // Fetch from database
    const override = await prisma.featureFlagOverride.findFirst({
      where: {
        flagId,
        scope: 'ROLE',
        roleId: { in: roles },
      },
    });

    const result = override ? override.enabled : null;

    // Cache for all checked roles
    roles.forEach((role) => {
      cache.set(`override:role:${flagId}:${role}`, result);
    });

    return result;
  }

  private static isExpired(flag: any): boolean {
    const now = new Date();

    if (flag.enabledFrom && now < flag.enabledFrom) {
      return true; // Not yet active
    }

    if (flag.enabledUntil && now > flag.enabledUntil) {
      return true; // Expired
    }

    return false;
  }

  private static isEnvironmentAllowed(flag: any, environment?: string): boolean {
    if (!flag.environments) {
      return true; // No restrictions
    }

    const environments = Array.isArray(flag.environments)
      ? flag.environments
      : (flag.environments as any).environments || [];

    if (environments.length === 0) {
      return true;
    }

    const currentEnv = environment || process.env.NODE_ENV || 'development';

    return environments.includes(currentEnv);
  }

  private static isInRollout(identifier: string, percentage: number): boolean {
    // Use consistent hashing to determine if user is in rollout
    const hash = crypto.createHash('md5').update(identifier).digest('hex');
    const value = parseInt(hash.substring(0, 8), 16);
    const threshold = (percentage / 100) * 0xffffffff;

    return value <= threshold;
  }

  private static clearOverrideCaches(flagId: string, override: any): void {
    if (override.userId) {
      cache.delete(`override:user:${flagId}:${override.userId}`);
    }

    if (override.organizationId) {
      cache.delete(`override:org:${flagId}:${override.organizationId}`);
    }

    if (override.roleId) {
      cache.delete(`override:role:${flagId}:${override.roleId}`);
    }
  }

  private static logCheck(key: string, enabled: boolean, context: FlagContext): void {
    cache.recordCheck(key, enabled, context.userId);
  }

  private static async logAudit(
    flagId: string,
    action: string,
    previousValue: any,
    newValue: any,
    userId?: string
  ): Promise<void> {
    try {
      await prisma.featureFlagAuditLog.create({
        data: {
          flagId,
          action,
          previousValue: previousValue ? (previousValue as any) : undefined,
          newValue: newValue ? (newValue as any) : undefined,
          userId,
        },
      });
    } catch (error) {
      logger.error('Failed to log feature flag audit', error as Error, { flagId, action });
    }
  }

  /**
   * Clear all caches (useful for testing or forced refresh)
   */
  static clearCache(): void {
    cache.clear();
    logger.info('Feature flag cache cleared');
  }
}
