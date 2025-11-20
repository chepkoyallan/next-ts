/**
 * Analytics Chart Component
 * Display analytics data in a chart format
 */

import React from 'react';

export interface DataPoint {
  label: string;
  value: number;
}

export interface AnalyticsChartProps {
  title?: string;
  data?: DataPoint[];
  type?: 'bar' | 'line' | 'pie';
  className?: string;
}

export function AnalyticsChart({
  title = 'Analytics Chart',
  data = [],
  type = 'bar',
  className = '',
}: AnalyticsChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={`analytics-chart p-4 border rounded-lg ${className}`}>
      <h3 className="text-lg font-medium mb-4">{title}</h3>
      <div className="space-y-2">
        {data.length === 0 ? (
          <p className="text-sm text-gray-500">No data available</p>
        ) : (
          data.map((point, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm w-24 text-gray-600">{point.label}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                <div
                  className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${(point.value / maxValue) * 100}%` }}
                >
                  <span className="text-xs text-white font-medium">{point.value}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AnalyticsChart;
