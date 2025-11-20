/**
 * useAnalytics Hook
 * Custom hook for tracking analytics events
 */

import { useCallback } from 'react';

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

export function useAnalytics() {
  const track = useCallback((eventName: string, properties?: Record<string, any>) => {
    const event: AnalyticsEvent = {
      name: eventName,
      properties,
      timestamp: new Date(),
    };

    // In a real implementation, this would send data to an analytics service
    console.log('[Analytics]', event);

    // Emit custom event for other plugins to listen
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('analytics.event', {
          detail: event,
        })
      );
    }
  }, []);

  const trackPageView = useCallback((path: string, properties?: Record<string, any>) => {
    track('pageview', {
      path,
      ...properties,
    });
  }, [track]);

  const trackClick = useCallback((elementId: string, properties?: Record<string, any>) => {
    track('click', {
      elementId,
      ...properties,
    });
  }, [track]);

  return {
    track,
    trackPageView,
    trackClick,
  };
}

export default useAnalytics;
