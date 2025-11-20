/**
 * gRPC Metadata Utilities
 * Helper functions for building and managing gRPC metadata
 */

import * as grpc from '@grpc/grpc-js';

export type AuthType = 'Bearer' | 'ApiKey' | 'Basic';

export interface TracingContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled?: boolean;
}

export class MetadataBuilder {
  private metadata: grpc.Metadata;

  constructor(initial?: grpc.Metadata) {
    this.metadata = initial || new grpc.Metadata();
  }

  /**
   * Add authentication header
   */
  addAuth(token: string, type: AuthType = 'Bearer'): this {
    if (type === 'Bearer' || type === 'Basic') {
      this.metadata.add('authorization', `${type} ${token}`);
    } else if (type === 'ApiKey') {
      this.metadata.add('x-api-key', token);
    }
    return this;
  }

  /**
   * Add distributed tracing headers
   */
  addTracing(context: TracingContext): this {
    this.metadata.add('x-trace-id', context.traceId);
    this.metadata.add('x-span-id', context.spanId);

    if (context.parentSpanId) {
      this.metadata.add('x-parent-span-id', context.parentSpanId);
    }

    if (context.sampled !== undefined) {
      this.metadata.add('x-sampled', context.sampled ? '1' : '0');
    }

    return this;
  }

  /**
   * Add request ID for tracking
   */
  addRequestId(requestId: string): this {
    this.metadata.add('x-request-id', requestId);
    return this;
  }

  /**
   * Add client information
   */
  addClientInfo(name: string, version?: string): this {
    this.metadata.add('x-client-name', name);
    if (version) {
      this.metadata.add('x-client-version', version);
    }
    return this;
  }

  /**
   * Add custom header
   */
  addCustom(key: string, value: string | Buffer): this {
    this.metadata.add(key, value);
    return this;
  }

  /**
   * Add multiple custom headers
   */
  addCustomHeaders(headers: Record<string, string | Buffer>): this {
    Object.entries(headers).forEach(([key, value]) => {
      this.metadata.add(key, value);
    });
    return this;
  }

  /**
   * Set timeout header (in milliseconds)
   */
  setTimeout(timeoutMs: number): this {
    this.metadata.add('grpc-timeout', `${timeoutMs}m`);
    return this;
  }

  /**
   * Build and return the metadata
   */
  build(): grpc.Metadata {
    return this.metadata;
  }

  /**
   * Get a specific value from metadata
   */
  get(key: string): string | Buffer | undefined {
    const values = this.metadata.get(key);
    return values.length > 0 ? values[0] : undefined;
  }

  /**
   * Get all values for a key
   */
  getAll(key: string): Array<string | Buffer> {
    return this.metadata.get(key);
  }

  /**
   * Check if metadata has a key
   */
  has(key: string): boolean {
    return this.metadata.get(key).length > 0;
  }

  /**
   * Remove a key from metadata
   */
  remove(key: string): this {
    this.metadata.remove(key);
    return this;
  }

  /**
   * Clone the metadata
   */
  clone(): MetadataBuilder {
    return new MetadataBuilder(this.metadata.clone());
  }
}

/**
 * Create metadata from object
 */
export function createMetadata(headers: Record<string, string | Buffer>): grpc.Metadata {
  return new MetadataBuilder().addCustomHeaders(headers).build();
}

/**
 * Extract tracing context from metadata
 */
export function extractTracingContext(metadata: grpc.Metadata): TracingContext | null {
  const traceId = metadata.get('x-trace-id')[0];
  const spanId = metadata.get('x-span-id')[0];

  if (!traceId || !spanId) {
    return null;
  }

  const parentSpanId = metadata.get('x-parent-span-id')[0];
  const sampled = metadata.get('x-sampled')[0];

  return {
    traceId: traceId.toString(),
    spanId: spanId.toString(),
    parentSpanId: parentSpanId?.toString(),
    sampled: sampled?.toString() === '1',
  };
}

/**
 * Generate unique trace ID
 */
export function generateTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate unique span ID
 */
export function generateSpanId(): string {
  return Math.random().toString(36).substr(2, 16);
}
