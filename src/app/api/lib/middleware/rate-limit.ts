// Rate limiting middleware
import { NextRequest, NextResponse } from 'next/server';

import { RedisStore } from './redis-store';
import { MemoryStore } from './rate-limit-store';
import { createErrorResponse } from '../utils/response';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string;
  useRedis?: boolean; // Override to use Redis even if env var not set
}

// ⚡ Use Redis for rate limiting if available (production), fallback to memory (development)
const USE_REDIS = process.env.REDIS_URL && process.env.NODE_ENV === 'production';

const memoryStore = new MemoryStore();

// Cleanup expired entries for memory store every 5 minutes
if (!USE_REDIS) {
  setInterval(
    () => {
      memoryStore.cleanup();
    },
    5 * 60 * 1000
  );
}

/**
 * Default key generator using IP address
 */
function defaultKeyGenerator(request: NextRequest): string {
  const ip =
    request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  return `rate_limit:${ip}`;
}

/**
 * Rate limiting middleware
 * Automatically uses Redis in production for distributed rate limiting
 */
export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator, useRedis } = config;

  // Check if rate limiting is globally disabled
  if (process.env.RATE_LIMIT_ENABLED === 'false') {
    return async (request: NextRequest): Promise<NextResponse | null> => null;
  }

  // Determine which store to use
  const shouldUseRedis = useRedis !== undefined ? useRedis : USE_REDIS;

  return async (request: NextRequest): Promise<NextResponse | null> => {
    const rateLimitKey = keyGenerator(request);

    // Get rate limit entry from appropriate store
    const entry = shouldUseRedis
      ? await RedisStore.increment(rateLimitKey, windowMs)
      : memoryStore.increment(rateLimitKey, windowMs);

    // Add rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', maxRequests.toString());
    headers.set('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count).toString());
    headers.set('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());
    headers.set('X-RateLimit-Store', shouldUseRedis ? 'redis' : 'memory');

    // Check if rate limit exceeded
    if (entry.count > maxRequests) {
      const response = createErrorResponse('RATE_LIMIT_EXCEEDED', {
        retryAfter: Math.ceil((entry.resetTime - Date.now()) / 1000),
      });

      // Add rate limit headers to error response
      headers.forEach((value, headerKey) => {
        response.headers.set(headerKey, value);
      });

      response.headers.set(
        'Retry-After',
        Math.ceil((entry.resetTime - Date.now()) / 1000).toString()
      );

      return response;
    }

    // Return null to continue processing, but include headers in the final response
    return null;
  };
}

/**
 * Predefined rate limit configurations
 */
export const rateLimitConfigs = {
  // Very strict rate limiting for sensitive endpoints
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: process.env.NODE_ENV === 'development' ? 100 : 5, // Relaxed for dev
  },

  // Standard rate limiting for most API endpoints
  standard: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },

  // Lenient rate limiting for public endpoints
  lenient: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000,
  },

  // Per-minute rate limiting for real-time endpoints
  perMinute: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  },

  // Per-second rate limiting for high-frequency endpoints
  perSecond: {
    windowMs: 1000, // 1 second
    maxRequests: 10,
  },

  // Payment-specific rate limiting (more restrictive for financial operations)
  payment: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20, // Limit payment operations to prevent abuse
  },
};

/**
 * User-based rate limiting (requires authentication)
 */
export function userRateLimit(config: RateLimitConfig) {
  return rateLimit({
    ...config,
    keyGenerator: (request: NextRequest) => {
      // Extract user ID from JWT token or session
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          // You would decode the JWT here to get the user ID
          // For now, using a placeholder
          return `user_rate_limit:${token.substring(0, 10)}`;
        } catch {
          // Fall back to IP-based rate limiting
          return defaultKeyGenerator(request);
        }
      }
      return defaultKeyGenerator(request);
    },
  });
}

/**
 * Endpoint-specific rate limiting
 */
export function endpointRateLimit(endpoint: string, config: RateLimitConfig) {
  return rateLimit({
    ...config,
    keyGenerator: (request: NextRequest) => {
      const baseKey = defaultKeyGenerator(request);
      return `${baseKey}:${endpoint}`;
    },
  });
}

// Re-export Redis store from redis-store
export { RedisStore } from './redis-store';
