// React Hooks for Plugin System
// ----------------------------------------------------------------------

'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Plugin } from '@app/types';
import { pluginManager } from './plugin-manager';

/**
 * Hook to get all loaded plugins
 */
export function usePlugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);

  useEffect(() => {
    // Initial load
    setPlugins(pluginManager.getLoadedPlugins());

    // Subscribe to changes
    const unsubscribe = pluginManager.subscribe((updatedPlugins) => {
      setPlugins(updatedPlugins);
    });

    return unsubscribe;
  }, []);

  return {
    plugins,
    loading: false,
  };
}

/**
 * Hook to get a specific plugin
 */
export function usePlugin(pluginId: string) {
  const { plugins } = usePlugins();

  const plugin = useMemo(() => plugins.find((p) => p.id === pluginId), [plugins, pluginId]);

  return plugin;
}

/**
 * Hook to get plugins by type
 */
export function usePluginsByType(type: Plugin['type']) {
  const { plugins } = usePlugins();

  const filteredPlugins = useMemo(() => plugins.filter((p) => p.type === type), [plugins, type]);

  return filteredPlugins;
}

/**
 * Hook to get all plugin routes
 */
export function usePluginRoutes() {
  const { plugins } = usePlugins();

  const routes = useMemo(() => pluginManager.getPluginRoutes(), [plugins]);

  return routes;
}

/**
 * Hook to get all plugin navigation items
 */
export function usePluginNavigation() {
  const { plugins } = usePlugins();

  const navItems = useMemo(() => pluginManager.getPluginNavItems(), [plugins]);

  return navItems;
}

/**
 * Hook to get all plugin layouts
 */
export function usePluginLayouts() {
  const { plugins } = usePlugins();

  const layouts = useMemo(() => pluginManager.getPluginLayouts(), [plugins]);

  return layouts;
}

/**
 * Hook to get all plugin sections
 */
export function usePluginSections() {
  const { plugins } = usePlugins();

  const sections = useMemo(() => pluginManager.getPluginSections(), [plugins]);

  return sections;
}

/**
 * Hook to get a component from a plugin
 */
export function usePluginComponent(pluginId: string, componentName: string) {
  const plugin = usePlugin(pluginId);

  const component = useMemo(() => plugin?.components?.[componentName], [plugin, componentName]);

  return component;
}

/**
 * Hook to check plugin dependencies
 */
export function usePluginDependencies(plugin: Plugin) {
  const result = useMemo(() => pluginManager.checkDependencies(plugin), [plugin]);

  return result;
}
