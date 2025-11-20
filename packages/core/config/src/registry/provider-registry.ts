// Provider Registry
// Dynamic provider management for composable React context providers
// ----------------------------------------------------------------------

'use client';

export interface ProviderDefinition {
  /** Unique identifier */
  id: string;

  /** Provider component */
  component: React.ComponentType<{ children: React.ReactNode }>;

  /** Plugin that owns this provider */
  pluginId: string;

  /** Provider order (lower = outer provider) */
  order?: number;

  /** Is provider enabled */
  enabled?: boolean;

  /** Provider dependencies (must be loaded before this) */
  dependencies?: string[];

  /** Provider configuration */
  config?: Record<string, any>;
}

/**
 * Provider Registry - Manages dynamic provider composition
 */
class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, ProviderDefinition> = new Map();
  private providersByPlugin: Map<string, Set<string>> = new Map();
  private subscribers: Set<(providers: ProviderDefinition[]) => void> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Initialize provider registry
   */
  private init() {
    console.log('[ProviderRegistry] Initialized');
  }

  /**
   * Register a provider
   */
  public registerProvider(provider: ProviderDefinition): void {
    if (this.providers.has(provider.id)) {
      console.warn(`[ProviderRegistry] Provider ${provider.id} already registered, overwriting`);
    }

    const providerWithDefaults: ProviderDefinition = {
      ...provider,
      enabled: provider.enabled !== false,
      order: provider.order || 0,
      dependencies: provider.dependencies || [],
    };

    this.providers.set(provider.id, providerWithDefaults);

    // Track by plugin
    if (!this.providersByPlugin.has(provider.pluginId)) {
      this.providersByPlugin.set(provider.pluginId, new Set());
    }
    this.providersByPlugin.get(provider.pluginId)!.add(provider.id);

    console.log(`[ProviderRegistry] Registered provider: ${provider.id}`);
    this.notifySubscribers();
  }

  /**
   * Register multiple providers
   */
  public registerProviders(providers: ProviderDefinition[]): void {
    providers.forEach((provider) => this.registerProvider(provider));
  }

  /**
   * Unregister a provider
   */
  public unregisterProvider(providerId: string): void {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    this.providers.delete(providerId);

    // Remove from plugin tracking
    const pluginProviders = this.providersByPlugin.get(provider.pluginId);
    if (pluginProviders) {
      pluginProviders.delete(providerId);
    }

    console.log(`[ProviderRegistry] Unregistered provider: ${providerId}`);
    this.notifySubscribers();
  }

  /**
   * Unregister all providers from a plugin
   */
  public unregisterPluginProviders(pluginId: string): void {
    const providerIds = this.providersByPlugin.get(pluginId);
    if (!providerIds) return;

    providerIds.forEach((providerId) => {
      this.providers.delete(providerId);
    });

    this.providersByPlugin.delete(pluginId);
    console.log(`[ProviderRegistry] Unregistered all providers for plugin: ${pluginId}`);
    this.notifySubscribers();
  }

  /**
   * Get a provider by ID
   */
  public getProvider(providerId: string): ProviderDefinition | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all providers
   */
  public getProviders(): ProviderDefinition[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get enabled providers sorted by order and dependencies
   */
  public getEnabledProviders(): ProviderDefinition[] {
    const enabled = this.getProviders().filter((p) => p.enabled);
    return this.sortByDependencies(enabled);
  }

  /**
   * Get providers for a plugin
   */
  public getPluginProviders(pluginId: string): ProviderDefinition[] {
    const providerIds = this.providersByPlugin.get(pluginId);
    if (!providerIds) return [];

    return Array.from(providerIds)
      .map((id) => this.providers.get(id))
      .filter((p): p is ProviderDefinition => p !== undefined);
  }

  /**
   * Sort providers by dependencies and order
   * Uses topological sort to ensure dependencies are loaded first
   */
  private sortByDependencies(providers: ProviderDefinition[]): ProviderDefinition[] {
    const sorted: ProviderDefinition[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (provider: ProviderDefinition) => {
      if (visited.has(provider.id)) return;
      if (visiting.has(provider.id)) {
        console.warn(
          `[ProviderRegistry] Circular dependency detected for provider: ${provider.id}`
        );
        return;
      }

      visiting.add(provider.id);

      // Visit dependencies first
      if (provider.dependencies) {
        provider.dependencies.forEach((depId) => {
          const dep = this.providers.get(depId);
          if (dep && dep.enabled) {
            visit(dep);
          }
        });
      }

      visiting.delete(provider.id);
      visited.add(provider.id);
      sorted.push(provider);
    };

    // Sort providers by order first
    const orderedProviders = [...providers].sort((a, b) => (a.order || 0) - (b.order || 0));

    orderedProviders.forEach(visit);

    return sorted;
  }

  /**
   * Compose providers into a single component tree
   */
  public composeProviders(children: React.ReactNode): React.ReactNode {
    const providers = this.getEnabledProviders();

    return providers.reduceRight((acc, provider) => {
      const Provider = provider.component;
      return { type: Provider, props: { children: acc } };
    }, children);
  }

  /**
   * Subscribe to provider changes
   */
  public subscribe(callback: (providers: ProviderDefinition[]) => void): () => void {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers
   */
  private notifySubscribers(): void {
    const providers = this.getProviders();
    this.subscribers.forEach((callback) => {
      try {
        callback(providers);
      } catch (error) {
        console.error('[ProviderRegistry] Error in subscriber:', error);
      }
    });
  }

  /**
   * Clear all providers
   */
  public clear(): void {
    this.providers.clear();
    this.providersByPlugin.clear();
    console.log('[ProviderRegistry] Cleared all providers');
    this.notifySubscribers();
  }

  /**
   * Get registry stats
   */
  public getStats() {
    return {
      totalProviders: this.providers.size,
      enabledProviders: this.getEnabledProviders().length,
      plugins: this.providersByPlugin.size,
    };
  }
}

// Export singleton instance
export const providerRegistry = ProviderRegistry.getInstance();

export default ProviderRegistry;
