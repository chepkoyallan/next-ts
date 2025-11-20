// React Hook for Discovered Endpoints
// Provides access to auto-discovered endpoints from /api/v1/
// ----------------------------------------------------------------------

'use client';

import { useState, useEffect } from 'react';
import type { DiscoveredEndpoint } from './endpoint-scanner';

/**
 * Hook to load discovered endpoints from the registry
 */
export function useDiscoveredEndpoints() {
  const [endpoints, setEndpoints] = useState<DiscoveredEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEndpoints() {
      try {
        // Call API to discover endpoints on-the-fly
        const response = await fetch('/api/discover-endpoints');

        if (response.ok) {
          const data = await response.json();
          setEndpoints(data.endpoints || []);
          setError(null);
        } else {
          throw new Error('Failed to load endpoints');
        }
      } catch (err) {
        console.error('Error loading discovered endpoints:', err);
        setError(err instanceof Error ? err.message : 'Failed to load endpoints');
        setEndpoints([]);
      } finally {
        setLoading(false);
      }
    }

    loadEndpoints();
  }, []);

  return {
    endpoints,
    loading,
    error,
    refresh: () => {
      setLoading(true);
      // Trigger reload
    },
  };
}

/**
 * Converts a discovered endpoint to API endpoint config format
 */
export function discoveredToConfig(
  discovered: DiscoveredEndpoint
): Partial<import('src/config/types').APIEndpointConfig> {
  return {
    id: discovered.id,
    name: discovered.description || `${discovered.methods.join('/')} ${discovered.routePath}`,
    description: discovered.description,
    path: discovered.routePath.replace('/api/v1', ''), // Remove /api/v1 prefix for custom endpoints
    method: discovered.methods[0] as any, // Use first method
    enabled: false, // Start disabled by default
    auth: {
      required: discovered.auth.required,
      roles: discovered.auth.roles,
      permissions: discovered.auth.permissions,
    },
    rateLimit: discovered.rateLimit
      ? {
          enabled: true,
          windowMs: discovered.rateLimit.windowMs,
          maxRequests: discovered.rateLimit.maxRequests,
        }
      : undefined,
    tags: discovered.tags,
    isSystem: true, // Mark as system-discovered
  };
}
