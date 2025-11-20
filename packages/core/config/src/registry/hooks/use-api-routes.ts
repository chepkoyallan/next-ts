// useApiRoutes Hook
// React hooks for accessing API routes from ApiRegistry
// ----------------------------------------------------------------------

'use client';

import { useState, useEffect } from 'react';
import { apiRegistry, type ApiRouteDefinition, type HttpMethod } from '../api-registry';

/**
 * Hook to get all API routes
 */
export function useApiRoutes() {
  const [routes, setRoutes] = useState<ApiRouteDefinition[]>([]);

  useEffect(() => {
    setRoutes(apiRegistry.getEnabledRoutes());

    const unsubscribe = apiRegistry.subscribe((updatedRoutes) => {
      setRoutes(updatedRoutes.filter((r) => r.enabled));
    });

    return unsubscribe;
  }, []);

  return routes;
}

/**
 * Hook to get API routes by method
 */
export function useApiRoutesByMethod(method: HttpMethod) {
  const [routes, setRoutes] = useState<ApiRouteDefinition[]>([]);

  useEffect(() => {
    setRoutes(apiRegistry.getRoutesByMethod(method));

    const unsubscribe = apiRegistry.subscribe(() => {
      setRoutes(apiRegistry.getRoutesByMethod(method));
    });

    return unsubscribe;
  }, [method]);

  return routes;
}

/**
 * Hook to get API routes by tag
 */
export function useApiRoutesByTag(tag: string) {
  const [routes, setRoutes] = useState<ApiRouteDefinition[]>([]);

  useEffect(() => {
    setRoutes(apiRegistry.getRoutesByTag(tag));

    const unsubscribe = apiRegistry.subscribe(() => {
      setRoutes(apiRegistry.getRoutesByTag(tag));
    });

    return unsubscribe;
  }, [tag]);

  return routes;
}

/**
 * Hook to get protected API routes
 */
export function useProtectedApiRoutes() {
  const [routes, setRoutes] = useState<ApiRouteDefinition[]>([]);

  useEffect(() => {
    setRoutes(apiRegistry.getProtectedRoutes());

    const unsubscribe = apiRegistry.subscribe(() => {
      setRoutes(apiRegistry.getProtectedRoutes());
    });

    return unsubscribe;
  }, []);

  return routes;
}

/**
 * Hook to get single API route
 */
export function useApiRoute(routeId: string) {
  const [route, setRoute] = useState<ApiRouteDefinition | undefined>();

  useEffect(() => {
    setRoute(apiRegistry.getRoute(routeId));

    const unsubscribe = apiRegistry.subscribe(() => {
      setRoute(apiRegistry.getRoute(routeId));
    });

    return unsubscribe;
  }, [routeId]);

  return route;
}

/**
 * Hook to check API route access
 */
export function useApiRouteAccess(routeId: string, userRoles: string[]) {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    setHasAccess(apiRegistry.hasAccess(routeId, userRoles));

    const unsubscribe = apiRegistry.subscribe(() => {
      setHasAccess(apiRegistry.hasAccess(routeId, userRoles));
    });

    return unsubscribe;
  }, [routeId, userRoles]);

  return hasAccess;
}

/**
 * Hook to get API registry statistics
 */
export function useApiStats() {
  const [stats, setStats] = useState(apiRegistry.getStats());

  useEffect(() => {
    const unsubscribe = apiRegistry.subscribe(() => {
      setStats(apiRegistry.getStats());
    });

    return unsubscribe;
  }, []);

  return stats;
}

/**
 * Hook to get all API paths
 */
export function useApiPaths() {
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    setPaths(apiRegistry.getAllPaths());

    const unsubscribe = apiRegistry.subscribe(() => {
      setPaths(apiRegistry.getAllPaths());
    });

    return unsubscribe;
  }, []);

  return paths;
}

/**
 * Hook to get API routes for a plugin
 */
export function usePluginApiRoutes(pluginId: string) {
  const [routes, setRoutes] = useState<ApiRouteDefinition[]>([]);

  useEffect(() => {
    setRoutes(apiRegistry.getPluginRoutes(pluginId));

    const unsubscribe = apiRegistry.subscribe(() => {
      setRoutes(apiRegistry.getPluginRoutes(pluginId));
    });

    return unsubscribe;
  }, [pluginId]);

  return routes;
}
