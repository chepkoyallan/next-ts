// Plugin Manager
// Handles loading, registering, and managing plugins
// ----------------------------------------------------------------------

'use client';

import type { Plugin, PluginHooks, PluginStatus } from '@app/config/types';
import { getConfigManager } from '../config-manager';
import { routeRegistry } from '../registry/route-registry';
import { navigationRegistry } from '../registry/navigation-registry';
import { componentRegistry } from '../registry/component-registry';
import { providerRegistry } from '../registry/provider-registry';
import { hookRegistry } from '../registry/hook-registry';
import type { PluginManifest } from './plugin-manifest';
import {
  loadPluginManifest,
  validatePluginManifest,
  checkDependencies,
  sortPluginsByDependencies,
} from './plugin-manifest';

/**
 * Plugin Manager - Singleton
 * Manages plugin lifecycle, registration, and execution
 */
class PluginManager {
  private static instance: PluginManager;
  private loadedPlugins: Map<string, Plugin> = new Map();
  private pluginManifests: Map<string, PluginManifest> = new Map();
  private pluginInstances: Map<string, any> = new Map();
  private subscribers: Map<string, Set<(plugins: Plugin[]) => void>> = new Map();

  private constructor() {
    this.init();
  }

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * Initialize plugin manager
   */
  private init() {
    if (typeof window === 'undefined') return;

    // Load plugins from config
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    config.plugins.forEach((plugin) => {
      if (plugin.enabled) {
        this.loadPlugin(plugin);
      }
    });

    // Subscribe to config changes
    configManager.subscribe((newConfig) => {
      this.syncPlugins(newConfig.plugins);
    });
  }

  /**
   * Sync plugins with config
   */
  private syncPlugins(plugins: Plugin[]) {
    // Disable removed plugins
    this.loadedPlugins.forEach((loadedPlugin, id) => {
      const exists = plugins.find((p) => p.id === id);
      if (!exists || !exists.enabled) {
        this.unloadPlugin(id);
      }
    });

    // Load new or enabled plugins
    plugins.forEach((plugin) => {
      if (plugin.enabled && !this.loadedPlugins.has(plugin.id)) {
        this.loadPlugin(plugin);
      }
    });

    this.notifySubscribers();
  }

  /**
   * Load a plugin
   */
  private async loadPlugin(plugin: Plugin): Promise<void> {
    try {
      console.log(`[PluginManager] Loading plugin: ${plugin.name}`);

      // Update status
      this.updatePluginStatus(plugin.id, 'loading');

      // Register plugin routes
      if (plugin.routes && plugin.routes.length > 0) {
        routeRegistry.loadPluginRoutes(plugin);
      }

      // Register plugin navigation
      if (plugin.navigation && plugin.navigation.length > 0) {
        navigationRegistry.loadPluginNavigation(plugin);
      }

      // Register plugin components
      if (plugin.components) {
        Object.entries(plugin.components).forEach(([name, component]) => {
          componentRegistry.registerComponent({
            id: `${plugin.id}.${name}`,
            name,
            component,
            pluginId: plugin.id,
            category: plugin.id,
            enabled: plugin.enabled,
          });
        });
      }

      // Register plugin providers
      if (plugin.providers) {
        plugin.providers.forEach((provider, index) => {
          providerRegistry.registerProvider({
            id: `${plugin.id}.provider.${index}`,
            component: provider,
            pluginId: plugin.id,
            order: index,
            enabled: plugin.enabled,
          });
        });
      }

      // Register plugin hooks (event system)
      if (plugin.hooks?.definitions) {
        plugin.hooks.definitions.forEach((hookDef) => {
          hookRegistry.defineHook(hookDef.name, plugin.id, hookDef.description);
        });
      }

      // Execute onInit hook
      if (plugin.hooks?.onInit) {
        await plugin.hooks.onInit();
      }

      // Emit plugin loaded hook
      await hookRegistry.emit('plugin.loaded', { pluginId: plugin.id, plugin });

      // Store loaded plugin
      this.loadedPlugins.set(plugin.id, {
        ...plugin,
        status: 'active',
      });

      console.log(`[PluginManager] Plugin loaded: ${plugin.name}`);
      this.notifySubscribers();
    } catch (error) {
      console.error(`[PluginManager] Error loading plugin ${plugin.name}:`, error);
      this.updatePluginStatus(plugin.id, 'error');
    }
  }

  /**
   * Unload a plugin
   */
  private unloadPlugin(pluginId: string): void {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) return;

    console.log(`[PluginManager] Unloading plugin: ${plugin.name}`);

    // Emit plugin unloading hook
    hookRegistry.emit('plugin.unloading', { pluginId, plugin });

    // Unregister from all registries
    routeRegistry.unregisterPluginRoutes(pluginId);
    navigationRegistry.unregisterPluginItems(pluginId);
    componentRegistry.unregisterPluginComponents(pluginId);
    providerRegistry.unregisterPluginProviders(pluginId);
    hookRegistry.unsubscribePlugin(pluginId);

    // Execute onDestroy hook
    if (plugin.hooks?.onDestroy) {
      plugin.hooks.onDestroy();
    }

    // Clean up plugin instance
    this.pluginInstances.delete(pluginId);

    // Remove from loaded plugins
    this.loadedPlugins.delete(pluginId);

