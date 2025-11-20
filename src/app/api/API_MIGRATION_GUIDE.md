# 🔄 API Migration Guide - Schema v2.0

## Overview

This guide provides **complete, copy-paste ready code** for migrating your API from the old User schema to the new modular schema with UserProfile, UserSecurity, and UserSession models.

---

## 🎯 Quick Reference

### Field Migration Map

| Old Location | New Location | Notes |
|--------------|--------------|-------|
| `user.photoURL` | `user.profile.photoURL` | Now in UserProfile |
| `user.phoneNumber` | `user.profile.phoneNumber` | Now in UserProfile |
| `user.country` | `user.profile.country` | Now in UserProfile |
| `user.address` | `user.profile.address` | Now in UserProfile |
| `user.about` | `user.profile.about` | Now in UserProfile |
| `user.socialLinks` | `user.socialLinks[]` | Now normalized table |
| `user.notificationPreferences` | `user.notificationSettings` | Now separate model |
| `user.twoFactorEnabled` | `user.security.twoFactorEnabled` | Now in UserSecurity |
| `user.twoFactorSecret` | `user.security.twoFactorSecret` | Now in UserSecurity |
| `user.twoFactorBackupCodes` | `user.security.backupCodes[]` | Now normalized table |

---

## 📋 Standard User Include Pattern

Use this everywhere you query users:

```typescript
const standardUserInclude = {
  profile: true,
  security: {
    select: {
      twoFactorEnabled: true,
      passwordChangedAt: true,
      failedLoginAttempts: true,
      accountLockedUntil: true,
      // Don't include secret in regular queries
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
};

// Usage
const user = await prisma.user.findUnique({
  where: { email },
  include: standardUserInclude,
});
```

---

## 🔧 Helper Functions

### 1. User Flattener (Backward Compatibility)

```typescript
// src/app/api/lib/utils/user-helpers.ts

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
  // Flattened security
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
}

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
    // Security fields
    twoFactorEnabled: user.security?.twoFactorEnabled || false,
  };
}

/**
 * Create user with nested profile and security
 */
export async function createUserWithProfile(data: {
  email: string;
  name: string;
  passwordHash: string;
  profileData?: Partial<{
    photoURL: string;
    phoneNumber: string;
    country: string;
    timezone: string;
  }>;
}) {
  return prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      emailVerified: false,
      profile: data.profileData
        ? {
            create: data.profileData,
          }
        : undefined,
      security: {
        create: {},
      },
      notificationSettings: {
        create: {
          emailEnabled: true,
          productUpdates: true,
          securityAlerts: true,
          billingAlerts: true,
        },
      },
    },
    include: {
      profile: true,
      security: true,
      notificationSettings: true,
    },
  });
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

  // Update security and create backup codes
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
}

/**
 * Disable 2FA for user
 */
export async function disable2FA(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { security: true },
  });

  if (!user?.security) return;

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
}

/**
 * Verify 2FA code
 */
export async function verify2FACode(
  userId: string,
  code: string,
  speakeasy: any
): Promise<boolean> {
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
    return false;
  }

  // Check TOTP
  const verified = speakeasy.totp.verify({
    secret: user.security.twoFactorSecret!,
    encoding: 'base32',
    token: code,
    window: 2,
  });

  if (verified) return true;

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
    return true;
  }

  return false;
}
```

---

## 🔐 Session Management Updates

### Option 1: Hybrid (Recommended)

Keep Redis for speed, add DB for persistence and audit:

