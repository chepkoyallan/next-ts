// Route Registry
// Dynamic route management system for plugins
// ----------------------------------------------------------------------

'use client';

import type { Plugin } from '../types';

export interface RouteDefinition {
  /** Unique route identifier */
  id: string;

  /** Route path pattern (e.g., /dashboard, /user/:id) */
  path: string;

  /** Component to render (lazy loaded) */
  component: React.ComponentType<any> | (() => Promise<{ default: React.ComponentType<any> }>);

  /** Plugin that owns this route */
  pluginId: string;

  /** Route layout */
  layout?: 'dashboard' | 'auth' | 'blank' | 'main';

  /** Is route protected (requires auth) */
  protected?: boolean;

  /** Required roles to access route */
  roles?: string[];

  /** Route metadata */
  meta?: {
    title?: string;
    description?: string;
    keywords?: string[];
    ogImage?: string;
  };

  /** Parent route ID (for nested routes) */
  parentId?: string;

  /** Route priority (higher = rendered first) */
  priority?: number;

  /** Route group (for organization) */
  group?: string;

  /** Is route enabled */
  enabled?: boolean;
}

export interface RouteGroup {
  id: string;
  name: string;
  prefix?: string;
  layout?: string;
  middleware?: string[];
}

/**
 * Route Registry - Manages dynamic route registration
 */
class RouteRegistry {
  private static instance: RouteRegistry;
  private routes: Map<string, RouteDefinition> = new Map();
  private groups: Map<string, RouteGroup> = new Map();
  private routesByPlugin: Map<string, Set<string>> = new Map();
  private subscribers: Set<(routes: RouteDefinition[]) => void> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public static getInstance(): RouteRegistry {
    if (!RouteRegistry.instance) {
      RouteRegistry.instance = new RouteRegistry();
    }
    return RouteRegistry.instance;
  }

  /**
   * Initialize route registry
   */
  private init() {
    console.log('[RouteRegistry] Initialized');
  }

  /**
   * Register a route
   */
  public registerRoute(route: RouteDefinition): void {
    if (this.routes.has(route.id)) {
      console.warn(`[RouteRegistry] Route ${route.id} already registered, overwriting`);
    }

    // Set defaults
    const routeWithDefaults: RouteDefinition = {
      ...route,
      enabled: route.enabled !== false,
      priority: route.priority || 0,
      protected: route.protected || false,
    };

    this.routes.set(route.id, routeWithDefaults);

    // Track route by plugin
    if (!this.routesByPlugin.has(route.pluginId)) {
      this.routesByPlugin.set(route.pluginId, new Set());
    }
    this.routesByPlugin.get(route.pluginId)!.add(route.id);

    console.log(`[RouteRegistry] Registered route: ${route.path} (${route.id})`);
    this.notifySubscribers();
  }

  /**
   * Register multiple routes
   */
  public registerRoutes(routes: RouteDefinition[]): void {
    routes.forEach((route) => this.registerRoute(route));
  }

  /**
   * Unregister a route
   */
  public unregisterRoute(routeId: string): void {
    const route = this.routes.get(routeId);
    if (!route) return;

    this.routes.delete(routeId);

    // Remove from plugin tracking
    const pluginRoutes = this.routesByPlugin.get(route.pluginId);
    if (pluginRoutes) {
      pluginRoutes.delete(routeId);
    }

    console.log(`[RouteRegistry] Unregistered route: ${routeId}`);
    this.notifySubscribers();
  }

  /**
   * Unregister all routes from a plugin
   */
  public unregisterPluginRoutes(pluginId: string): void {
    const routeIds = this.routesByPlugin.get(pluginId);
    if (!routeIds) return;

    routeIds.forEach((routeId) => {
      this.routes.delete(routeId);
    });

    this.routesByPlugin.delete(pluginId);
    console.log(`[RouteRegistry] Unregistered all routes for plugin: ${pluginId}`);
    this.notifySubscribers();
  }

  /**
   * Get a route by ID
   */
  public getRoute(routeId: string): RouteDefinition | undefined {
    return this.routes.get(routeId);
  }

  /**
   * Get route by path
   */
  public getRouteByPath(path: string): RouteDefinition | undefined {
    return Array.from(this.routes.values()).find((route) => route.path === path);
  }

