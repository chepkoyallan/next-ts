// User service for database operations using Prisma
// Updated for Schema v2.0 with modular user model
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

import { logger } from '../utils/logger';
import { prisma } from '../../../../lib/prisma';
import { PaginationParams, PaginatedResponse } from '../types/api';
import {
  standardUserInclude,
  flattenUser,
  createUserWithProfile,
  updateUserProfile,
  enable2FA,
  disable2FA,
  verify2FACode,
  handleFailedLogin,
  resetFailedLogins,
  isAccountLocked,
  updateLastLogin,
  type FlatUser,
} from '../utils/user-helpers';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'moderator';
  roles?: string[];
  permissions: string[];
  passwordHash: string;
  createdAt: string;
  updatedAt?: string;
  // Extended profile fields (flattened from nested models)
  phoneNumber?: string;
  country?: string;
  address?: string;
  state?: string;
  city?: string;
  zipCode?: string;
  about?: string;
  isPublic?: boolean;
  photoURL?: string;
  socialLinks?: string;
  notificationPreferences?: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
}

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
  role?: 'user' | 'admin' | 'moderator';
  profileData?: {
    photoURL?: string;
    phoneNumber?: string;
    country?: string;
    address?: string;
    state?: string;
    city?: string;
    zipCode?: string;
    about?: string;
    isPublic?: boolean;
    bio?: string;
    website?: string;
    company?: string;
    timezone?: string;
  };
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  role?: 'user' | 'admin' | 'moderator';
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
  phoneNumber?: string;
  country?: string;
  address?: string;
  state?: string;
  city?: string;
  zipCode?: string;
  about?: string;
  isPublic?: boolean;
  photoURL?: string;
  bio?: string;
  website?: string;
  company?: string;
  timezone?: string;
  socialLinks?: string; // JSON string for backward compatibility
  notificationPreferences?: string; // JSON string for backward compatibility
  lastLoginAt?: Date;
  lastLoginIp?: string;
}

