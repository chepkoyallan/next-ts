// Registry System
// Central export point for all registries
// ----------------------------------------------------------------------

export * from './route-registry';
export * from './navigation-registry';
export * from './provider-registry';
export * from './component-registry';
export * from './hook-registry';
export * from './api-registry';

// Re-export singleton instances
export { routeRegistry } from './route-registry';
export { navigationRegistry } from './navigation-registry';
export { providerRegistry } from './provider-registry';
export { componentRegistry } from './component-registry';
export { hookRegistry } from './hook-registry';
export { apiRegistry } from './api-registry';

// React Hooks
export * from './hooks';
