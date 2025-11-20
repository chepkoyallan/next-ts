// User service for database operations using Prisma
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

import { logger } from '../utils/logger';
import { prisma } from '../../../../lib/prisma';
import { PaginationParams, PaginatedResponse } from '../types/api';

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
  // Extended profile fields
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
  socialLinks?: string; // JSON string
  notificationPreferences?: string; // JSON string
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
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        return null;
      }

      // Extract roles and permissions
      const roles = user.userRoles.map((ur: any) => ur.role.name);
      const permissions = user.userRoles.flatMap((ur: any) =>
        ur.role.rolePermissions.map(
          (rp: any) => `${rp.permission.resource}:${rp.permission.action}`
        )
      );

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: (roles[0] as 'user' | 'admin' | 'moderator') || 'user', // Use first role for backward compatibility
        roles,
        permissions,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
        // Include extended profile fields
        phoneNumber: user.phoneNumber,
        country: user.country,
        address: user.address,
        state: user.state,
        city: user.city,
        zipCode: user.zipCode,
        about: user.about,
        isPublic: user.isPublic,
        photoURL: user.photoURL,
        socialLinks: user.socialLinks,
        notificationPreferences: user.notificationPreferences,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      } as any;
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
        include: {
          userRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        return null;
      }

      // Extract roles and permissions
      const roles = user.userRoles.map((ur: any) => ur.role.name);
      const permissions = user.userRoles.flatMap((ur: any) =>
        ur.role.rolePermissions.map(
          (rp: any) => `${rp.permission.resource}:${rp.permission.action}`
        )
      );

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: (roles[0] as 'user' | 'admin' | 'moderator') || 'user',
        roles,
        permissions,
        passwordHash: user.passwordHash,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
        // Include extended profile fields
        phoneNumber: user.phoneNumber,
        country: user.country,
        address: user.address,
        state: user.state,
        city: user.city,
        zipCode: user.zipCode,
        about: user.about,
        isPublic: user.isPublic,
        photoURL: user.photoURL,
        socialLinks: user.socialLinks,
        notificationPreferences: user.notificationPreferences,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
      } as any;
    } catch (error) {
      logger.error('Failed to find user by ID', error as Error, { id });
      throw new Error('Failed to find user');
    }
  }

  /**
   * Create a new user
   */
  static async create(data: CreateUserData): Promise<User> {
    try {
      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
      const hashedPassword = await bcrypt.hash(data.password, saltRounds);

      // Create user
      const newUser = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: hashedPassword,
          emailVerified: false,
        },
      });

      // Assign default role
      const defaultRoleName = data.role || 'user';
      const defaultRole = await prisma.role.findUnique({
        where: { name: defaultRoleName },
      });

      if (defaultRole) {
        await prisma.userRole.create({
          data: {
            userId: newUser.id,
            roleId: defaultRole.id,
            assignedBy: 'system',
          },
        });
      }

      // Return user with role and permissions
      return (await UserService.findById(newUser.id)) as User;
    } catch (error) {
      logger.error('Failed to create user', error as Error, { email: data.email });

      if ((error as any).code === 'P2002') {
        throw new Error('User with this email already exists');
      }

      throw new Error('Failed to create user');
    }
  }

  /**
   * Update user
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
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      const data = users.map((user: any) => {
        const roles = user.userRoles.map((ur: any) => ur.role.name);
        const permissions = user.userRoles.flatMap((ur: any) =>
          ur.role.rolePermissions.map(
            (rp: any) => `${rp.permission.resource}:${rp.permission.action}`
          )
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (roles[0] as 'user' | 'admin' | 'moderator') || 'user',
          permissions,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt?.toISOString(),
        };
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
   * Update user profile with extended fields
   */
  static async updateProfile(userId: string, data: UpdateProfileData): Promise<User | null> {
    try {
      // Start with basic fields that definitely exist
      const basicUpdateData: any = {
        updatedAt: new Date(),
      };

      // Add basic fields that should exist in any user table
      if (data.name) basicUpdateData.name = data.name;
      if (data.email) basicUpdateData.email = data.email;
      if (data.lastLoginAt) basicUpdateData.lastLoginAt = data.lastLoginAt;
      if (data.lastLoginIp) basicUpdateData.lastLoginIp = data.lastLoginIp;

      // Try to update with basic fields first
      let updatedUser;
      try {
        updatedUser = await prisma.user.update({
          where: {
            id: userId,
            deletedAt: null,
          },
          data: basicUpdateData,
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    rolePermissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        // If basic update succeeded, try to update extended fields
        const extendedUpdateData: any = {};
        let hasExtendedFields = false;

        if (data.phoneNumber !== undefined) {
          extendedUpdateData.phoneNumber = data.phoneNumber;
          hasExtendedFields = true;
        }
        if (data.country !== undefined) {
          extendedUpdateData.country = data.country;
          hasExtendedFields = true;
        }
        if (data.address !== undefined) {
          extendedUpdateData.address = data.address;
          hasExtendedFields = true;
        }
        if (data.state !== undefined) {
          extendedUpdateData.state = data.state;
          hasExtendedFields = true;
        }
        if (data.city !== undefined) {
          extendedUpdateData.city = data.city;
          hasExtendedFields = true;
        }
        if (data.zipCode !== undefined) {
          extendedUpdateData.zipCode = data.zipCode;
          hasExtendedFields = true;
        }
        if (data.about !== undefined) {
          extendedUpdateData.about = data.about;
          hasExtendedFields = true;
        }
        if (data.isPublic !== undefined) {
          extendedUpdateData.isPublic = data.isPublic;
          hasExtendedFields = true;
        }
        if (data.photoURL !== undefined) {
          extendedUpdateData.photoURL = data.photoURL;
          hasExtendedFields = true;
        }
        if (data.socialLinks !== undefined) {
          extendedUpdateData.socialLinks = data.socialLinks;
          hasExtendedFields = true;
        }
        if (data.notificationPreferences !== undefined) {
          extendedUpdateData.notificationPreferences = data.notificationPreferences;
          hasExtendedFields = true;
        }

        // Try to update extended fields if any exist
        if (hasExtendedFields) {
          try {
            updatedUser = await prisma.user.update({
              where: { id: userId },
              data: extendedUpdateData,
              include: {
                userRoles: {
                  include: {
                    role: {
                      include: {
                        rolePermissions: {
                          include: {
                            permission: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            });
          } catch (extendedError) {
            logger.warn('Extended profile fields not available in database schema', {
              error: extendedError,
              userId,
              attemptedFields: Object.keys(extendedUpdateData),
            });
            // Continue with basic update result
          }
        }
      } catch (basicError) {
        logger.error('Failed to update basic user profile fields', basicError as Error, { userId });
        throw basicError;
      }

      if (!updatedUser) {
        return null;
      }

      // Transform to User interface
      const roles = updatedUser.userRoles.map((ur: any) => ur.role.name);
      const permissions = updatedUser.userRoles.flatMap((ur: any) =>
        ur.role.rolePermissions.map(
          (rp: any) => `${rp.permission.resource}:${rp.permission.action}`
        )
      );

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: (roles[0] as 'user' | 'admin' | 'moderator') || 'user',
        roles,
        permissions,
        passwordHash: updatedUser.passwordHash,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
        // Include profile fields
        phoneNumber: updatedUser.phoneNumber,
        country: updatedUser.country,
        address: updatedUser.address,
        state: updatedUser.state,
        city: updatedUser.city,
        zipCode: updatedUser.zipCode,
        about: updatedUser.about,
        isPublic: updatedUser.isPublic,
        photoURL: updatedUser.photoURL,
        socialLinks: updatedUser.socialLinks,
        notificationPreferences: updatedUser.notificationPreferences,
      } as any;
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
      await prisma.user.update({
        where: {
          id: userId,
          deletedAt: null,
        },
        data: {
          twoFactorEnabled: enabled,
          twoFactorSecret: enabled ? secret : null,
          twoFactorBackupCodes:
            enabled && backupCodes ? JSON.stringify(backupCodes) : Prisma.JsonNull,
          updatedAt: new Date(),
        },
      });
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
      await prisma.user.update({
        where: {
          id: userId,
          deletedAt: null,
        },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: Prisma.JsonNull,
          updatedAt: new Date(),
        },
      });
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
  static async enableTwoFactor(userId: string, secret: string, backupCodes: string): Promise<void> {
    try {
      await prisma.user.update({
        where: {
          id: userId,
          deletedAt: null,
        },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: secret,
          twoFactorBackupCodes: backupCodes as any,
          updatedAt: new Date(),
        },
      });

      logger.info('2FA enabled successfully', { userId });
    } catch (error) {
      logger.error('Failed to enable 2FA', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Update 2FA backup codes (e.g., after one is used)
   */
  static async updateTwoFactorBackupCodes(userId: string, backupCodes: string): Promise<void> {
    try {
      await prisma.user.update({
        where: {
          id: userId,
          deletedAt: null,
        },
        data: {
          twoFactorBackupCodes: backupCodes as any,
          updatedAt: new Date(),
        },
      });

      logger.info('2FA backup codes updated', { userId });
    } catch (error) {
      logger.error('Failed to update 2FA backup codes', error as Error, { userId });
      throw error;
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
}