export class UserService {
  /**
   * Find user by email for authentication
   */
  static async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: {
          email,
          deletedAt: null,
        },
        include: standardUserInclude,
      });

      if (!user) {
        return null;
      }

      // Use helper to flatten nested structure
      return flattenUser(user) as any;
    } catch (error) {
      logger.error('Failed to find user by email', error as Error, { email });
      throw new Error('Failed to find user');
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: {
          id,
          deletedAt: null,
        },
        include: standardUserInclude,
      });

      if (!user) {
        return null;
      }

      // Use helper to flatten nested structure
      return flattenUser(user) as any;
    } catch (error) {
      logger.error('Failed to find user by ID', error as Error, { id });
      throw new Error('Failed to find user');
    }
  }

  /**
   * Create a new user with profile and security setup
   */
  static async create(data: CreateUserData): Promise<User> {
    try {
      // Use helper to create user with nested records
      const newUser = await createUserWithProfile({
        email: data.email,
        name: data.name,
        password: data.password,
        profileData: data.profileData,
        role: data.role,
      });

      // Return flattened user
      return flattenUser(newUser) as any;
    } catch (error) {
      logger.error('Failed to create user', error as Error, { email: data.email });

      if ((error as any).code === 'P2002') {
        throw new Error('User with this email already exists');
      }

      throw new Error('Failed to create user');
    }
  }

  /**
   * Update user core fields and role
   */
  static async update(id: string, data: UpdateUserData): Promise<User> {
    try {
      await prisma.user.update({
        where: { id },
        data: {
          ...(data.email && { email: data.email }),
          ...(data.name && { name: data.name }),
          updatedAt: new Date(),
        },
      });

      // Update role if provided
      if (data.role) {
        // Remove existing roles
        await prisma.userRole.deleteMany({
          where: { userId: id },
        });

        // Add new role
        const role = await prisma.role.findUnique({
          where: { name: data.role },
        });

        if (role) {
          await prisma.userRole.create({
            data: {
              userId: id,
              roleId: role.id,
              assignedBy: 'system',
            },
          });
        }
      }

      return (await UserService.findById(id)) as User;
    } catch (error) {
      logger.error('Failed to update user', error as Error, { id });
      throw new Error('Failed to update user');
    }
  }

  /**
   * Delete user (soft delete)
   */
  static async delete(id: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to delete user', error as Error, { id });
      throw new Error('Failed to delete user');
    }
  }

  /**
   * Get all users with pagination
   */
  static async findAll(
    params: PaginationParams & { search?: string; role?: string }
  ): Promise<PaginatedResponse<Omit<User, 'passwordHash'>>> {
    try {
      const { page = 1, limit = 10, search, role } = params;
      const skip = (page - 1) * limit;

      const where: any = {
        deletedAt: null,
      };

      if (search) {
        where.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (role) {
        where.userRoles = {
          some: {
            role: {
              name: role,
            },
          },
        };
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: standardUserInclude,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      const data = users.map((user: any) => {
        const flattened = flattenUser(user);
        // Remove password hash from response
        const { passwordHash, ...userWithoutPassword } = flattened;
        return userWithoutPassword;
      });

      const totalPages = Math.ceil(total / limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to get users', error as Error);
      throw new Error('Failed to get users');
    }
  }

  /**
   * Verify user password
   */
  static async verifyPassword(email: string, password: string): Promise<boolean> {
    try {
      const user = await UserService.findByEmail(email);
      if (!user) {
        return false;
      }

      return await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      logger.error('Failed to verify password', error as Error, { email });
      return false;
    }
  }

  /**
   * Update user profile with extended fields (uses new nested profile model)
   */
  static async updateProfile(userId: string, data: UpdateProfileData): Promise<User | null> {
    try {
      // Handle basic user fields (name, email, lastLogin)
      const basicUpdateData: any = {};
      if (data.name) basicUpdateData.name = data.name;
      if (data.email) basicUpdateData.email = data.email;
      if (data.lastLoginAt) basicUpdateData.lastLoginAt = data.lastLoginAt;
      if (data.lastLoginIp) basicUpdateData.lastLoginIp = data.lastLoginIp;

      // Update basic fields if any
      if (Object.keys(basicUpdateData).length > 0) {
        await prisma.user.update({
          where: { id: userId, deletedAt: null },
          data: basicUpdateData,
        });
      }

      // Handle profile fields using helper
      const profileData: any = {};
      if (data.phoneNumber !== undefined) profileData.phoneNumber = data.phoneNumber;
      if (data.country !== undefined) profileData.country = data.country;
      if (data.address !== undefined) profileData.address = data.address;
      if (data.state !== undefined) profileData.state = data.state;
      if (data.city !== undefined) profileData.city = data.city;
      if (data.zipCode !== undefined) profileData.zipCode = data.zipCode;
      if (data.about !== undefined) profileData.about = data.about;
      if (data.isPublic !== undefined) profileData.isPublic = data.isPublic;
      if (data.photoURL !== undefined) profileData.photoURL = data.photoURL;
      if (data.bio !== undefined) profileData.bio = data.bio;
      if (data.website !== undefined) profileData.website = data.website;
      if (data.company !== undefined) profileData.company = data.company;
      if (data.timezone !== undefined) profileData.timezone = data.timezone;

      // Update profile if any profile fields
      if (Object.keys(profileData).length > 0) {
        await updateUserProfile(userId, profileData);
      }

      // Return updated user
      return await UserService.findById(userId);
    } catch (error) {
      logger.error('Failed to update user profile', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Enable/disable two-factor authentication
   */
  static async updateTwoFactor(
    userId: string,
    enabled: boolean,
    secret?: string,
    backupCodes?: string[]
  ): Promise<void> {
    try {
      if (enabled && secret && backupCodes) {
        await enable2FA(userId, secret, backupCodes);
        logger.info('2FA enabled successfully', { userId });
      } else if (!enabled) {
        await disable2FA(userId);
        logger.info('2FA disabled successfully', { userId });
      } else {
        throw new Error('Invalid 2FA update parameters');
      }
    } catch (error) {
      logger.error('Failed to update two-factor authentication', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Disable two-factor authentication
   */
  static async disableTwoFactor(userId: string): Promise<void> {
    try {
      await disable2FA(userId);
      logger.info('2FA disabled successfully', { userId });
    } catch (error) {
      logger.error('Failed to disable two-factor authentication', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Store temporary 2FA secret during setup
   */
  static async storeTempTwoFactorSecret(userId: string, secret: string): Promise<void> {
    try {
      // Store in metadata field temporarily
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true },
      });

      const metadata = (user?.metadata as any) || {};
      metadata.tempTwoFactorSecret = secret;
      metadata.tempTwoFactorSecretExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes

      await prisma.user.update({
        where: { id: userId },
        data: { metadata: metadata as any },
      });

      logger.info('Temporary 2FA secret stored', { userId });
    } catch (error) {
      logger.error('Failed to store temporary 2FA secret', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Get temporary 2FA secret during setup verification
   */
  static async getTempTwoFactorSecret(userId: string): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true },
      });

      const metadata = (user?.metadata as any) || {};
      const secret = metadata.tempTwoFactorSecret;
      const expiry = metadata.tempTwoFactorSecretExpiry;

      // Check if secret exists and hasn't expired
      if (!secret || !expiry || Date.now() > expiry) {
        return null;
      }

      return secret;
    } catch (error) {
      logger.error('Failed to get temporary 2FA secret', error as Error, { userId });
      return null;
    }
  }

  /**
   * Clear temporary 2FA secret after successful setup
   */
  static async clearTempTwoFactorSecret(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true },
      });

      const metadata = (user?.metadata as any) || {};
      delete metadata.tempTwoFactorSecret;
      delete metadata.tempTwoFactorSecretExpiry;

      await prisma.user.update({
        where: { id: userId },
        data: { metadata: metadata as any },
      });

      logger.info('Temporary 2FA secret cleared', { userId });
    } catch (error) {
      logger.error('Failed to clear temporary 2FA secret', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Enable 2FA with secret and backup codes
   */
  static async enableTwoFactor(userId: string, secret: string, backupCodes: string[]): Promise<void> {
    try {
      await enable2FA(userId, secret, backupCodes);
      logger.info('2FA enabled successfully', { userId });
    } catch (error) {
      logger.error('Failed to enable 2FA', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Update 2FA backup codes (e.g., after one is used)
   */
  static async updateTwoFactorBackupCodes(userId: string, backupCodes: string[]): Promise<void> {
    try {
      // Get user security record
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { security: true },
      });

      if (!user?.security) {
        throw new Error('User security record not found');
      }

      // Delete old backup codes
      await prisma.twoFactorBackupCode.deleteMany({
        where: { userSecurityId: user.security.id },
      });

      // Create new backup codes
      await prisma.twoFactorBackupCode.createMany({
        data: backupCodes.map((code) => ({
          userSecurityId: user.security!.id,
          code,
        })),
      });

      logger.info('2FA backup codes updated', { userId });
    } catch (error) {
      logger.error('Failed to update 2FA backup codes', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Verify 2FA code (TOTP or backup code)
   */
  static async verify2FACode(userId: string, code: string, speakeasy: any): Promise<{ valid: boolean; usedBackupCode?: boolean }> {
    try {
      return await verify2FACode(userId, code, speakeasy);
    } catch (error) {
      logger.error('Failed to verify 2FA code', error as Error, { userId });
      return { valid: false };
    }
  }

  /**
   * Mark user email as verified
   */
  static async verifyEmail(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: {
          id: userId,
          deletedAt: null,
        },
        data: {
          emailVerified: true,
          updatedAt: new Date(),
        },
      });

      logger.info('Email verified successfully', { userId });
    } catch (error) {
      logger.error('Failed to verify email', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Update user's last login info
   */
  static async updateLastLogin(userId: string, ipAddress?: string): Promise<void> {
    try {
      await updateLastLogin(userId, ipAddress);
      logger.info('Last login updated', { userId });
    } catch (error) {
      logger.error('Failed to update last login', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Handle failed login attempt with account lockout
   */
  static async handleFailedLogin(userId: string): Promise<{ failedAttempts: number; accountLocked: boolean; lockedUntil?: Date }> {
    try {
      const result = await handleFailedLogin(userId);
      logger.warn('Failed login attempt recorded', { userId, ...result });
      return result;
    } catch (error) {
      logger.error('Failed to handle failed login', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Reset failed login attempts after successful login
   */
  static async resetFailedLogins(userId: string): Promise<void> {
    try {
      await resetFailedLogins(userId);
      logger.info('Failed login attempts reset', { userId });
    } catch (error) {
      logger.error('Failed to reset failed login attempts', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Check if account is currently locked
   */
  static async isAccountLocked(userId: string): Promise<boolean> {
    try {
      return await isAccountLocked(userId);
    } catch (error) {
      logger.error('Failed to check account lock status', error as Error, { userId });
      return false;
    }
  }
}
