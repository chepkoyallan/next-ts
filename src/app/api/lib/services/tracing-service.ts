/**
 * Distributed Tracing Service
 * OpenTelemetry-compatible tracing for distributed systems
 */

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'SERVER' | 'CLIENT' | 'INTERNAL' | 'PRODUCER' | 'CONSUMER';
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'OK' | 'ERROR' | 'PENDING';
  attributes: Record<string, any>;
  events: TraceEvent[];
}

export interface TraceEvent {
  timestamp: number;
  name: string;
  attributes?: Record<string, any>;
}

export interface Trace {
  traceId: string;
  spans: Span[];
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'OK' | 'ERROR' | 'PENDING';
}

// In-memory trace storage (for development/testing)
// In production, export to OpenTelemetry Collector, Jaeger, or Zipkin
const traces = new Map<string, Trace>();
const spans = new Map<string, Span>();

/**
 * Start a new span
 */
export function startSpan(
  traceId: string,
  name: string,
  kind: Span['kind'] = 'INTERNAL',
  parentSpanId?: string,
  attributes?: Record<string, any>
): Span {
  const span: Span = {
    traceId,
    spanId: generateSpanId(),
    parentSpanId,
    name,
    kind,
    startTime: Date.now(),
    status: 'PENDING',
    attributes: attributes || {},
    events: [],
  };

  spans.set(span.spanId, span);

  // Update or create trace
  let trace = traces.get(traceId);
  if (!trace) {
    trace = {
      traceId,
      spans: [span],
      startTime: span.startTime,
      status: 'PENDING',
    };
    traces.set(traceId, trace);
  } else {
    trace.spans.push(span);
  }

  return span;
}

/**
 * End a span
 */
export function endSpan(
  spanId: string,
  status: 'OK' | 'ERROR' = 'OK',
  attributes?: Record<string, any>
): void {
  const span = spans.get(spanId);
  if (!span) {
    console.warn(`Span not found: ${spanId}`);
    return;
  }

  span.endTime = Date.now();
  span.duration = span.endTime - span.startTime;
  span.status = status;

  if (attributes) {
    span.attributes = { ...span.attributes, ...attributes };
  }

  // Update trace status
  const trace = traces.get(span.traceId);
  if (trace) {
    const allSpansComplete = trace.spans.every((s) => s.status !== 'PENDING');
    if (allSpansComplete) {
      trace.endTime = Date.now();
      trace.duration = trace.endTime - trace.startTime;
      trace.status = trace.spans.some((s) => s.status === 'ERROR') ? 'ERROR' : 'OK';
    }
  }

  // Export span (log to console for now)
  exportSpan(span);
}

/**
 * Add event to span
 */
export function addSpanEvent(spanId: string, name: string, attributes?: Record<string, any>): void {
  const span = spans.get(spanId);
  if (!span) {
    console.warn(`Span not found: ${spanId}`);
    return;
  }

  span.events.push({
    timestamp: Date.now(),
    name,
    attributes,
  });
}

/**
 * Set span attributes
 */
export function setSpanAttributes(spanId: string, attributes: Record<string, any>): void {
  const span = spans.get(spanId);
  if (!span) {
    console.warn(`Span not found: ${spanId}`);
    return;
  }

  span.attributes = { ...span.attributes, ...attributes };
}

/**
 * Record exception in span
 */
export function recordException(spanId: string, error: Error): void {
  addSpanEvent(spanId, 'exception', {
    'exception.type': error.name,
    'exception.message': error.message,
    'exception.stacktrace': error.stack,
  });

  setSpanAttributes(spanId, {
    error: true,
    'error.message': error.message,
  });
}

/**
 * Get trace by ID
 */
export function getTrace(traceId: string): Trace | undefined {
  return traces.get(traceId);
}

/**
 * Get span by ID
 */
export function getSpan(spanId: string): Span | undefined {
  return spans.get(spanId);
}

/**
 * Get all traces
 */
export function getAllTraces(limit: number = 100): Trace[] {
  const allTraces = Array.from(traces.values());
  return allTraces.slice(-limit).reverse(); // Most recent first
}

/**
 * Export span to OpenTelemetry format
 */
function exportSpan(span: Span): void {
  // In production, send to OpenTelemetry Collector
  // For now, log to console in structured format
  if (process.env.NODE_ENV === 'development') {
    console.log(
      JSON.stringify({
        timestamp: new Date(span.startTime).toISOString(),
        level: 'trace',
        message: `Span: ${span.name}`,
        traceId: span.traceId,
        spanId: span.spanId,
        parentSpanId: span.parentSpanId,
        kind: span.kind,
        duration: span.duration,
        status: span.status,
        attributes: span.attributes,
        events: span.events,
      })
    );
  }

  // Optionally, persist to database
  persistSpanToDatabase(span).catch((error) => {
    console.error('Failed to persist span:', error);
  });
}

/**
 * Persist span to database (optional)
 */
async function persistSpanToDatabase(span: Span): Promise<void> {
  if (process.env.ENABLE_TRACE_PERSISTENCE !== 'true') {
    return;
  }

  try {
    // Note: This requires a Trace table in your Prisma schema
    // You can add it later if needed
    console.log('Trace persistence not yet implemented - add Trace model to Prisma schema');
  } catch (error) {
    console.error('Failed to persist span to database:', error);
  }
}

/**
 * Generate unique span ID
 */
function generateSpanId(): string {
  return Math.random().toString(16).slice(2, 18); // 16-character hex string
}

/**
 * Clean up old traces (prevent memory leak)
 */
export function cleanupOldTraces(maxAge: number = 3600000): void {
  // Default: 1 hour
  const now = Date.now();

  // Use array iteration instead of for...of
  Array.from(traces.entries()).forEach(([traceId, trace]) => {
    if (trace.endTime && now - trace.endTime > maxAge) {
      traces.delete(traceId);
      // Clean up associated spans
      trace.spans.forEach((span) => {
        spans.delete(span.spanId);
      });
    }
  });
}

/**
 * Start periodic cleanup
 */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cleanupOldTraces();
  }, 300000); // Clean up every 5 minutes
}

/**
 * Get trace statistics
 */
export function getTraceStatistics(): {
  totalTraces: number;
  totalSpans: number;
  averageDuration: number;
  errorRate: number;
} {
  const allTraces = Array.from(traces.values());
  const completedTraces = allTraces.filter((t) => t.status !== 'PENDING');

  const totalDuration = completedTraces.reduce((sum, t) => sum + (t.duration || 0), 0);
  const errorCount = completedTraces.filter((t) => t.status === 'ERROR').length;

  return {
    totalTraces: traces.size,
    totalSpans: spans.size,
    averageDuration: completedTraces.length > 0 ? totalDuration / completedTraces.length : 0,
    errorRate: completedTraces.length > 0 ? errorCount / completedTraces.length : 0,
  };
}
