/**
 * Session Store Management
 * Tracks active user sessions across devices
 */

import { redisClient } from './client';
import { logger } from '../../app/api/lib/utils/logger';

export interface SessionData {
  sessionId: string;
  userId: string;
  jti: string; // JWT ID
  deviceInfo?: string;
  userAgent?: string;
  ipAddress?: string;
  location?: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
}

export const SessionStore = {
  /**
   * Create a new session
   * @param sessionData - Session information
   * @param expiresIn - Session TTL in seconds
   */
  create: async (sessionData: SessionData, expiresIn: number): Promise<void> => {
    try {
      const key = `session:${sessionData.sessionId}:${sessionData.userId}`;
      const userSessionsKey = `user:sessions:${sessionData.userId}`;

      // Store session data
      await redisClient.setEx(key, expiresIn, JSON.stringify(sessionData));

      // Add to user's session set
      await redisClient.sAdd(userSessionsKey, sessionData.sessionId);
      await redisClient.expire(userSessionsKey, expiresIn);

      logger.info('Session created', {
        sessionId: sessionData.sessionId,
        userId: sessionData.userId,
        expiresIn,
      });
    } catch (error) {
      logger.error('Failed to create session', error as Error, {
        sessionId: sessionData.sessionId,
      });
      throw error;
    }
  },

  /**
   * Get session by ID
   * @param sessionId - Session identifier
   * @param userId - User ID (for composite key)
   * @returns Session data or null if not found
   */
  get: async (sessionId: string, userId: string): Promise<SessionData | null> => {
    try {
      const key = `session:${sessionId}:${userId}`;
      const data = await redisClient.get(key);

      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to get session', error as Error, { sessionId, userId });
      return null;
    }
  },

  /**
   * Update session last activity
   * @param sessionId - Session identifier
   * @param userId - User ID
   */
  updateActivity: async (sessionId: string, userId: string): Promise<void> => {
    try {
      const session = await SessionStore.get(sessionId, userId);
      if (!session) return;

      session.lastActivity = new Date();

      const key = `session:${sessionId}:${userId}`;
      const ttl = await redisClient.ttl(key);

      if (ttl > 0) {
        await redisClient.setEx(key, ttl, JSON.stringify(session));
      }
    } catch (error) {
      logger.error('Failed to update session activity', error as Error, { sessionId, userId });
    }
  },

  /**
   * Delete a specific session
   * @param sessionId - Session identifier
   * @param userId - User ID
   */
  delete: async (sessionId: string, userId: string): Promise<void> => {
    try {
      const key = `session:${sessionId}:${userId}`;
      const userSessionsKey = `user:sessions:${userId}`;

      await redisClient.del(key);
      await redisClient.sRem(userSessionsKey, sessionId);

      logger.info('Session deleted', { sessionId, userId });
    } catch (error) {
      logger.error('Failed to delete session', error as Error, { sessionId, userId });
      throw error;
    }
  },

  /**
   * Get all sessions for a user
   * @param userId - User ID
   * @returns Array of active sessions
   */
  getUserSessions: async (userId: string): Promise<SessionData[]> => {
    try {
      const userSessionsKey = `user:sessions:${userId}`;
      const sessionIds = await redisClient.sMembers(userSessionsKey);

      if (!sessionIds || sessionIds.length === 0) {
        return [];
      }

      const sessionPromises = sessionIds.map((sessionId) => SessionStore.get(sessionId, userId));
      const sessionResults = await Promise.all(sessionPromises);
      const sessions = sessionResults.filter((session): session is SessionData => session !== null);

      return sessions;
    } catch (error) {
      logger.error('Failed to get user sessions', error as Error, { userId });
      return [];
    }
  },

  /**
   * Delete all sessions for a user (except optionally one)
   * @param userId - User ID
   * @param exceptSessionId - Session ID to keep (optional)
   * @returns Number of sessions deleted
   */
  deleteUserSessions: async (userId: string, exceptSessionId?: string): Promise<number> => {
    try {
      const sessions = await SessionStore.getUserSessions(userId);

      const deletePromises = sessions
        .filter((session) => !exceptSessionId || session.sessionId !== exceptSessionId)
        .map((session) => SessionStore.delete(session.sessionId, userId));

      await Promise.all(deletePromises);
      const deletedCount = deletePromises.length;

      logger.info('User sessions deleted', { userId, deletedCount, exceptSessionId });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete user sessions', error as Error, { userId });
      throw error;
    }
  },

  /**
   * Check if session exists
   * @param sessionId - Session identifier
   * @param userId - User ID
   * @returns true if session exists, false otherwise
   */
  exists: async (sessionId: string, userId: string): Promise<boolean> => {
    try {
      const key = `session:${sessionId}:${userId}`;
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Failed to check session existence', error as Error, { sessionId, userId });
      return false;
    }
  },

  /**
   * Get session count for user
   * @param userId - User ID
   * @returns Number of active sessions
   */
  getSessionCount: async (userId: string): Promise<number> => {
    try {
      const userSessionsKey = `user:sessions:${userId}`;
      return await redisClient.sCard(userSessionsKey);
    } catch (error) {
      logger.error('Failed to get session count', error as Error, { userId });
      return 0;
    }
  },
};
