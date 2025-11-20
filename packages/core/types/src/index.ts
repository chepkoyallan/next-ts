// @app/types - Shared TypeScript types
// Central export point for all type definitions
// ----------------------------------------------------------------------

// Export all types from types.ts
export * from './types';

// Re-export commonly used types for convenience
export type {
  AppConfig,
  Plugin,
  PluginType,
  PluginStatus,
  APIEndpointConfig,
  CustomRole,
  CustomThemePreset,
  NavigationSectionConfig,
  CustomNavItem,
} from './types';
