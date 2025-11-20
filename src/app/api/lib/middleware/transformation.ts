/**
 * Request/Response Transformation Middleware
 * Handles data format conversions and response enveloping
 */

import { NextRequest } from 'next/server';

export interface ResponseEnvelope<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId: string;
    version: string;
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
    hasMore: boolean;
  };
}

/**
 * Convert camelCase to snake_case
 */
export function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCase);

  return Object.entries(obj).reduce((result: any, [key, value]) => {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = typeof value === 'object' ? toSnakeCase(value) : value;
    return result;
  }, {});
}

/**
 * Convert snake_case to camelCase
 */
export function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);

  return Object.entries(obj).reduce((result: any, [key, value]) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = typeof value === 'object' ? toCamelCase(value) : value;
    return result;
  }, {});
}

/**
 * Create standardized success response
 */
export function createSuccessEnvelope<T>(
  data: T,
  requestId: string,
  pagination?: ResponseEnvelope['pagination']
): ResponseEnvelope<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      version: 'v1',
    },
    ...(pagination && { pagination }),
  };
}

/**
 * Create standardized error response
 */
export function createErrorEnvelope(
  code: string,
  message: string,
  requestId: string,
  details?: any
): ResponseEnvelope<never> {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId,
      version: 'v1',
    },
  };
}

/**
 * Sanitize response data (remove sensitive fields)
 */
export function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);

  const sensitiveFields = ['password', 'secret', 'token', 'apiKey', 'privateKey'];

  return Object.entries(data).reduce((result: any, [key, value]) => {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = typeof value === 'object' ? sanitizeData(value) : value;
    }
    return result;
  }, {});
}

/**
 * Parse pagination parameters
 */
export function parsePaginationParams(request: NextRequest): {
  page: number;
  pageSize: number;
  offset: number;
} {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

/**
 * Create pagination metadata
 */
export function createPaginationMeta(
  page: number,
  pageSize: number,
  totalCount: number
): ResponseEnvelope['pagination'] {
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    page,
    pageSize,
    totalPages,
    totalCount,
    hasMore: page < totalPages,
  };
}
