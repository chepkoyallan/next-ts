/**
 * Analytics Widget Component
 * Display analytics metrics in a widget format
 */

import React from 'react';

export interface AnalyticsWidgetProps {
  title?: string;
  value?: number;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function AnalyticsWidget({
  title = 'Analytics Metric',
  value = 0,
  trend = 'neutral',
  className = '',
}: AnalyticsWidgetProps) {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor =
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';

  return (
    <div className={`analytics-widget p-4 border rounded-lg ${className}`}>
      <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      <div className="mt-2 flex items-baseline">
        <p className="text-2xl font-semibold">{value.toLocaleString()}</p>
        <span className={`ml-2 text-sm ${trendColor}`}>{trendIcon}</span>
      </div>
    </div>
  );
}

export default AnalyticsWidget;
