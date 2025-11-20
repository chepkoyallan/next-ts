/**
 * User Helper Utilities for Schema v2.0
 * Provides helper functions for working with the new modular user schema
 */

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export interface FlatUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: string;
  roles: string[];
  permissions: string[];
  passwordHash: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
  // Flattened profile
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
  // Flattened security
  twoFactorEnabled?: boolean;
  passwordChangedAt?: string;
  failedLoginAttempts?: number;
  accountLockedUntil?: string;
}

/**
 * Standard user include pattern - use this everywhere
 */
export const standardUserInclude = {
  profile: true,
  security: {
    select: {
      id: true,
      twoFactorEnabled: true,
      passwordChangedAt: true,
      failedLoginAttempts: true,
      accountLockedUntil: true,
      lastFailedLoginAttempt: true,
      // Don't include secret in regular queries for security
    },
  },
  socialLinks: true,
  notificationSettings: true,
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
} as const;

/**
 * Flatten nested user model to old flat structure
 * Use this for backward compatibility with existing code
 */
export function flattenUser(user: any): FlatUser {
  const roles = user.userRoles?.map((ur: any) => ur.role.name) || [];
  const permissions =
    user.userRoles?.flatMap((ur: any) =>
      ur.role.rolePermissions.map(
        (rp: any) => `${rp.permission.resource}:${rp.permission.action}`
      )
    ) || [];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: roles[0] || 'user',
    roles,
    permissions,
    passwordHash: user.passwordHash,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt?.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString(),
    lastLoginIp: user.lastLoginIp,
    // Profile fields
    photoURL: user.profile?.photoURL,
    phoneNumber: user.profile?.phoneNumber,
    country: user.profile?.country,
    address: user.profile?.address,
    state: user.profile?.state,
    city: user.profile?.city,
    zipCode: user.profile?.zipCode,
    about: user.profile?.about,
    isPublic: user.profile?.isPublic,
    bio: user.profile?.bio,
    website: user.profile?.website,
    company: user.profile?.company,
    timezone: user.profile?.timezone,
    // Security fields
    twoFactorEnabled: user.security?.twoFactorEnabled || false,
    passwordChangedAt: user.security?.passwordChangedAt?.toISOString(),
    failedLoginAttempts: user.security?.failedLoginAttempts,
    accountLockedUntil: user.security?.accountLockedUntil?.toISOString(),
  };
}

/**
 * Create user with nested profile and security
 */
export async function createUserWithProfile(data: {
  email: string;
  name: string;
  password: string;
  profileData?: Partial<{
    photoURL: string;
    phoneNumber: string;
    country: string;
    address: string;
    state: string;
    city: string;
    zipCode: string;
    about: string;
    isPublic: boolean;
    bio: string;
    website: string;
    company: string;
    location: string;
    timezone: string;
  }>;
  role?: string;
}) {
  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const passwordHash = await bcrypt.hash(data.password, saltRounds);

  // Get role
  const roleName = data.role || 'user';
  const role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    throw new Error(`Role '${roleName}' not found`);
  }

  // Create user with all nested records
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash,
      emailVerified: false,
      profile: data.profileData
        ? {
            create: data.profileData,
          }
        : {
            create: {
              timezone: 'UTC',
            },
          },
      security: {
        create: {},
      },
      notificationSettings: {
        create: {
          emailEnabled: true,
          productUpdates: true,
          securityAlerts: true,
          billingAlerts: true,
          workflowNotifications: true,
          inAppEnabled: true,
        },
      },
      userRoles: {
        create: {
          roleId: role.id,
          assignedBy: 'system',
        },
      },
    },
    include: standardUserInclude,
  });

  return user;
}

/**
 * Update user profile safely
 */
export async function updateUserProfile(
  userId: string,
  profileData: Partial<{
    photoURL: string;
    phoneNumber: string;
    country: string;
    address: string;
    state: string;
    city: string;
    zipCode: string;
    about: string;
    isPublic: boolean;
    bio: string;
    website: string;
    company: string;
    location: string;
    timezone: string;
  }>
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      profile: {
        upsert: {
          create: profileData,
          update: profileData,
        },
      },
    },
    include: {
      profile: true,
    },
  });
}

/**
 * Enable 2FA for user
 */
