/**
 * HTTP Caching Middleware
 * Implements ETag, Cache-Control, and Last-Modified headers
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export interface CacheOptions {
  maxAge?: number; // seconds
  sMaxAge?: number; // seconds for shared caches
  staleWhileRevalidate?: number; // seconds
  staleIfError?: number; // seconds
  mustRevalidate?: boolean;
  noCache?: boolean;
  noStore?: boolean;
  private?: boolean;
  public?: boolean;
}

/**
 * Generate ETag from response body
 */
export function generateETag(body: string | Buffer): string {
  const hash = crypto.createHash('md5').update(body).digest('hex');
  return `"${hash}"`;
}

/**
 * Check if request has matching ETag
 */
export function checkETag(request: NextRequest, etag: string): boolean {
  const ifNoneMatch = request.headers.get('if-none-match');
  return ifNoneMatch === etag;
}

/**
 * Check if resource is modified since given date
 */
export function checkLastModified(request: NextRequest, lastModified: Date): boolean {
  const ifModifiedSince = request.headers.get('if-modified-since');
  if (!ifModifiedSince) return true;

  const ifModifiedSinceDate = new Date(ifModifiedSince);
  return lastModified > ifModifiedSinceDate;
}

/**
 * Build Cache-Control header value
 */
export function buildCacheControl(options: CacheOptions): string {
  const directives: string[] = [];

  if (options.noStore) {
    directives.push('no-store');
    return directives.join(', ');
  }

  if (options.noCache) {
    directives.push('no-cache');
  }

  if (options.private) {
    directives.push('private');
  } else if (options.public) {
    directives.push('public');
  }

  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }

  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.staleIfError !== undefined) {
    directives.push(`stale-if-error=${options.staleIfError}`);
  }

  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  return directives.join(', ');
}

/**
 * Add cache headers to response
 */
export function addCacheHeaders(
  response: NextResponse,
  options: CacheOptions,
  etag?: string,
  lastModified?: Date
): NextResponse {
  const cacheControl = buildCacheControl(options);
  if (cacheControl) {
    response.headers.set('Cache-Control', cacheControl);
  }

  if (etag) {
    response.headers.set('ETag', etag);
  }

  if (lastModified) {
    response.headers.set('Last-Modified', lastModified.toUTCString());
  }

  // Add Vary header for content negotiation
  response.headers.set('Vary', 'Accept-Encoding, Authorization');

  return response;
}

/**
 * Create 304 Not Modified response
 */
export function createNotModifiedResponse(etag?: string): NextResponse {
  const response = new NextResponse(null, { status: 304 });

  if (etag) {
    response.headers.set('ETag', etag);
  }

  return response;
}

/**
 * Cache middleware wrapper
 */
export function withCache(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: CacheOptions
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Skip caching for non-GET requests
    if (request.method !== 'GET') {
      return handler(request);
    }

    // Execute handler
    const response = await handler(request);

    // Don't cache error responses
    if (response.status >= 400) {
      return response;
    }

    // Generate ETag if response has body
    const body = await response.clone().text();
    const etag = body ? generateETag(body) : undefined;

    // Check if client has valid cache
    if (etag && checkETag(request, etag)) {
      return createNotModifiedResponse(etag);
    }

    // Add cache headers
    return addCacheHeaders(response, options, etag);
  };
}

/**
 * Predefined cache strategies
 */
export const CacheStrategies = {
  // No caching
  noCache: (): CacheOptions => ({
    noStore: true,
  }),

  // Cache for 5 minutes
  short: (): CacheOptions => ({
    public: true,
    maxAge: 300,
    staleWhileRevalidate: 60,
  }),

  // Cache for 1 hour
  medium: (): CacheOptions => ({
    public: true,
    maxAge: 3600,
    staleWhileRevalidate: 300,
  }),

  // Cache for 1 day
  long: (): CacheOptions => ({
    public: true,
    maxAge: 86400,
    staleWhileRevalidate: 3600,
  }),

  // Cache immutable resources (e.g., versioned assets)
  immutable: (): CacheOptions => ({
    public: true,
    maxAge: 31536000, // 1 year
  }),

  // Private cache (user-specific data)
  private: (maxAge: number = 300): CacheOptions => ({
    private: true,
    maxAge,
    mustRevalidate: true,
  }),

  // CDN cache with origin fallback
  cdn: (maxAge: number = 3600, sMaxAge: number = 86400): CacheOptions => ({
    public: true,
    maxAge,
    sMaxAge,
    staleWhileRevalidate: maxAge,
    staleIfError: sMaxAge,
  }),
};

/**
 * In-memory cache for development
 */
const memoryCache = new Map<string, { data: any; expiry: number; etag: string }>();

/**
 * Get from memory cache
 */
export function getFromMemoryCache(key: string): any | null {
  const cached = memoryCache.get(key);
  if (!cached) return null;

  if (Date.now() > cached.expiry) {
    memoryCache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Set to memory cache
 */
export function setToMemoryCache(key: string, data: any, ttl: number): void {
  const etag = generateETag(JSON.stringify(data));
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttl * 1000,
    etag,
  });
}

/**
 * Clear memory cache
 */
export function clearMemoryCache(pattern?: RegExp): void {
  if (!pattern) {
    memoryCache.clear();
    return;
  }

  // Use array iteration instead of for...of
  Array.from(memoryCache.keys()).forEach((key) => {
    if (pattern.test(key)) {
      memoryCache.delete(key);
    }
  });
}

/**
 * Get cache statistics
 */
export function getCacheStatistics(): {
  size: number;
  keys: string[];
} {
  return {
    size: memoryCache.size,
    keys: Array.from(memoryCache.keys()),
  };
}
