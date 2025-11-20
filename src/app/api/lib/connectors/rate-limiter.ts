/**
 * Connector Rate Limiter
 * Implements rate limiting for connector executions
 */

import { RedisRateLimiter } from './redis-rate-limiter';
import { ConnectorRateLimiter } from './memory-rate-limiter';

export { RedisRateLimiter } from './redis-rate-limiter';
export { ConnectorRateLimiter } from './memory-rate-limiter';

// ⚡ Use Redis rate limiter in production, memory-based in development
const USE_REDIS = process.env.REDIS_URL && process.env.NODE_ENV === 'production';

export const rateLimiter = USE_REDIS ? new RedisRateLimiter() : new ConnectorRateLimiter();