```typescript
// src/app/api/lib/services/session-service.ts

import { prisma } from '@/lib/prisma';
import { sessionStore } from '@/lib/redis/session-store';

export interface SessionData {
  sessionId: string;
  userId: string;
  token: string;
  refreshToken?: string;
  ipAddress: string;
  userAgent: string;
  deviceInfo?: any;
  expiresAt: Date;
}

export class SessionService {
  /**
   * Create session in both DB and Redis
   */
  static async createSession(data: SessionData) {
    // Create in database
    const dbSession = await prisma.userSession.create({
      data: {
        userId: data.userId,
        token: data.token,
        refreshToken: data.refreshToken,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        deviceInfo: data.deviceInfo,
        expiresAt: data.expiresAt,
        isActive: true,
      },
    });

    // Create in Redis (for fast lookups)
    await sessionStore.createSession({
      sessionId: dbSession.id,
      userId: data.userId,
      jti: data.token, // Use token as JTI
      deviceInfo: data.deviceInfo,
      userAgent: data.userAgent,
      ipAddress: data.ipAddress,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      expiresAt: data.expiresAt.toISOString(),
    });

    return dbSession;
  }

  /**
   * Validate session from Redis (fast) with DB fallback
   */
  static async validateSession(token: string): Promise<boolean> {
    // Try Redis first
    const redisSession = await sessionStore.getSessionByJti(token);
    if (redisSession) {
      // Update last activity
      await this.updateSessionActivity(token);
      return true;
    }

    // Fallback to database
    const dbSession = await prisma.userSession.findUnique({
      where: { token },
    });

    if (!dbSession || !dbSession.isActive) {
      return false;
    }

    if (dbSession.expiresAt < new Date()) {
      await this.revokeSession(token, 'expired');
      return false;
    }

    return true;
  }

  /**
   * Update session activity
   */
  static async updateSessionActivity(token: string) {
    await Promise.all([
      // Update Redis
      sessionStore.updateSessionActivity(token),
      // Update database (async, don't await)
      prisma.userSession
        .update({
          where: { token },
          data: { lastActivityAt: new Date() },
        })
        .catch(() => {}), // Ignore errors
    ]);
  }

  /**
   * Revoke a session
   */
  static async revokeSession(token: string, reason: string) {
    await Promise.all([
      // Revoke in database
      prisma.userSession.updateMany({
        where: { token },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: reason,
        },
      }),
      // Remove from Redis
      sessionStore.revokeSession(token),
    ]);
  }

  /**
   * Revoke all user sessions except current
   */
  static async revokeAllUserSessions(
    userId: string,
    exceptToken?: string
  ) {
    const sessions = await prisma.userSession.findMany({
      where: {
        userId,
        isActive: true,
        token: exceptToken ? { not: exceptToken } : undefined,
      },
    });

    await Promise.all([
      // Revoke in database
      prisma.userSession.updateMany({
        where: {
          userId,
          isActive: true,
          token: exceptToken ? { not: exceptToken } : undefined,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: 'User revoked all sessions',
        },
      }),
      // Remove from Redis
      ...sessions.map((s) => sessionStore.revokeSession(s.token)),
    ]);
  }

  /**
   * Get all active user sessions
   */
  static async getUserSessions(userId: string) {
    return prisma.userSession.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gte: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  /**
   * Clean up expired sessions (run periodically)
   */
  static async cleanupExpiredSessions() {
    const expiredSessions = await prisma.userSession.findMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isActive: false },
        ],
      },
      select: { token: true },
    });

    await Promise.all([
      // Mark as inactive in DB
      prisma.userSession.updateMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isActive: false },
          ],
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: 'expired',
        },
      }),
      // Remove from Redis
      ...expiredSessions.map((s) => sessionStore.revokeSession(s.token)),
    ]);
  }
}
```

---

## 📝 File-by-File Migration Instructions

### 1. `/src/app/api/lib/services/user-service-prisma.ts`

**Key Changes**:
- Add `standardUserInclude` pattern
- Update `findByEmail()` and `findById()` to include profile/security
- Update `create()` to create nested records
- Update `updateProfile()` to upsert profile
- Add 2FA helper methods

**Search & Replace**:
```typescript
// Find all instances of:
user.photoURL → user.profile?.photoURL
user.twoFactorEnabled → user.security?.twoFactorEnabled
user.twoFactorSecret → user.security?.twoFactorSecret

// In includes, replace:
include: { userRoles: ... }

// With:
include: {
  profile: true,
  security: { select: { twoFactorEnabled: true } },
  userRoles: ...
}
```

---

### 2. `/src/app/api/v1/auth/login/route.ts`

**Line 132** - Check 2FA:
```typescript
// ❌ OLD
if (user.twoFactorEnabled) {
  return NextResponse.json({
    requiresTwoFactor: true,
    tempToken,
  });
}

// ✅ NEW
if (user.security?.twoFactorEnabled) {
  return NextResponse.json({
    requiresTwoFactor: true,
    tempToken,
  });
}
```

**Lines 168-220** - Create session:
```typescript
// ❌ OLD: Redis only
await sessionStore.createSession({
  sessionId,
  userId: user.id,
  ...
});

// ✅ NEW: Use SessionService
await SessionService.createSession({
  sessionId,
  userId: user.id,
  token: accessToken,
  refreshToken,
  ipAddress: req.ip,
  userAgent: req.headers.get('user-agent'),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
});
```

---

### 3. `/src/app/api/v1/auth/register/route.ts`

**Lines 70-95** - User creation:
```typescript
// ❌ OLD
const user = await UserService.create({
  email,
  name,
  password,
});

// ✅ NEW
const user = await createUserWithProfile({
  email,
  name,
  passwordHash: await bcrypt.hash(password, 12),
  profileData: {
    timezone: 'UTC',
  },
});
```

---

### 4. OAuth Callbacks

**GitHub** `/src/app/api/v1/auth/github/callback/route.ts`:
```typescript
// Lines 165-177
// ❌ OLD
const user = await prisma.user.upsert({
  where: { email: profile.email },
  update: { photoURL: profile.avatar_url },
  create: {
    email: profile.email,
    name: profile.name,
    photoURL: profile.avatar_url,
    passwordHash: '', // OAuth users
  },
});

// ✅ NEW
const user = await prisma.user.upsert({
  where: { email: profile.email },
  update: {
    profile: {
      upsert: {
        create: { photoURL: profile.avatar_url },
        update: { photoURL: profile.avatar_url },
      },
    },
  },
  create: {
    email: profile.email,
    name: profile.name,
    passwordHash: '', // OAuth users
    profile: {
      create: { photoURL: profile.avatar_url },
    },
    security: {
      create: {},
    },
  },
  include: {
    profile: true,
    security: true,
    userRoles: {
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    },
  },
});
```

