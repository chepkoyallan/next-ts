/**
 * API Metrics & Analytics Service
 * Track response times, error rates, and endpoint popularity
 */

export interface Metric {
  timestamp: number;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  userId?: string;
  error?: string;
}

export interface EndpointMetrics {
  endpoint: string;
  totalRequests: number;
  averageResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  requestsPerMinute: number;
}

const metrics: Metric[] = [];
const MAX_METRICS = 10000;

/**
 * Record a metric
 */
export function recordMetric(metric: Omit<Metric, 'timestamp'>): void {
  metrics.push({
    ...metric,
    timestamp: Date.now(),
  });

  // Keep only last MAX_METRICS
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }
}

/**
 * Get metrics for endpoint
 */
export function getEndpointMetrics(
  endpoint: string,
  timeWindow: number = 3600000
): EndpointMetrics {
  const now = Date.now();
  const relevantMetrics = metrics.filter(
    (m) => m.endpoint === endpoint && now - m.timestamp < timeWindow
  );

  if (relevantMetrics.length === 0) {
    return {
      endpoint,
      totalRequests: 0,
      averageResponseTime: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      errorRate: 0,
      requestsPerMinute: 0,
    };
  }

  const responseTimes = relevantMetrics.map((m) => m.responseTime).sort((a, b) => a - b);
  const errorCount = relevantMetrics.filter((m) => m.statusCode >= 400).length;

  return {
    endpoint,
    totalRequests: relevantMetrics.length,
    averageResponseTime: responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length,
    p50: calculatePercentile(responseTimes, 50),
    p95: calculatePercentile(responseTimes, 95),
    p99: calculatePercentile(responseTimes, 99),
    errorRate: errorCount / relevantMetrics.length,
    requestsPerMinute: (relevantMetrics.length / timeWindow) * 60000,
  };
}

/**
 * Get all metrics summary
 */
export function getAllMetrics(timeWindow: number = 3600000): {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  topEndpoints: Array<{ endpoint: string; requests: number }>;
  slowestEndpoints: Array<{ endpoint: string; avgResponseTime: number }>;
} {
  const now = Date.now();
  const relevantMetrics = metrics.filter((m) => now - m.timestamp < timeWindow);

  // Use reduce instead of for...of
  const { endpointCounts, endpointResponseTimes } = relevantMetrics.reduce(
    (acc, metric) => {
      acc.endpointCounts[metric.endpoint] = (acc.endpointCounts[metric.endpoint] || 0) + 1;

      if (!acc.endpointResponseTimes[metric.endpoint]) {
        acc.endpointResponseTimes[metric.endpoint] = [];
      }
      acc.endpointResponseTimes[metric.endpoint].push(metric.responseTime);

      return acc;
    },
    {
      endpointCounts: {} as Record<string, number>,
      endpointResponseTimes: {} as Record<string, number[]>,
    }
  );

  const topEndpoints = Object.entries(endpointCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([endpoint, requests]) => ({ endpoint, requests }));

  const slowestEndpoints = Object.entries(endpointResponseTimes)
    .map(([endpoint, times]) => ({
      endpoint,
      avgResponseTime: times.reduce((sum, t) => sum + t, 0) / times.length,
    }))
    .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
    .slice(0, 10);

  const errorCount = relevantMetrics.filter((m) => m.statusCode >= 400).length;
  const avgResponseTime =
    relevantMetrics.reduce((sum, m) => sum + m.responseTime, 0) / relevantMetrics.length || 0;

  return {
    totalRequests: relevantMetrics.length,
    averageResponseTime: avgResponseTime,
    errorRate: relevantMetrics.length > 0 ? errorCount / relevantMetrics.length : 0,
    topEndpoints,
    slowestEndpoints,
  };
}

/**
 * Calculate percentile
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;

  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)];
}

/**
 * Export metrics in Prometheus format
 */
export function exportPrometheusMetrics(): string {
  const lines: string[] = [];

  // Total requests counter
  lines.push('# HELP api_requests_total Total number of API requests');
  lines.push('# TYPE api_requests_total counter');
  lines.push(`api_requests_total ${metrics.length}`);

  // Response time histogram
  lines.push('# HELP api_response_time_seconds API response time in seconds');
  lines.push('# TYPE api_response_time_seconds histogram');

  const uniqueEndpoints = Array.from(new Set(metrics.map((m) => m.endpoint)));

  // Use forEach instead of for...of
  uniqueEndpoints.forEach((endpoint) => {
    const em = getEndpointMetrics(endpoint);

    lines.push(`api_response_time_seconds{endpoint="${endpoint}",quantile="0.5"} ${em.p50 / 1000}`);
    lines.push(
      `api_response_time_seconds{endpoint="${endpoint}",quantile="0.95"} ${em.p95 / 1000}`
    );
    lines.push(
      `api_response_time_seconds{endpoint="${endpoint}",quantile="0.99"} ${em.p99 / 1000}`
    );
  });

  return lines.join('\n');
}
