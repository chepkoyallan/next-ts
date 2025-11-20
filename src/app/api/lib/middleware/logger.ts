// Logging middleware for API requests
import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';

import { logger } from '../utils/logger';
import { RequestContext } from '../types/api';

export interface LogEntry {
  requestId: string;
  timestamp: string;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  statusCode?: number;
  responseTime?: number;
  error?: any;
  requestBody?: any;
  responseBody?: any;
}

/**
 * Create request context with logging information
 */
export function createRequestContext(request: NextRequest): RequestContext {
  const requestId = nanoid();
  const timestamp = new Date().toISOString();

  // Extract client IP
  const ip =
    request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  const userAgent = request.headers.get('user-agent') || undefined;

  return {
    requestId,
    timestamp,
    userAgent,
    ip,
  };
}

/**
 * Log API request
 */
export function logRequest(
  request: NextRequest,
  context: RequestContext,
  additionalData?: Record<string, any>
): void {
  const logEntry: Partial<LogEntry> = {
    requestId: context.requestId,
    timestamp: context.timestamp,
    method: request.method,
    url: request.url,
    userAgent: context.userAgent,
    ip: context.ip,
    userId: context.userId,
    ...additionalData,
  };

  // Use structured logging
  logger.info('API Request', logEntry);
}

/**
 * Log API response
 */
export function logResponse(
  context: RequestContext,
  response: NextResponse,
  startTime: number,
  additionalData?: Record<string, any>
): void {
  const responseTime = Date.now() - startTime;

  const logEntry: Partial<LogEntry> = {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
    statusCode: response.status,
    responseTime,
    ...additionalData,
  };

  // Use structured logging with request method for better context
  logger.request(
    context.requestId.split('-')[0] || 'UNKNOWN',
    response.url || 'unknown',
    response.status,
    responseTime,
    logEntry
  );
}

/**
 * Log API error
 */
export function logError(
  context: RequestContext,
  error: any,
  additionalData?: Record<string, any>
): void {
  const logEntry: Partial<LogEntry> = {
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    ...additionalData,
  };

  // Use structured error logging
  logger.error('API Error', error, logEntry);
}

/**
 * Middleware wrapper that adds logging to API routes
 */
export function withLogging<T extends any[]>(handler: (...args: T) => Promise<NextResponse>) {
  return async (...args: T): Promise<NextResponse> => {
    const request = args[0] as NextRequest;
    const context = createRequestContext(request);
    const startTime = Date.now();

    try {
      // Log incoming request
      logRequest(request, context);

      // Execute the handler
      const response = await handler(...args);

      // Log successful response
      logResponse(context, response, startTime);

      return response;
    } catch (error) {
      // Log error
      logError(context, error);

      // Re-throw the error to be handled by error middleware
      throw error;
    }
  };
}

/**
 * Performance monitoring
 */
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();

  static recordResponseTime(endpoint: string, responseTime: number): void {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, []);
    }

    const times = this.metrics.get(endpoint)!;
    times.push(responseTime);

    // Keep only the last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
  }

  static getAverageResponseTime(endpoint: string): number {
    const times = this.metrics.get(endpoint);
    if (!times || times.length === 0) return 0;

    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  static getMetrics(): Record<string, { average: number; count: number }> {
    const result: Record<string, { average: number; count: number }> = {};

    this.metrics.forEach((times, endpoint) => {
      result[endpoint] = {
        average: this.getAverageResponseTime(endpoint),
        count: times.length,
      };
    });

    return result;
  }
}