**Google** `/src/app/api/v1/auth/google/callback/route.ts`:
Same pattern as GitHub - replace lines 125-137.

---

### 5. 2FA Endpoints

**Setup** `/src/app/api/v1/auth/2fa/setup/route.ts`:
```typescript
// Line 60
// ❌ OLD
if (user.twoFactorEnabled) {
  return NextResponse.json({ error: 'already_enabled' }, { status: 400 });
}

// ✅ NEW
const userWithSecurity = await prisma.user.findUnique({
  where: { id: user.id },
  include: { security: true },
});

if (userWithSecurity?.security?.twoFactorEnabled) {
  return NextResponse.json({ error: 'already_enabled' }, { status: 400 });
}

// Generate secret and backup codes...
await enable2FA(user.id, secret, backupCodes);
```

**Disable** `/src/app/api/v1/auth/2fa/disable/route.ts`:
```typescript
// Lines 70-91
// ❌ OLD
await prisma.user.update({
  where: { id: user.id },
  data: {
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: null,
  },
});

// ✅ NEW
await disable2FA(user.id);
```

**Verify** `/src/app/api/v1/auth/2fa/verify/route.ts`:
```typescript
// Use the verify2FACode helper
const isValid = await verify2FACode(user.id, code, speakeasy);
```

---

### 6. Avatar Upload `/src/app/api/v1/users/avatar/route.ts`

**Line 56**:
```typescript
// ❌ OLD
await UserService.updateProfile(userId, {
  photoURL: avatarUrl,
});

// ✅ NEW
await updateUserProfile(userId, {
  photoURL: avatarUrl,
});
```

---

### 7. Session Management `/src/app/api/v1/auth/sessions/route.ts`

**GET** - List sessions:
```typescript
// Lines 31-98
// ❌ OLD: Redis only
const sessions = await sessionStore.getUserSessions(user.id);

// ✅ NEW: Database
const sessions = await SessionService.getUserSessions(user.id);
```

**DELETE** - Revoke sessions:
```typescript
// Lines 199-218
// ❌ OLD
await sessionStore.revokeUserSessions(user.id, [currentSessionId]);

// ✅ NEW
await SessionService.revokeAllUserSessions(user.id, currentToken);
```

---

### 8. Admin User Queries

**`/src/app/api/v1/admin/users/route.ts`**:
```typescript
// Line 102
// Add to select
select: {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  profile: {
    select: {
      photoURL: true,
    },
  },
  security: {
    select: {
      twoFactorEnabled: true,
    },
  },
}
```

---

### 9. Organization Member Service

**`/src/app/api/lib/services/organization-member-service.ts`**:
```typescript
// Lines 50, 73
// Update user includes
user: {
  select: {
    id: true,
    email: true,
    name: true,
    profile: {
      select: {
        photoURL: true,
      },
    },
  },
}
```

---

## ✅ Testing Checklist

After migration, test these flows:

### Authentication
- [ ] User registration with email/password
- [ ] User login with email/password
- [ ] Login with invalid credentials (account lockout)
- [ ] OAuth login (GitHub)
- [ ] OAuth login (Google)
- [ ] Password reset flow
- [ ] Email verification

### 2FA
- [ ] Enable 2FA
- [ ] Login with 2FA (TOTP)
- [ ] Login with 2FA (backup code)
- [ ] Disable 2FA
- [ ] 2FA setup cancellation

### Sessions
- [ ] List active sessions
- [ ] Revoke single session
- [ ] Revoke all sessions
- [ ] Session expiration
- [ ] Concurrent sessions

### Profile
- [ ] Upload avatar
- [ ] Update profile info
- [ ] Update notification settings
- [ ] View own profile

### Admin
- [ ] List users
- [ ] View user details
- [ ] Update user
- [ ] Delete user

---

## 🚀 Deployment Steps

1. **Run Database Migration**:
```bash
pnpm db:generate
# Review the migration SQL carefully
pnpm db:migrate -- api_schema_v2
```

2. **Deploy Helper Functions**:
- Copy `user-helpers.ts` to `/src/app/api/lib/utils/`
- Copy `session-service.ts` to `/src/app/api/lib/services/`

3. **Update Files One-by-One**:
- Start with user-service-prisma.ts
- Then authentication endpoints
- Then OAuth callbacks
- Then 2FA endpoints
- Finally admin/profile endpoints

4. **Test Thoroughly**:
- Run the testing checklist above
- Test in development first
- Use staging environment
- Monitor error logs

5. **Rollback Plan**:
- Keep old schema.prisma.backup
- Keep old user-service-prisma.ts.backup
- Database migration can be rolled back with `prisma migrate reset`

---

## 📞 Support

If you encounter issues:
1. Check the field migration map above
2. Ensure all includes have profile/security
3. Use flattenUser() for backward compatibility
4. Check Prisma logs for query errors

---

*Last Updated: 2025-11-20*
*Schema Version: 2.0.0*
