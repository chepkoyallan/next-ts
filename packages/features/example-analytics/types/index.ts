/**
 * Analytics Plugin Types
 */

export interface AnalyticsConfig {
  trackingId: string;
  sampleRate: number;
  enableDebug: boolean;
  endpoints: {
    track: string;
    report: string;
  };
}

export interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  trend: 'up' | 'down' | 'neutral';
  period: string;
}

export interface AnalyticsReport {
  id: string;
  title: string;
  generated: Date;
  data: AnalyticsMetric[];
}

export type AnalyticsEventType = 'pageview' | 'click' | 'conversion' | 'error' | 'custom';

export interface AnalyticsEventData {
  type: AnalyticsEventType;
  name: string;
  properties?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
}