export async function enable2FA(
  userId: string,
  secret: string,
  backupCodes: string[]
) {
  // Get or create security record
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { security: true },
  });

  if (!user) throw new Error('User not found');

  let securityId = user.security?.id;

  if (!securityId) {
    const security = await prisma.userSecurity.create({
      data: { userId },
    });
    securityId = security.id;
  }

  // Update security and create backup codes in transaction
  await prisma.$transaction([
    prisma.userSecurity.update({
      where: { id: securityId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      },
    }),
    prisma.twoFactorBackupCode.createMany({
      data: backupCodes.map((code) => ({
        userSecurityId: securityId!,
        code,
      })),
    }),
  ]);

  return { success: true };
}

/**
 * Disable 2FA for user
 */
export async function disable2FA(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { security: true },
  });

  if (!user?.security) return { success: true };

  await prisma.$transaction([
    prisma.userSecurity.update({
      where: { id: user.security.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    }),
    prisma.twoFactorBackupCode.deleteMany({
      where: { userSecurityId: user.security.id },
    }),
  ]);

  return { success: true };
}

/**
 * Verify 2FA code (TOTP or backup code)
 */
export async function verify2FACode(
  userId: string,
  code: string,
  speakeasy: any
): Promise<{ valid: boolean; usedBackupCode?: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      security: {
        include: {
          backupCodes: {
            where: { isUsed: false },
          },
        },
      },
    },
  });

  if (!user?.security?.twoFactorEnabled) {
    return { valid: false };
  }

  // Check TOTP first
  const verified = speakeasy.totp.verify({
    secret: user.security.twoFactorSecret!,
    encoding: 'base32',
    token: code,
    window: 2,
  });

  if (verified) {
    return { valid: true };
  }

  // Check backup codes
  const backupCode = user.security.backupCodes.find((bc) => bc.code === code);
  if (backupCode) {
    await prisma.twoFactorBackupCode.update({
      where: { id: backupCode.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });
    return { valid: true, usedBackupCode: true };
  }

  return { valid: false };
}

/**
 * Update user's last login info
 */
export async function updateLastLogin(
  userId: string,
  ipAddress?: string
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    },
  });
}

/**
 * Increment failed login attempts and potentially lock account
 */
export async function handleFailedLogin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { security: true },
  });

  if (!user) return;

  let securityId = user.security?.id;

  if (!securityId) {
    const security = await prisma.userSecurity.create({
      data: { userId },
    });
    securityId = security.id;
  }

  const failedAttempts = (user.security?.failedLoginAttempts || 0) + 1;
  const maxAttempts = parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5');

  const updateData: any = {
    failedLoginAttempts: failedAttempts,
    lastFailedLoginAttempt: new Date(),
  };

  // Lock account after max attempts
  if (failedAttempts >= maxAttempts) {
    const lockoutMinutes = parseInt(process.env.ACCOUNT_LOCKOUT_MINUTES || '15');
    updateData.accountLockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
  }

  await prisma.userSecurity.update({
    where: { id: securityId },
    data: updateData,
  });

  return {
    failedAttempts,
    accountLocked: failedAttempts >= maxAttempts,
    lockedUntil: updateData.accountLockedUntil,
  };
}

/**
 * Reset failed login attempts after successful login
 */
export async function resetFailedLogins(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { security: true },
  });

  if (!user?.security) return;

  await prisma.userSecurity.update({
    where: { id: user.security.id },
    data: {
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastFailedLoginAttempt: null,
    },
  });
}

/**
 * Check if account is currently locked
 */
export async function isAccountLocked(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { security: true },
  });

  if (!user?.security?.accountLockedUntil) return false;

  return user.security.accountLockedUntil > new Date();
}

/**
 * Add social link for user
 */
export async function addSocialLink(
  userId: string,
  platform: string,
  url: string,
  isPublic: boolean = true
) {
  return prisma.userSocialLink.create({
    data: {
      userId,
      platform,
      url,
      isPublic,
    },
  });
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(
  userId: string,
  settings: Partial<{
    emailEnabled: boolean;
    emailDigest: boolean;
    emailDigestFrequency: string;
    productUpdates: boolean;
    securityAlerts: boolean;
    billingAlerts: boolean;
    workflowNotifications: boolean;
    marketplaceUpdates: boolean;
    inAppEnabled: boolean;
    desktopEnabled: boolean;
    mobileEnabled: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    quietHoursTimezone: string;
  }>
) {
  return prisma.userNotificationSettings.upsert({
    where: { userId },
    create: {
      userId,
      ...settings,
    },
    update: settings,
  });
}
