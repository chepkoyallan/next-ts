/**
 * Temporary Storage Service
 * Redis-based temporary data storage for OAuth states, tokens, codes, etc.
 */

import { randomBytes } from 'crypto';

import { redisClient, connectRedis } from '@app/cache/client';

import { logger } from '../utils/logger';

export class TempStorageService {
  private isConnected = false;

  constructor() {
    this.ensureConnection();
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await connectRedis();
        this.isConnected = true;
        logger.info('Temp Storage Service initialized');
      } catch (error) {
        logger.error('Failed to connect Redis for temp storage', error as Error);
      }
    }
  }

  /**
   * Generate random token
   */
  private static generateToken(bytes: number = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  /**
   * Store temporary data
   */
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    await this.ensureConnection();

    try {
      const serialized = JSON.stringify(data);
      await redisClient.setEx(key, ttl, serialized);

      logger.debug('Temp data stored', { key, ttl });
    } catch (error) {
      logger.error('Temp storage set error', error, { key });
      throw error;
    }
  }

  /**
   * Get and optionally delete temporary data
   */
  async get<T>(key: string, deleteAfter: boolean = false): Promise<T | null> {
    await this.ensureConnection();

    try {
      const data = await redisClient.get(key);

      if (!data) {
        logger.debug('Temp data not found', { key });
        return null;
      }

      if (deleteAfter) {
        await redisClient.del(key);
        logger.debug('Temp data retrieved and deleted', { key });
      } else {
        logger.debug('Temp data retrieved', { key });
      }

      return JSON.parse(data) as T;
    } catch (error) {
      logger.error('Temp storage get error', error, { key });
      return null;
    }
  }

  /**
   * Delete temporary data
   */
  async delete(key: string): Promise<void> {
    await this.ensureConnection();

    try {
      await redisClient.del(key);
      logger.debug('Temp data deleted', { key });
    } catch (error) {
      logger.error('Temp storage delete error', error, { key });
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    await this.ensureConnection();

    try {
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Temp storage exists error', error, { key });
      return false;
    }
  }

  /**
   * Get remaining TTL
   */
  async ttl(key: string): Promise<number> {
    await this.ensureConnection();

    try {
      return await redisClient.ttl(key);
    } catch (error) {
      logger.error('Temp storage TTL error', error, { key });
      return -1;
    }
  }
}

// Export singleton
export const tempStorage = new TempStorageService();

/**
 * OAuth State Management
 */
export const OAuth = {
  /**
   * Create OAuth state token
   */
  async createState(data: {
    provider: string;
    redirectUri: string;
    userId?: string;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const state = randomBytes(32).toString('hex');
    const key = `oauth:state:${state}`;

    await tempStorage.set(
      key,
      {
        ...data,
        createdAt: new Date().toISOString(),
      },
      600 // 10 minutes
    );

    logger.info('OAuth state created', { state, provider: data.provider });

    return state;
  },

  /**
   * Verify and consume OAuth state
   */
  async verifyState(state: string): Promise<any> {
    const key = `oauth:state:${state}`;
    const data = await tempStorage.get(key, true); // Delete after reading

    if (!data) {
      logger.warn('Invalid OAuth state', { state });
      throw new Error('Invalid or expired OAuth state');
    }

    logger.info('OAuth state verified', { state });

    return data;
  },
};

/**
 * Password Reset Tokens
 */
export const PasswordReset = {
  /**
   * Create password reset token
   */
  async createToken(userId: string, email: string): Promise<string> {
    const token = randomBytes(32).toString('hex');
    const key = `password-reset:${token}`;

    await tempStorage.set(
      key,
      {
        userId,
        email,
        createdAt: new Date().toISOString(),
      },
      3600 // 1 hour
    );

    logger.info('Password reset token created', { userId, email });

    return token;
  },

  /**
   * Verify and consume password reset token
   */
  async verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
    const key = `password-reset:${token}`;
    const data = await tempStorage.get<{
      userId: string;
      email: string;
    }>(key, true);

    if (!data) {
      logger.warn('Invalid password reset token', { token });
      return null;
    }

    logger.info('Password reset token verified', { userId: data.userId });

    return data;
  },
};

/**
 * Email Verification Codes
 */
export const EmailVerification = {
  /**
   * Create email verification code
   */
  async createCode(userId: string, email: string): Promise<string> {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `email-verify:${userId}`;

    await tempStorage.set(
      key,
      {
        code,
        email,
        createdAt: new Date().toISOString(),
      },
      600 // 10 minutes
    );

    logger.info('Email verification code created', { userId, email });

    return code;
  },

  /**
   * Verify email code
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const key = `email-verify:${userId}`;
    const data = await tempStorage.get<{ code: string; email: string }>(key);

    if (!data || data.code !== code) {
      logger.warn('Invalid email verification code', { userId, code });
      return false;
    }

    // Delete after verification
    await tempStorage.delete(key);

    logger.info('Email verification code verified', { userId });

    return true;
  },
};

/**
 * 2FA Temporary Codes
 */
export const TwoFactorAuth = {
  /**
   * Store temporary 2FA session
   */
  async createSession(userId: string, metadata: Record<string, any>): Promise<string> {
    const sessionId = randomBytes(32).toString('hex');
    const key = `2fa:session:${sessionId}`;

    await tempStorage.set(
      key,
      {
        userId,
        metadata,
        createdAt: new Date().toISOString(),
      },
      300 // 5 minutes
    );

    logger.info('2FA session created', { userId, sessionId });

    return sessionId;
  },

  /**
   * Verify and consume 2FA session
   */
  async verifySession(
    sessionId: string
  ): Promise<{ userId: string; metadata: Record<string, any> } | null> {
    const key = `2fa:session:${sessionId}`;
    const data = await tempStorage.get<{
      userId: string;
      metadata: Record<string, any>;
    }>(key, true);

    if (!data) {
      logger.warn('Invalid 2FA session', { sessionId });
      return null;
    }

    logger.info('2FA session verified', { userId: data.userId });

    return data;
  },

  /**
   * Store backup code usage
   */
  async markBackupCodeUsed(userId: string, code: string): Promise<void> {
    const key = `2fa:backup-used:${userId}:${code}`;

    await tempStorage.set(key, { usedAt: new Date().toISOString() }, 86400 * 90); // 90 days

    logger.info('2FA backup code marked as used', { userId });
  },

  /**
   * Check if backup code was used
   */
  async isBackupCodeUsed(userId: string, code: string): Promise<boolean> {
    const key = `2fa:backup-used:${userId}:${code}`;
    return tempStorage.exists(key);
  },
};

/**
 * API Key Validation Cache
 */
export const ApiKeyCache = {
  /**
   * Cache API key validation result
   */
  async cacheValidation(apiKey: string, result: any): Promise<void> {
    const key = `api-key:${apiKey}`;
    await tempStorage.set(key, result, 300); // 5 minutes
  },

  /**
   * Get cached validation result
   */
  async getValidation(apiKey: string): Promise<any> {
    const key = `api-key:${apiKey}`;
    return tempStorage.get(key);
  },

  /**
   * Invalidate API key cache
   */
  async invalidate(apiKey: string): Promise<void> {
    const key = `api-key:${apiKey}`;
    await tempStorage.delete(key);
  },
};
