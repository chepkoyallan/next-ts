// Component Registry
// Dynamic component discovery and override system
// ----------------------------------------------------------------------

'use client';

export interface ComponentDefinition {
  /** Unique component identifier */
  id: string;

  /** Component name */
  name: string;

  /** Component implementation */
  component: React.ComponentType<any>;

  /** Plugin that owns this component */
  pluginId: string;

  /** Component category/group */
  category?: string;

  /** Component tags for discovery */
  tags?: string[];

  /** Component version */
  version?: string;

  /** Is component enabled */
  enabled?: boolean;

  /** Component props schema (for documentation) */
  propsSchema?: Record<string, any>;

  /** Component description */
  description?: string;

  /** Override priority (higher = used first) */
  priority?: number;
}

export interface ComponentOverride {
  /** Component ID being overridden */
  componentId: string;

  /** Override component */
  component: React.ComponentType<any>;

  /** Override source */
  source: string;

  /** Override priority */
  priority: number;

  /** Condition for when to apply override */
  condition?: () => boolean;
}

/**
 * Component Registry - Manages dynamic component discovery and overrides
 */
class ComponentRegistry {
  private static instance: ComponentRegistry;
  private components: Map<string, ComponentDefinition> = new Map();
  private componentsByPlugin: Map<string, Set<string>> = new Map();
  private componentsByCategory: Map<string, Set<string>> = new Map();
  private overrides: Map<string, ComponentOverride[]> = new Map();
  private subscribers: Set<(components: ComponentDefinition[]) => void> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public static getInstance(): ComponentRegistry {
    if (!ComponentRegistry.instance) {
      ComponentRegistry.instance = new ComponentRegistry();
    }
    return ComponentRegistry.instance;
  }

  /**
   * Initialize component registry
   */
  private init() {
    console.log('[ComponentRegistry] Initialized');
  }

  /**
   * Register a component
   */
  public registerComponent(component: ComponentDefinition): void {
    if (this.components.has(component.id)) {
      console.warn(
        `[ComponentRegistry] Component ${component.id} already registered, overwriting`
      );
    }

    const componentWithDefaults: ComponentDefinition = {
      ...component,
      enabled: component.enabled !== false,
      priority: component.priority || 0,
      version: component.version || '1.0.0',
      tags: component.tags || [],
    };

    this.components.set(component.id, componentWithDefaults);

    // Track by plugin
    if (!this.componentsByPlugin.has(component.pluginId)) {
      this.componentsByPlugin.set(component.pluginId, new Set());
    }
    this.componentsByPlugin.get(component.pluginId)!.add(component.id);

    // Track by category
    if (component.category) {
      if (!this.componentsByCategory.has(component.category)) {
        this.componentsByCategory.set(component.category, new Set());
      }
      this.componentsByCategory.get(component.category)!.add(component.id);
    }

    console.log(`[ComponentRegistry] Registered component: ${component.name} (${component.id})`);
    this.notifySubscribers();
  }

  /**
   * Register multiple components
   */
  public registerComponents(components: ComponentDefinition[]): void {
    components.forEach((component) => this.registerComponent(component));
  }

  /**
   * Unregister a component
   */
  public unregisterComponent(componentId: string): void {
    const component = this.components.get(componentId);
    if (!component) return;

    this.components.delete(componentId);

    // Remove from plugin tracking
    const pluginComponents = this.componentsByPlugin.get(component.pluginId);
    if (pluginComponents) {
      pluginComponents.delete(componentId);
    }

    // Remove from category tracking
    if (component.category) {
      const categoryComponents = this.componentsByCategory.get(component.category);
      if (categoryComponents) {
        categoryComponents.delete(componentId);
      }
    }

    // Remove overrides
    this.overrides.delete(componentId);

    console.log(`[ComponentRegistry] Unregistered component: ${componentId}`);
    this.notifySubscribers();
  }

  /**
   * Unregister all components from a plugin
   */
  public unregisterPluginComponents(pluginId: string): void {
    const componentIds = this.componentsByPlugin.get(pluginId);
    if (!componentIds) return;

    componentIds.forEach((componentId) => {
      const component = this.components.get(componentId);
      if (component && component.category) {
        const categoryComponents = this.componentsByCategory.get(component.category);
        if (categoryComponents) {
          categoryComponents.delete(componentId);
        }
      }
      this.components.delete(componentId);
      this.overrides.delete(componentId);
    });

    this.componentsByPlugin.delete(pluginId);
    console.log(`[ComponentRegistry] Unregistered all components for plugin: ${pluginId}`);
    this.notifySubscribers();
  }