  /**
   * Get all routes
   */
  public getRoutes(): RouteDefinition[] {
    return Array.from(this.routes.values()).sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * Get enabled routes
   */
  public getEnabledRoutes(): RouteDefinition[] {
    return this.getRoutes().filter((route) => route.enabled);
  }

  /**
   * Get routes for a plugin
   */
  public getPluginRoutes(pluginId: string): RouteDefinition[] {
    const routeIds = this.routesByPlugin.get(pluginId);
    if (!routeIds) return [];

    return Array.from(routeIds)
      .map((id) => this.routes.get(id))
      .filter((route): route is RouteDefinition => route !== undefined);
  }

  /**
   * Get routes by layout
   */
  public getRoutesByLayout(layout: string): RouteDefinition[] {
    return this.getEnabledRoutes().filter((route) => route.layout === layout);
  }

  /**
   * Get routes by group
   */
  public getRoutesByGroup(group: string): RouteDefinition[] {
    return this.getEnabledRoutes().filter((route) => route.group === group);
  }

  /**
   * Get protected routes
   */
  public getProtectedRoutes(): RouteDefinition[] {
    return this.getEnabledRoutes().filter((route) => route.protected);
  }

  /**
   * Get public routes
   */
  public getPublicRoutes(): RouteDefinition[] {
    return this.getEnabledRoutes().filter((route) => !route.protected);
  }

  /**
   * Check if user has access to route
   */
  public hasAccess(routeId: string, userRoles: string[]): boolean {
    const route = this.routes.get(routeId);
    if (!route || !route.enabled) return false;
    if (!route.protected) return true;
    if (!route.roles || route.roles.length === 0) return true;

    return userRoles.some((role) => route.roles!.includes(role));
  }

  /**
   * Register a route group
   */
  public registerGroup(group: RouteGroup): void {
    this.groups.set(group.id, group);
    console.log(`[RouteRegistry] Registered route group: ${group.name}`);
  }

  /**
   * Get route group
   */
  public getGroup(groupId: string): RouteGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * Get all groups
   */
  public getGroups(): RouteGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Load routes from plugin
   */
  public loadPluginRoutes(plugin: Plugin): void {
    if (!plugin.routes || plugin.routes.length === 0) return;

    const routes: RouteDefinition[] = plugin.routes.map((route, index) => ({
      id: `${plugin.id}.route.${index}`,
      path: route.path,
      component: route.component,
      pluginId: plugin.id,
      layout: route.layout,
      protected: route.protected,
      meta: route.meta,
      priority: index,
      enabled: plugin.enabled,
    }));

    this.registerRoutes(routes);
  }

  /**
   * Subscribe to route changes
   */
  public subscribe(callback: (routes: RouteDefinition[]) => void): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers of route changes
   */
  private notifySubscribers(): void {
    const routes = this.getRoutes();
    this.subscribers.forEach((callback) => {
      try {
        callback(routes);
      } catch (error) {
        console.error('[RouteRegistry] Error in subscriber:', error);
      }
    });
  }

  /**
   * Generate Next.js route metadata
   */
  public generateMetadata(routeId: string): any {
    const route = this.routes.get(routeId);
    if (!route || !route.meta) return {};

    return {
      title: route.meta.title,
      description: route.meta.description,
      keywords: route.meta.keywords,
      openGraph: route.meta.ogImage
        ? {
            images: [route.meta.ogImage],
          }
        : undefined,
    };
  }

  /**
   * Clear all routes
   */
  public clear(): void {
    this.routes.clear();
    this.routesByPlugin.clear();
    this.groups.clear();
    console.log('[RouteRegistry] Cleared all routes');
    this.notifySubscribers();
  }

  /**
   * Get registry stats
   */
  public getStats() {
    return {
      totalRoutes: this.routes.size,
      enabledRoutes: this.getEnabledRoutes().length,
      protectedRoutes: this.getProtectedRoutes().length,
      publicRoutes: this.getPublicRoutes().length,
      plugins: this.routesByPlugin.size,
      groups: this.groups.size,
    };
  }
}

// Export singleton instance
export const routeRegistry = RouteRegistry.getInstance();

export default RouteRegistry;
