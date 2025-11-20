// useComponents Hook
// React hook for accessing dynamic components from ComponentRegistry
// ----------------------------------------------------------------------

'use client';

import { useState, useEffect } from 'react';
import { componentRegistry, type ComponentDefinition } from '../component-registry';

/**
 * Hook to get a component by ID (with override support)
 */
export function useComponent(componentId: string) {
  const [component, setComponent] = useState<React.ComponentType<any> | undefined>();

  useEffect(() => {
    setComponent(componentRegistry.getComponent(componentId));

    const unsubscribe = componentRegistry.subscribe(() => {
      setComponent(componentRegistry.getComponent(componentId));
    });

    return unsubscribe;
  }, [componentId]);

  return component;
}

/**
 * Hook to get all components
 */
export function useComponents() {
  const [components, setComponents] = useState<ComponentDefinition[]>([]);

  useEffect(() => {
    setComponents(componentRegistry.getEnabledComponents());

    const unsubscribe = componentRegistry.subscribe((updated) => {
      setComponents(updated.filter((c) => c.enabled));
    });

    return unsubscribe;
  }, []);

  return components;
}

/**
 * Hook to get components by category
 */
export function useComponentsByCategory(category: string) {
  const [components, setComponents] = useState<ComponentDefinition[]>([]);

  useEffect(() => {
    setComponents(componentRegistry.getComponentsByCategory(category));

    const unsubscribe = componentRegistry.subscribe(() => {
      setComponents(componentRegistry.getComponentsByCategory(category));
    });

    return unsubscribe;
  }, [category]);

  return components;
}

/**
 * Hook to get components by tag
 */
export function useComponentsByTag(tag: string) {
  const [components, setComponents] = useState<ComponentDefinition[]>([]);

  useEffect(() => {
    setComponents(componentRegistry.getComponentsByTag(tag));

    const unsubscribe = componentRegistry.subscribe(() => {
      setComponents(componentRegistry.getComponentsByTag(tag));
    });

    return unsubscribe;
  }, [tag]);

  return components;
}

/**
 * Hook to search components
 */
export function useComponentSearch(query: string) {
  const [components, setComponents] = useState<ComponentDefinition[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setComponents([]);
      return;
    }

    setComponents(componentRegistry.searchComponents(query));

    const unsubscribe = componentRegistry.subscribe(() => {
      setComponents(componentRegistry.searchComponents(query));
    });

    return unsubscribe;
  }, [query]);

  return components;
}

/**
 * Hook to get component statistics
 */
export function useComponentStats() {
  const [stats, setStats] = useState(componentRegistry.getStats());

  useEffect(() => {
    const unsubscribe = componentRegistry.subscribe(() => {
      setStats(componentRegistry.getStats());
    });

    return unsubscribe;
  }, []);

  return stats;
}

/**
 * Hook to get all categories
 */
export function useComponentCategories() {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    setCategories(componentRegistry.getCategories());

    const unsubscribe = componentRegistry.subscribe(() => {
      setCategories(componentRegistry.getCategories());
    });

    return unsubscribe;
  }, []);

  return categories;
}

/**
 * Hook to get all tags
 */
export function useComponentTags() {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    setTags(componentRegistry.getTags());

    const unsubscribe = componentRegistry.subscribe(() => {
      setTags(componentRegistry.getTags());
    });

    return unsubscribe;
  }, []);

  return tags;
}