  /**
   * Get a component by ID (with override support)
   */
  public getComponent(componentId: string): React.ComponentType<any> | undefined {
    // Check for overrides first
    const overrides = this.overrides.get(componentId);
    if (overrides && overrides.length > 0) {
      // Sort by priority and find first applicable override
      const sortedOverrides = [...overrides].sort((a, b) => b.priority - a.priority);

      for (const override of sortedOverrides) {
        if (!override.condition || override.condition()) {
          return override.component;
        }
      }
    }

    // Return original component
    const component = this.components.get(componentId);
    return component?.enabled ? component.component : undefined;
  }

  /**
   * Get component definition
   */
  public getComponentDefinition(componentId: string): ComponentDefinition | undefined {
    return this.components.get(componentId);
  }

  /**
   * Get all components
   */
  public getComponents(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }

  /**
   * Get enabled components
   */
  public getEnabledComponents(): ComponentDefinition[] {
    return this.getComponents().filter((c) => c.enabled);
  }

  /**
   * Get components for a plugin
   */
  public getPluginComponents(pluginId: string): ComponentDefinition[] {
    const componentIds = this.componentsByPlugin.get(pluginId);
    if (!componentIds) return [];

    return Array.from(componentIds)
      .map((id) => this.components.get(id))
      .filter((c): c is ComponentDefinition => c !== undefined);
  }

  /**
   * Get components by category
   */
  public getComponentsByCategory(category: string): ComponentDefinition[] {
    const componentIds = this.componentsByCategory.get(category);
    if (!componentIds) return [];

    return Array.from(componentIds)
      .map((id) => this.components.get(id))
      .filter((c): c is ComponentDefinition => c !== undefined && c.enabled);
  }

  /**
   * Get components by tag
   */
  public getComponentsByTag(tag: string): ComponentDefinition[] {
    return this.getEnabledComponents().filter((c) => c.tags && c.tags.includes(tag));
  }

  /**
   * Search components by name or description
   */
  public searchComponents(query: string): ComponentDefinition[] {
    const lowerQuery = query.toLowerCase();
    return this.getEnabledComponents().filter(
      (c) =>
        c.name.toLowerCase().includes(lowerQuery) ||
        (c.description && c.description.toLowerCase().includes(lowerQuery)) ||
        (c.tags && c.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)))
    );
  }

  /**
   * Register a component override
   */
  public registerOverride(override: ComponentOverride): void {
    if (!this.overrides.has(override.componentId)) {
      this.overrides.set(override.componentId, []);
    }

    this.overrides.get(override.componentId)!.push(override);

    console.log(
      `[ComponentRegistry] Registered override for component: ${override.componentId} from ${override.source}`
    );
    this.notifySubscribers();
  }

  /**
   * Remove a component override
   */
  public removeOverride(componentId: string, source: string): void {
    const overrides = this.overrides.get(componentId);
    if (!overrides) return;

    const filtered = overrides.filter((o) => o.source !== source);
    if (filtered.length > 0) {
      this.overrides.set(componentId, filtered);
    } else {
      this.overrides.delete(componentId);
    }

    console.log(`[ComponentRegistry] Removed override for ${componentId} from ${source}`);
    this.notifySubscribers();
  }

  /**
   * Get all categories
   */
  public getCategories(): string[] {
    return Array.from(this.componentsByCategory.keys());
  }

  /**
   * Get all tags
   */
  public getTags(): string[] {
    const tags = new Set<string>();
    this.getComponents().forEach((c) => {
      if (c.tags) {
        c.tags.forEach((tag) => tags.add(tag));
      }
    });
    return Array.from(tags);
  }

  /**
   * Subscribe to component changes
   */
  public subscribe(callback: (components: ComponentDefinition[]) => void): () => void {
    this.subscribers.add(callback);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers
   */
  private notifySubscribers(): void {
    const components = this.getComponents();
    this.subscribers.forEach((callback) => {
      try {
        callback(components);
      } catch (error) {
        console.error('[ComponentRegistry] Error in subscriber:', error);
      }
    });
  }

  /**
   * Clear all components
   */
  public clear(): void {
    this.components.clear();
    this.componentsByPlugin.clear();
    this.componentsByCategory.clear();
    this.overrides.clear();
    console.log('[ComponentRegistry] Cleared all components');
    this.notifySubscribers();
  }

  /**
   * Get registry stats
   */
  public getStats() {
    return {
      totalComponents: this.components.size,
      enabledComponents: this.getEnabledComponents().length,
      plugins: this.componentsByPlugin.size,
      categories: this.componentsByCategory.size,
      overrides: this.overrides.size,
      tags: this.getTags().length,
    };
  }
}

// Export singleton instance
export const componentRegistry = ComponentRegistry.getInstance();

export default ComponentRegistry;
