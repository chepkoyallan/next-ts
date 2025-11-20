/**
 * Connector Cache Manager
 * Provides caching capabilities for connector execution results
 */

import { RedisCacheManager } from './redis-cache-manager';
import { ConnectorCacheManager } from './memory-cache-manager';

export { RedisCacheManager } from './redis-cache-manager';
export { ConnectorCacheManager } from './memory-cache-manager';

// ⚡ Use Redis cache in production, memory-based in development
const USE_REDIS = process.env.REDIS_URL && process.env.NODE_ENV === 'production';

export const cacheManager = USE_REDIS ? new RedisCacheManager() : new ConnectorCacheManager();
