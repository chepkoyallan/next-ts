// API Registry
// Manages dynamic API route registration and middleware
// ----------------------------------------------------------------------

'use client';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type ApiMiddleware = (req: any, res: any, next: () => void) => void | Promise<void>;
export type ApiHandler = (req: any, res: any) => void | Promise<void>;

export interface ApiRouteDefinition {
  /** Unique identifier */
  id: string;

  /** API path (e.g., /api/users) */
  path: string;

  /** HTTP method */
  method: HttpMethod;

  /** Handler function */
  handler: ApiHandler;

  /** Plugin that owns this route */
  pluginId: string;

  /** Route description */
  description?: string;

  /** Middleware stack */
  middleware?: ApiMiddleware[];

  /** Is route enabled */
  enabled?: boolean;

  /** Requires authentication */
  protected?: boolean;

  /** Required user roles */
  roles?: string[];

  /** Rate limit (requests per minute) */
  rateLimit?: number;

  /** CORS configuration */
  cors?: {
    origin?: string | string[];
    methods?: HttpMethod[];
    credentials?: boolean;
  };

  /** Request validation schema */
  validation?: {
    query?: any;
    body?: any;
    params?: any;
  };

  /** Response format */
  response?: {
    contentType?: string;
    schema?: any;
  };

  /** API versioning */
  version?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface ApiEndpointGroup {
  /** Group identifier */
  id: string;

  /** Group name */
  name: string;

  /** Base path for group */
  basePath: string;

  /** Plugin that owns this group */
  pluginId: string;

  /** Group description */
  description?: string;

  /** Shared middleware for all routes in group */
  middleware?: ApiMiddleware[];

  /** Group enabled status */
  enabled?: boolean;
}

/**
 * API Registry - Manages dynamic API route registration
 *
 * Enables plugins to:
 * - Register API endpoints dynamically
 * - Add middleware to routes
 * - Group related endpoints
 * - Configure CORS, rate limiting, validation
 * - Version APIs
 */
class ApiRegistry {
  private static instance: ApiRegistry;
  private routes: Map<string, ApiRouteDefinition> = new Map();
  private groups: Map<string, ApiEndpointGroup> = new Map();
  private routesByPlugin: Map<string, Set<string>> = new Map();
  private routesByPath: Map<string, Map<HttpMethod, ApiRouteDefinition>> = new Map();
  private subscribers: Set<(routes: ApiRouteDefinition[]) => void> = new Set();
  private globalMiddleware: ApiMiddleware[] = [];

  private constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public static getInstance(): ApiRegistry {
    if (!ApiRegistry.instance) {
      ApiRegistry.instance = new ApiRegistry();
    }
    return ApiRegistry.instance;
  }

  /**
   * Initialize API registry
   */
  private init() {
    console.log('[ApiRegistry] Initialized');
  }

  /**
   * Register an API route
   */
  public registerRoute(route: ApiRouteDefinition): void {
    if (this.routes.has(route.id)) {
      console.warn(`[ApiRegistry] Route ${route.id} already registered, overwriting`);
    }

    const routeWithDefaults: ApiRouteDefinition = {
      ...route,
      enabled: route.enabled !== false,
      protected: route.protected || false,
      middleware: route.middleware || [],
      tags: route.tags || [],
    };

    // Store by ID
    this.routes.set(route.id, routeWithDefaults);

    // Store by path and method for quick lookup
    if (!this.routesByPath.has(route.path)) {
      this.routesByPath.set(route.path, new Map());
    }
    this.routesByPath.get(route.path)!.set(route.method, routeWithDefaults);

    // Track by plugin
    if (!this.routesByPlugin.has(route.pluginId)) {
      this.routesByPlugin.set(route.pluginId, new Set());
    }
    this.routesByPlugin.get(route.pluginId)!.add(route.id);

    console.log(`[ApiRegistry] Registered ${route.method} ${route.path} (${route.id})`);
    this.notifySubscribers();
  }

  /**
   * Register multiple routes
   */
  public registerRoutes(routes: ApiRouteDefinition[]): void {
    routes.forEach((route) => this.registerRoute(route));
  }

  /**
   * Unregister an API route
   */
  public unregisterRoute(routeId: string): void {
    const route = this.routes.get(routeId);
    if (!route) return;

    this.routes.delete(routeId);

    // Remove from path lookup
    const pathRoutes = this.routesByPath.get(route.path);
    if (pathRoutes) {
      pathRoutes.delete(route.method);
      if (pathRoutes.size === 0) {
        this.routesByPath.delete(route.path);
      }
    }

    // Remove from plugin tracking
    const pluginRoutes = this.routesByPlugin.get(route.pluginId);
    if (pluginRoutes) {
      pluginRoutes.delete(routeId);
    }

    console.log(`[ApiRegistry] Unregistered ${route.method} ${route.path}`);
    this.notifySubscribers();
  }

  /**
   * Unregister all routes for a plugin
   */
  public unregisterPluginRoutes(pluginId: string): void {
    const routeIds = this.routesByPlugin.get(pluginId);
    if (!routeIds) return;

    routeIds.forEach((routeId) => {
      const route = this.routes.get(routeId);
      if (route) {
        this.routes.delete(routeId);
        const pathRoutes = this.routesByPath.get(route.path);
        if (pathRoutes) {
          pathRoutes.delete(route.method);
        }
      }
    });

    this.routesByPlugin.delete(pluginId);
    console.log(`[ApiRegistry] Unregistered all routes for plugin: ${pluginId}`);
    this.notifySubscribers();
  }