    this.notifySubscribers();
  }

  /**
   * Update plugin status
   */
  private updatePluginStatus(pluginId: string, status: PluginStatus) {
    const plugin = this.loadedPlugins.get(pluginId);
    if (plugin) {
      this.loadedPlugins.set(pluginId, { ...plugin, status });
      this.notifySubscribers();
    }
  }

  /**
   * Get all loaded plugins
   */
  public getLoadedPlugins(): Plugin[] {
    return Array.from(this.loadedPlugins.values());
  }

  /**
   * Get plugin by ID
   */
  public getPlugin(pluginId: string): Plugin | undefined {
    return this.loadedPlugins.get(pluginId);
  }

  /**
   * Get plugins by type
   */
  public getPluginsByType(type: Plugin['type']): Plugin[] {
    return this.getLoadedPlugins().filter((p) => p.type === type);
  }

  /**
   * Execute hook across all plugins
   */
  public async executeHook<K extends keyof PluginHooks>(
    hookName: K,
    ...args: Parameters<NonNullable<PluginHooks[K]>>
  ): Promise<void> {
    const plugins = this.getLoadedPlugins();

    for (const plugin of plugins) {
      if (plugin.hooks?.[hookName]) {
        try {
          // @ts-ignore - Complex type inference
          await plugin.hooks[hookName](...args);
        } catch (error) {
          console.error(
            `[PluginManager] Error executing hook ${String(hookName)} for plugin ${plugin.name}:`,
            error
          );
        }
      }
    }
  }

  /**
   * Get all routes from plugins
   */
  public getPluginRoutes() {
    const routes: Array<Plugin['routes']> = [];

    this.getLoadedPlugins().forEach((plugin) => {
      if (plugin.routes) {
        routes.push(...plugin.routes);
      }
    });

    return routes.flat();
  }

  /**
   * Get all navigation items from plugins
   */
  public getPluginNavItems() {
    const navItems: Array<Plugin['navigation']> = [];

    this.getLoadedPlugins().forEach((plugin) => {
      if (plugin.navigation) {
        navItems.push(...plugin.navigation);
      }
    });

    return navItems.flat();
  }

  /**
   * Get all layouts from plugins
   */
  public getPluginLayouts() {
    const layouts: Array<Plugin['layouts']> = [];

    this.getLoadedPlugins().forEach((plugin) => {
      if (plugin.layouts) {
        layouts.push(...plugin.layouts);
      }
    });

    return layouts.flat();
  }

  /**
   * Get all sections from plugins
   */
  public getPluginSections() {
    const sections: Array<Plugin['sections']> = [];

    this.getLoadedPlugins().forEach((plugin) => {
      if (plugin.sections) {
        sections.push(...plugin.sections);
      }
    });

    return sections.flat();
  }

  /**
   * Get component from plugin
   */
  public getComponent(
    pluginId: string,
    componentName: string
  ): React.ComponentType<any> | undefined {
    const plugin = this.loadedPlugins.get(pluginId);
    return plugin?.components?.[componentName];
  }

  /**
   * Subscribe to plugin changes
   */
  public subscribe(callback: (plugins: Plugin[]) => void): () => void {
    const id = Math.random().toString(36).substring(7);
    if (!this.subscribers.has('plugins')) {
      this.subscribers.set('plugins', new Set());
    }
    this.subscribers.get('plugins')!.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get('plugins')?.delete(callback);
    };
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers() {
    const plugins = this.getLoadedPlugins();
    this.subscribers.get('plugins')?.forEach((callback) => {
      callback(plugins);
    });
  }

  /**
   * Check if plugin has dependency conflicts
   */
  public checkDependencies(plugin: Plugin): { valid: boolean; missing: string[] } {
    if (!plugin.dependencies || plugin.dependencies.length === 0) {
      return { valid: true, missing: [] };
    }

    const missing: string[] = [];

    plugin.dependencies.forEach((depId) => {
      const dep = this.loadedPlugins.get(depId);
      if (!dep || !dep.enabled) {
        missing.push(depId);
      }
    });

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Register plugin (add to config)
   */
  public registerPlugin(plugin: Plugin): void {
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    const updatedPlugins = [...config.plugins, plugin];
    configManager.updateConfig({ plugins: updatedPlugins });
  }

  /**
   * Unregister plugin (remove from config)
   */
  public unregisterPlugin(pluginId: string): void {
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    const updatedPlugins = config.plugins.filter((p) => p.id !== pluginId);
    configManager.updateConfig({ plugins: updatedPlugins });
  }

  /**
   * Enable plugin
   */
  public enablePlugin(pluginId: string): void {
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    const updatedPlugins = config.plugins.map((p) =>
      p.id === pluginId ? { ...p, enabled: true } : p
    );
    configManager.updateConfig({ plugins: updatedPlugins });
  }

  /**
   * Disable plugin
   */
  public disablePlugin(pluginId: string): void {
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    const updatedPlugins = config.plugins.map((p) =>
      p.id === pluginId ? { ...p, enabled: false } : p
    );
    configManager.updateConfig({ plugins: updatedPlugins });
  }

  /**
   * Update plugin settings
   */
  public updatePluginSettings(pluginId: string, settings: Record<string, any>): void {
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    const updatedPlugins = config.plugins.map((p) =>
      p.id === pluginId ? { ...p, settings: { ...p.settings, ...settings } } : p
    );
    configManager.updateConfig({ plugins: updatedPlugins });
  }
}

// Export singleton instance
export const pluginManager = PluginManager.getInstance();

// Export class for testing
export { PluginManager };
