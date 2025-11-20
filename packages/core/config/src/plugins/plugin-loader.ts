/**
 * Plugin Auto-Discovery Loader
 * Automatically discovers and loads plugins from the features directory
 */

import type { Plugin } from '../types';
import type { PluginManifest } from './plugin-manifest';
import {
  loadPluginManifest,
  validatePluginManifest,
  sortPluginsByDependencies,
} from './plugin-manifest';

/**
 * Auto-discovered plugin manifests
 * This will be populated by the build-time plugin discovery
 */
const discoveredManifests: PluginManifest[] = [];

/**
 * Get all discovered plugin manifests
 */
export function getDiscoveredManifests(): PluginManifest[] {
  return discoveredManifests;
}

/**
 * Discover plugins from the features directory
 * This runs at build time and generates the plugin manifest list
 */
export async function discoverPlugins(): Promise<PluginManifest[]> {
  if (typeof window !== 'undefined') {
    // Client-side: use pre-discovered manifests
    return discoveredManifests;
  }

  // Server-side: dynamically discover plugins
  const fs = await import('fs');
  const path = await import('path');

  const manifests: PluginManifest[] = [];
  const featuresDir = path.join(process.cwd(), 'packages', 'features');

  if (!fs.existsSync(featuresDir)) {
    console.warn('[PluginLoader] Features directory not found:', featuresDir);
    return [];
  }

  const pluginDirs = fs.readdirSync(featuresDir);

  for (const dir of pluginDirs) {
    const pluginPath = path.join(featuresDir, dir);
    const manifestPath = path.join(pluginPath, 'plugin.json');

    // Skip if not a directory or no manifest
    if (!fs.statSync(pluginPath).isDirectory() || !fs.existsSync(manifestPath)) {
      continue;
    }

    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // Validate manifest
      const validation = validatePluginManifest(manifest);
      if (!validation.valid) {
        console.error(`[PluginLoader] Invalid manifest for ${dir}:`, validation.errors);
        continue;
      }

      // Only include enabled plugins
      if (manifest.enabled !== false) {
        manifests.push(manifest);
      }
    } catch (error) {
      console.error(`[PluginLoader] Error loading manifest for ${dir}:`, error);
    }
  }

  // Sort by dependencies
  return sortPluginsByDependencies(manifests);
}

/**
 * Convert manifest to Plugin object with dynamic imports
 */
export async function manifestToPlugin(manifest: PluginManifest): Promise<Plugin | null> {
  try {
    // Dynamically import the plugin module
    const pluginModule = await import(
      /* @vite-ignore */
      `@app/${manifest.id}`
    ).catch(async () => {
      // Try alternative import path
      return import(
        /* @vite-ignore */
        `../../../features/${manifest.id}`
      );
    });

    // Get the plugin export (could be default or named export matching plugin.ts convention)
    const pluginExport =
      pluginModule.default ||
      pluginModule[`${manifest.id}Plugin`] ||
      pluginModule[`${toCamelCase(manifest.id)}Plugin`];

    if (!pluginExport) {
      console.warn(
        `[PluginLoader] No plugin export found for ${manifest.id}, creating from manifest`
      );
      // Create plugin from manifest
      return createPluginFromManifest(manifest);
    }

    // Merge manifest with plugin export
    return {
      ...pluginExport,
      ...manifest,
      // Preserve functions from plugin export
      hooks: pluginExport.hooks || {},
      components: pluginExport.components || {},
      providers: pluginExport.providers || [],
    } as Plugin;
  } catch (error) {
    console.error(`[PluginLoader] Error loading plugin ${manifest.id}:`, error);
    // Fallback: create plugin from manifest only
    return createPluginFromManifest(manifest);
  }
}

/**
 * Create a basic plugin from manifest
 */
function createPluginFromManifest(manifest: PluginManifest): Plugin {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    enabled: manifest.enabled !== false,
    type: 'full',
    status: 'inactive',
    routes: manifest.routes || [],
    navigation: manifest.navigation || [],
    components: {},
    providers: [],
    hooks: {},
    settings: manifest.config || {},
    dependencies: manifest.dependencies?.map((dep) => dep.id) || [],
    metadata: manifest.metadata || {},
    source: 'local',
    installDate: new Date().toISOString(),
    isSystem: false,
  };
}

/**
 * Convert kebab-case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Load all auto-discovered plugins
 */
export async function loadAutoDiscoveredPlugins(): Promise<Plugin[]> {
  const manifests = await discoverPlugins();
  const plugins: Plugin[] = [];

  for (const manifest of manifests) {
    try {
      const plugin = await manifestToPlugin(manifest);
      if (plugin) {
        plugins.push(plugin);
      }
    } catch (error) {
      console.error(`[PluginLoader] Failed to load plugin ${manifest.id}:`, error);
    }
  }

  return plugins;
}

/**
 * Initialize plugin discovery (call this once at startup)
 */
export async function initializePluginDiscovery(): Promise<Plugin[]> {
  console.log('[PluginLoader] Discovering plugins...');

  try {
    const plugins = await loadAutoDiscoveredPlugins();
    console.log(`[PluginLoader] Discovered ${plugins.length} plugins`);

    // Log discovered plugins
    plugins.forEach((plugin) => {
      console.log(
        `[PluginLoader] - ${plugin.name} (${plugin.id}) v${plugin.version} [${plugin.enabled ? 'enabled' : 'disabled'}]`
      );
    });

    return plugins;
  } catch (error) {
    console.error('[PluginLoader] Error during plugin discovery:', error);
    return [];
  }
}