  /**
   * Register an endpoint group
   */
  public registerGroup(group: ApiEndpointGroup): void {
    if (this.groups.has(group.id)) {
      console.warn(`[ApiRegistry] Group ${group.id} already registered, overwriting`);
    }

    const groupWithDefaults: ApiEndpointGroup = {
      ...group,
      enabled: group.enabled !== false,
      middleware: group.middleware || [],
    };

    this.groups.set(group.id, groupWithDefaults);
    console.log(`[ApiRegistry] Registered group: ${group.name} (${group.basePath})`);
  }

  /**
   * Get route by ID
   */
  public getRoute(routeId: string): ApiRouteDefinition | undefined {
    return this.routes.get(routeId);
  }

  /**
   * Get route by path and method
   */
  public getRouteByPath(path: string, method: HttpMethod): ApiRouteDefinition | undefined {
    return this.routesByPath.get(path)?.get(method);
  }

  /**
   * Get all routes
   */
  public getRoutes(): ApiRouteDefinition[] {
    return Array.from(this.routes.values());
  }

  /**
   * Get enabled routes
   */
  public getEnabledRoutes(): ApiRouteDefinition[] {
    return Array.from(this.routes.values()).filter((r) => r.enabled);
  }

  /**
   * Get routes by plugin
   */
  public getPluginRoutes(pluginId: string): ApiRouteDefinition[] {
    const routeIds = this.routesByPlugin.get(pluginId);
    if (!routeIds) return [];

    return Array.from(routeIds)
      .map((id) => this.routes.get(id))
      .filter((r): r is ApiRouteDefinition => r !== undefined);
  }

  /**
   * Get routes by method
   */
  public getRoutesByMethod(method: HttpMethod): ApiRouteDefinition[] {
    return this.getEnabledRoutes().filter((r) => r.method === method);
  }

  /**
   * Get routes by tag
   */
  public getRoutesByTag(tag: string): ApiRouteDefinition[] {
    return this.getEnabledRoutes().filter((r) => r.tags?.includes(tag));
  }

  /**
   * Get protected routes
   */
  public getProtectedRoutes(): ApiRouteDefinition[] {
    return this.getEnabledRoutes().filter((r) => r.protected);
  }

  /**
   * Get all groups
   */
  public getGroups(): ApiEndpointGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Get group by ID
   */
  public getGroup(groupId: string): ApiEndpointGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * Register global middleware (runs on all routes)
   */
  public registerGlobalMiddleware(middleware: ApiMiddleware): void {
    this.globalMiddleware.push(middleware);
    console.log('[ApiRegistry] Registered global middleware');
  }

  /**
   * Get global middleware
   */
  public getGlobalMiddleware(): ApiMiddleware[] {
    return this.globalMiddleware;
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
   * Generate OpenAPI/Swagger documentation
   */
  public generateOpenApiSpec(info: {
    title: string;
    version: string;
    description?: string;
  }): any {
    const paths: any = {};

    this.getEnabledRoutes().forEach((route) => {
      if (!paths[route.path]) {
        paths[route.path] = {};
      }

      paths[route.path][route.method.toLowerCase()] = {
        summary: route.description || `${route.method} ${route.path}`,
        tags: route.tags || [],
        security: route.protected ? [{ bearerAuth: [] }] : [],
        parameters: [],
        responses: {
          200: {
            description: 'Successful response',
            content: {
              [route.response?.contentType || 'application/json']: {
                schema: route.response?.schema || {},
              },
            },
          },
        },
      };
    });

    return {
      openapi: '3.0.0',
      info,
      paths,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    };
  }

  /**
   * Get all API paths (for Next.js route generation)
   */
  public getAllPaths(): string[] {
    return Array.from(new Set(this.getEnabledRoutes().map((r) => r.path)));
  }

  /**
   * Subscribe to route changes
   */
  public subscribe(callback: (routes: ApiRouteDefinition[]) => void): () => void {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers
   */
  private notifySubscribers(): void {
    const routes = this.getRoutes();
    this.subscribers.forEach((callback) => {
      try {
        callback(routes);
      } catch (error) {
        console.error('[ApiRegistry] Error in subscriber:', error);
      }
    });
  }

  /**
   * Clear all routes
   */
  public clear(): void {
    this.routes.clear();
    this.groups.clear();
    this.routesByPlugin.clear();
    this.routesByPath.clear();
    console.log('[ApiRegistry] Cleared all routes');
    this.notifySubscribers();
  }

  /**
   * Get registry statistics
   */
  public getStats() {
    return {
      totalRoutes: this.routes.size,
      enabledRoutes: this.getEnabledRoutes().length,
      protectedRoutes: this.getProtectedRoutes().length,
      groups: this.groups.size,
      plugins: this.routesByPlugin.size,
      methods: {
        GET: this.getRoutesByMethod('GET').length,
        POST: this.getRoutesByMethod('POST').length,
        PUT: this.getRoutesByMethod('PUT').length,
        PATCH: this.getRoutesByMethod('PATCH').length,
        DELETE: this.getRoutesByMethod('DELETE').length,
      },
    };
  }
}

// Export singleton instance
export const apiRegistry = ApiRegistry.getInstance();

export default ApiRegistry;
