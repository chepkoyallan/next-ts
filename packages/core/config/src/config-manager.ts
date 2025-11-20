import merge from 'lodash/merge';

import { defaultConfig } from './default-config';
import { AppConfig, TenantConfig, ConfigOverride } from './types';

// Configuration Manager
// Handles loading, merging, and accessing configuration
// ----------------------------------------------------------------------

class ConfigManager {
  private config: AppConfig;

  private overrides: ConfigOverride[] = [];

  private tenantConfig: TenantConfig | null = null;

  private customConfig: Partial<AppConfig> | null = null;

  private listeners: Set<(config: AppConfig) => void> = new Set();

  private pluginsLoaded: boolean = false;

  constructor() {
    this.config = { ...defaultConfig };
    this.loadFromEnvironment();
    this.loadFromLocalStorage();
    this.initializePlugins();
  }

  /**
   * Initialize auto-discovered plugins
   */
  private async initializePlugins(): Promise<void> {
    if (this.pluginsLoaded) return;

    try {
      // Dynamic import to avoid circular dependencies
      const { initializePluginDiscovery } = await import('./plugins/plugin-loader');
      const discoveredPlugins = await initializePluginDiscovery();

      if (discoveredPlugins.length > 0) {
        this.config.plugins = discoveredPlugins;
        this.pluginsLoaded = true;
        this.notifyListeners();
        console.log(`[ConfigManager] Loaded ${discoveredPlugins.length} plugins via auto-discovery`);
      }
    } catch (error) {
      console.error('[ConfigManager] Failed to load plugins:', error);
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    // Environment variables are already loaded in defaultConfig
    // This method can be extended for additional env-based config
  }

  /**
   * Load configuration from localStorage
   */
  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('app-config');
      if (stored) {
        const parsedConfig = JSON.parse(stored);
        this.customConfig = parsedConfig;
        this.mergeConfigs();
      }
    } catch (error) {
      console.error('Failed to load config from localStorage:', error);
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveToLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      if (this.customConfig) {
        localStorage.setItem('app-config', JSON.stringify(this.customConfig));
      }
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
    }
  }

  /**
   * Merge all configuration sources
   */
  private mergeConfigs(): void {
    // Start with default config
    let merged = { ...defaultConfig };

    // Apply custom config
    if (this.customConfig) {
      merged = merge({}, merged, this.customConfig);
    }

    // Apply tenant config
    if (this.tenantConfig) {
      const { tenantId, tenantName, subdomain, customDomain, active, ...tenantSettings } =
        this.tenantConfig;
      merged = merge({}, merged, tenantSettings);
    }

    // Apply overrides sorted by priority
    const sortedOverrides = [...this.overrides].sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    sortedOverrides.forEach((override) => {
      const { priority, ...overrideConfig } = override;
      merged = merge({}, merged, overrideConfig);
    });

    this.config = merged;
    this.notifyListeners();
  }

  /**
   * Get the current configuration
   */
  public getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Get a specific configuration value
   */
  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * Get a nested configuration value using dot notation
   */
  public getValue<T = any>(path: string): T | undefined {
    const keys = path.split('.');
    let value: any = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value as T;
  }

  /**
   * Set a configuration value
   */
  public setValue(path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop();

    if (!lastKey) return;

    if (!this.customConfig) {
      this.customConfig = {};
    }

    let target: any = this.customConfig;

    for (const key of keys) {
      if (!(key in target)) {
        target[key] = {};
      }
      target = target[key];
    }

    target[lastKey] = value;
    this.mergeConfigs();
    this.saveToLocalStorage();
  }

  /**
   * Update configuration (merge with existing)
   */
  public updateConfig(updates: Partial<AppConfig>): void {
    this.customConfig = merge({}, this.customConfig, updates);
    this.mergeConfigs();
    this.saveToLocalStorage();
  }

  /**
   * Reset configuration to defaults
   */
  public resetConfig(): void {
    this.customConfig = null;
    this.overrides = [];
    this.tenantConfig = null;
    this.mergeConfigs();

    if (typeof window !== 'undefined') {
      localStorage.removeItem('app-config');
    }
  }

  /**
   * Add a configuration override
   */
  public addOverride(override: ConfigOverride): void {
    this.overrides.push(override);
    this.mergeConfigs();
  }

  /**
   * Remove all overrides
   */
  public clearOverrides(): void {
    this.overrides = [];
    this.mergeConfigs();
  }

  /**
   * Set tenant configuration
   */
  public setTenantConfig(config: TenantConfig | null): void {
    this.tenantConfig = config;
    this.mergeConfigs();
  }

  /**
   * Get tenant configuration
   */
  public getTenantConfig(): TenantConfig | null {
    return this.tenantConfig;
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    return this.config.features[feature];
  }

  /**
   * Check if a module is enabled
   */
  public isModuleEnabled(module: keyof AppConfig['modules']): boolean {
    return this.config.modules[module].enabled;
  }

  /**
   * Check if user has permission for a module
   */
  public hasModulePermission(module: keyof AppConfig['modules'], userRoles: string[]): boolean {
    const moduleConfig = this.config.modules[module];

    if (!moduleConfig.enabled) return false;
    if (moduleConfig.permissions.length === 0) return true;

    return userRoles.some((role) => moduleConfig.permissions.includes(role));
  }

  /**
   * Subscribe to configuration changes
   */
  public subscribe(listener: (config: AppConfig) => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.config);
      } catch (error) {
        console.error('Error in config listener:', error);
      }
    });
  }

  /**
   * Export configuration as JSON
   */
  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  public importConfig(json: string): boolean {
    try {
      const imported = JSON.parse(json);
      this.customConfig = imported;
      this.mergeConfigs();
      this.saveToLocalStorage();
      return true;
    } catch (error) {
      console.error('Failed to import config:', error);
      return false;
    }
  }

  /**
   * Validate configuration
   */
  public validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate feature flags
    if (!this.config.features) {
      errors.push('Missing features configuration');
    }

    // Validate modules
    if (!this.config.modules) {
      errors.push('Missing modules configuration');
    }

    // Validate UI config
    if (!this.config.ui) {
      errors.push('Missing UI configuration');
    }

    // Validate auth config
    if (!this.config.auth) {
      errors.push('Missing authentication configuration');
    } else if (this.config.auth.passwordPolicy.minLength < 6) {
      errors.push('Password minimum length should be at least 6 characters');
    }

    // Validate API config
    if (!this.config.api?.baseURL) {
      errors.push('API baseURL is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
let configManagerInstance: ConfigManager | null = null;

export const getConfigManager = (): ConfigManager => {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
};

export default ConfigManager;
