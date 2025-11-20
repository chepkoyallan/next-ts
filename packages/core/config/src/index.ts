// Configuration System
// Central export point for all configuration-related modules
// ----------------------------------------------------------------------

// Types
export * from './types';

// Core Configuration
export { defaultConfig } from './default-config';
export { getConfigManager } from './config-manager';
export type { default as ConfigManager } from './config-manager';

// Hooks
export * from './hooks/use-config';
export * from './hooks/use-roles';

// Plugin System (New)
export { pluginManager } from './plugins/plugin-manager';
export * from './plugins/use-plugins';
export * from './plugins/plugin-loader';
export * from './plugins/plugin-manifest';
export * from './plugins/auto-discovered-plugins';

// Registry System (Dynamic Module Management)
export * from './registry';

// Metadata
export * from './use-config-metadata';
