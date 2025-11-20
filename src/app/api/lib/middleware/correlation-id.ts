/**
 * Request Correlation ID Middleware
 * Generates and propagates correlation IDs for distributed tracing
 */

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACE_ID_HEADER = 'x-trace-id';
export const SPAN_ID_HEADER = 'x-span-id';

/**
 * Extract or generate correlation ID from request
 */
export function getCorrelationId(request: NextRequest): string {
  return (
    request.headers.get(CORRELATION_ID_HEADER) ||
    request.headers.get(REQUEST_ID_HEADER) ||
    request.headers.get(TRACE_ID_HEADER) ||
    randomUUID()
  );
}

/**
 * Generate a new span ID for this request
 */
export function generateSpanId(): string {
  return randomUUID().split('-')[0]; // Short 8-character span ID
}

/**
 * Add correlation headers to response
 */
export function addCorrelationHeaders(
  response: NextResponse,
  correlationId: string,
  spanId?: string
): NextResponse {
  response.headers.set(CORRELATION_ID_HEADER, correlationId);
  response.headers.set(REQUEST_ID_HEADER, correlationId);

  if (spanId) {
    response.headers.set(SPAN_ID_HEADER, spanId);
  }

  return response;
}

/**
 * Correlation ID middleware
 */
export function correlationIdMiddleware(
  handler: (request: NextRequest, correlationId: string, spanId: string) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const correlationId = getCorrelationId(request);
    const spanId = generateSpanId();

    // Add to request context (for logging)
    (request as any).correlationId = correlationId;
    (request as any).spanId = spanId;

    try {
      const response = await handler(request, correlationId, spanId);
      return addCorrelationHeaders(response, correlationId, spanId);
    } catch (error) {
      // Even on error, add correlation headers
      const errorResponse = NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
          correlationId,
        },
        { status: 500 }
      );

      return addCorrelationHeaders(errorResponse, correlationId, spanId);
    }
  };
}

/**
 * Request context for tracing
 */
export interface RequestContext {
  correlationId: string;
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  startTime: number;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Create request context from Next.js request
 */
export function createRequestContext(request: NextRequest): RequestContext {
  const correlationId = getCorrelationId(request);
  const spanId = generateSpanId();
  const parentSpanId = request.headers.get(SPAN_ID_HEADER) || undefined;

  return {
    correlationId,
    spanId,
    traceId: correlationId, // Use correlation ID as trace ID
    parentSpanId,
    startTime: Date.now(),
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent') || undefined,
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined,
  };
}

/**
 * Log trace event
 */
export function logTraceEvent(
  context: RequestContext,
  event: string,
  data?: Record<string, any>
): void {
  const duration = Date.now() - context.startTime;

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'trace',
      correlationId: context.correlationId,
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      event,
      duration,
      method: context.method,
      url: context.url,
      ...data,
    })
  );
}

/**
 * Create child span
 */
export function createChildSpan(parentContext: RequestContext, operation: string): RequestContext {
  return {
    ...parentContext,
    spanId: generateSpanId(),
    parentSpanId: parentContext.spanId,
    startTime: Date.now(),
  };
}

/**
 * Export trace context for external services (gRPC, HTTP clients, etc.)
 */
export function exportTraceContext(context: RequestContext): Record<string, string> {
  return {
    [CORRELATION_ID_HEADER]: context.correlationId,
    [TRACE_ID_HEADER]: context.traceId,
    [SPAN_ID_HEADER]: context.spanId,
  };
}
