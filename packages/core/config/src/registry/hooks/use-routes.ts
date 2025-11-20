// useRoutes Hook
// React hook for accessing dynamic routes from RouteRegistry
// ----------------------------------------------------------------------

'use client';

import { useState, useEffect, useMemo } from 'react';
import { routeRegistry, type RouteDefinition } from '../route-registry';

/**
 * Hook to access routes from RouteRegistry
 */
export function useRoutes() {
  const [routes, setRoutes] = useState<RouteDefinition[]>([]);

  useEffect(() => {
    // Get initial routes
    setRoutes(routeRegistry.getEnabledRoutes());

    // Subscribe to changes
    const unsubscribe = routeRegistry.subscribe((updatedRoutes) => {
      setRoutes(updatedRoutes.filter((r) => r.enabled));
    });

    return unsubscribe;
  }, []);

  return routes;
}

/**
 * Hook to get routes for a specific layout
 */
export function useRoutesByLayout(layout: string) {
  const [routes, setRoutes] = useState<RouteDefinition[]>([]);

  useEffect(() => {
    setRoutes(routeRegistry.getRoutesByLayout(layout));

    const unsubscribe = routeRegistry.subscribe(() => {
      setRoutes(routeRegistry.getRoutesByLayout(layout));
    });

    return unsubscribe;
  }, [layout]);

  return routes;
}

/**
 * Hook to get protected routes
 */
export function useProtectedRoutes() {
  const [routes, setRoutes] = useState<RouteDefinition[]>([]);

  useEffect(() => {
    setRoutes(routeRegistry.getProtectedRoutes());

    const unsubscribe = routeRegistry.subscribe(() => {
      setRoutes(routeRegistry.getProtectedRoutes());
    });

    return unsubscribe;
  }, []);

  return routes;
}

/**
 * Hook to get route by path
 */
export function useRoute(path: string) {
  const [route, setRoute] = useState<RouteDefinition | undefined>();

  useEffect(() => {
    setRoute(routeRegistry.getRouteByPath(path));

    const unsubscribe = routeRegistry.subscribe(() => {
      setRoute(routeRegistry.getRouteByPath(path));
    });

    return unsubscribe;
  }, [path]);

  return route;
}

/**
 * Hook to check if user has access to a route
 */
export function useRouteAccess(routeId: string, userRoles: string[]) {
  const hasAccess = useMemo(() => {
    return routeRegistry.hasAccess(routeId, userRoles);
  }, [routeId, userRoles]);

  return hasAccess;
}

/**
 * Hook to get route statistics
 */
export function useRouteStats() {
  const [stats, setStats] = useState(routeRegistry.getStats());

  useEffect(() => {
    const unsubscribe = routeRegistry.subscribe(() => {
      setStats(routeRegistry.getStats());
    });

    return unsubscribe;
  }, []);

  return stats;
}
