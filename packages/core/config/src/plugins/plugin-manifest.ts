// Plugin Manifest
// JSON-based plugin configuration and metadata
// ----------------------------------------------------------------------

export interface PluginDependency {
  /** Plugin ID */
  id: string;

  /** Required version (semver) */
  version?: string;

  /** Is this dependency optional */
  optional?: boolean;
}

export interface PluginPermissions {
  /** Can access user data */
  userData?: boolean;

  /** Can access navigation */
  navigation?: boolean;

  /** Can register routes */
  routes?: boolean;

  /** Can register components */
  components?: boolean;

  /** Can register providers */
  providers?: boolean;

  /** Can emit hooks */
  hooks?: boolean;

  /** Custom permissions */
  custom?: string[];
}

export interface PluginAsset {
  /** Asset type */
  type: 'css' | 'js' | 'image' | 'font' | 'other';

  /** Asset path (relative to plugin root) */
  path: string;

  /** Load priority */
  priority?: number;

  /** Load conditions */
  condition?: 'always' | 'lazy' | 'on-demand';
}

export interface PluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface PluginManifest {
  /** Plugin metadata */
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: PluginAuthor | string;
  license?: string;
  homepage?: string;
  repository?: string;

  /** Plugin behavior */
  enabled?: boolean;
  autoLoad?: boolean;
  priority?: number;

  /** Dependencies */
  dependencies?: PluginDependency[];
  peerDependencies?: PluginDependency[];

  /** Permissions */
  permissions?: PluginPermissions;

  /** Assets */
  assets?: PluginAsset[];

  /** Entry points */
  main?: string;
  client?: string;
  server?: string;

  /** Configuration */
  config?: Record<string, any>;

  /** Routes */
  routes?: Array<{
    id: string;
    path: string;
    layout?: string;
    protected?: boolean;
    roles?: string[];
    priority?: number;
  }>;

  /** Navigation items */
  navigation?: Array<{
    id: string;
    title: string;
    path?: string;
    icon?: string;
    section?: string;
    order?: number;
    roles?: string[];
  }>;

  /** Component registrations */
  components?: Array<{
    id: string;
    name: string;
    category?: string;
    tags?: string[];
  }>;

  /** Provider registrations */
  providers?: Array<{
    id: string;
    order?: number;
    dependencies?: string[];
  }>;

  /** Hook definitions */
  hooks?: Array<{
    name: string;
    description?: string;
  }>;

  /** Lifecycle hooks */
  lifecycle?: {
    onInit?: string;
    onLoad?: string;
    onUnload?: string;
    onDestroy?: string;
    onError?: string;
  };

  /** Feature flags */
  features?: string[];

  /** Minimum platform version required */
  minVersion?: string;

  /** Maximum platform version supported */
  maxVersion?: string;

  /** Environment requirements */
  environment?: {
    node?: string;
    browser?: string[];
  };

  /** Custom metadata */
  metadata?: Record<string, any>;
}

/**
 * Load and parse a plugin manifest from JSON
 */
export async function loadPluginManifest(path: string): Promise<PluginManifest> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.statusText}`);
    }

    const manifest: PluginManifest = await response.json();

    // Validate required fields
    if (!manifest.id) {
      throw new Error('Plugin manifest missing required field: id');
    }
    if (!manifest.name) {
      throw new Error('Plugin manifest missing required field: name');
    }
    if (!manifest.version) {
      throw new Error('Plugin manifest missing required field: version');
    }

    // Set defaults
    manifest.enabled = manifest.enabled !== false;
    manifest.autoLoad = manifest.autoLoad !== false;
    manifest.priority = manifest.priority || 0;

    return manifest;
  } catch (error) {
    console.error(`[PluginManifest] Error loading manifest from ${path}:`, error);
    throw error;
  }
}

/**
 * Validate plugin manifest
 */
export function validatePluginManifest(manifest: PluginManifest): ValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!manifest.id) {
    errors.push('Missing required field: id');
  }
  if (!manifest.name) {
    errors.push('Missing required field: name');
  }
  if (!manifest.version) {
    errors.push('Missing required field: version');
  }

  // If required fields are missing, return early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate version format (basic semver check)
  const versionRegex = /^\d+\.\d+\.\d+/;
  if (!versionRegex.test(manifest.version)) {
    errors.push(`Invalid version format: ${manifest.version} (expected semver format like 1.0.0)`);
  }

  // Validate dependencies
  if (manifest.dependencies) {
    for (const dep of manifest.dependencies) {
      if (!dep.id) {
        errors.push('Dependency missing id');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Check if plugin dependencies are satisfied
 */
export function checkDependencies(
  manifest: PluginManifest,
  loadedPlugins: Map<string, PluginManifest>
): { satisfied: boolean; missing: string[] } {
  const missing: string[] = [];

  if (manifest.dependencies) {
    for (const dep of manifest.dependencies) {
      const loadedPlugin = loadedPlugins.get(dep.id);

      if (!loadedPlugin) {
        if (!dep.optional) {
          missing.push(dep.id);
        }
        continue;
      }

      // Basic version check (can be enhanced with proper semver)
      if (dep.version && loadedPlugin.version !== dep.version) {
        console.warn(
          `[PluginManifest] Version mismatch for ${dep.id}: expected ${dep.version}, got ${loadedPlugin.version}`
        );
      }
    }
  }

  return {
    satisfied: missing.length === 0,
    missing,
  };
}

/**
 * Sort plugins by dependencies (topological sort)
 */
export function sortPluginsByDependencies(
  manifests: PluginManifest[]
): PluginManifest[] {
  const sorted: PluginManifest[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const manifestMap = new Map(manifests.map((m) => [m.id, m]));

  const visit = (manifest: PluginManifest) => {
    if (visited.has(manifest.id)) return;
    if (visiting.has(manifest.id)) {
      console.warn(`[PluginManifest] Circular dependency detected: ${manifest.id}`);
      return;
    }

    visiting.add(manifest.id);

    // Visit dependencies first
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (dep.optional) continue;
        const depManifest = manifestMap.get(dep.id);
        if (depManifest) {
          visit(depManifest);
        }
      }
    }

    visiting.delete(manifest.id);
    visited.add(manifest.id);
    sorted.push(manifest);
  };

  // Sort by priority first
  const orderedManifests = [...manifests].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  orderedManifests.forEach(visit);

  return sorted;
}

/**
 * Merge plugin config with defaults
 */
export function mergePluginConfig<T = any>(
  manifest: PluginManifest,
  userConfig?: Record<string, any>
): T {
  return {
    ...(manifest.config || {}),
    ...(userConfig || {}),
  } as T;
}

export default PluginManifest;
