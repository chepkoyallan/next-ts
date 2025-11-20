// useNavigation Hook
// React hook for accessing dynamic navigation from NavigationRegistry
// ----------------------------------------------------------------------

'use client';

import { useState, useEffect } from 'react';
import { navigationRegistry, type NavigationItem } from '../navigation-registry';

/**
 * Hook to access all navigation items
 */
export function useNavigation() {
  const [items, setItems] = useState<NavigationItem[]>([]);

  useEffect(() => {
    setItems(navigationRegistry.getEnabledItems());

    const unsubscribe = navigationRegistry.subscribe((updatedItems) => {
      setItems(updatedItems.filter((item) => item.enabled));
    });

    return unsubscribe;
  }, []);

  return items;
}

/**
 * Hook to get navigation tree structure
 */
export function useNavigationTree() {
  const [tree, setTree] = useState<NavigationItem[]>([]);

  useEffect(() => {
    setTree(navigationRegistry.buildTree());

    const unsubscribe = navigationRegistry.subscribe(() => {
      setTree(navigationRegistry.buildTree());
    });

    return unsubscribe;
  }, []);

  return tree;
}

/**
 * Hook to get navigation by section
 */
export function useNavigationBySection() {
  const [sections, setSections] = useState<Map<string, NavigationItem[]>>(new Map());

  useEffect(() => {
    setSections(navigationRegistry.getNavigationBySection());

    const unsubscribe = navigationRegistry.subscribe(() => {
      setSections(navigationRegistry.getNavigationBySection());
    });

    return unsubscribe;
  }, []);

  return sections;
}

/**
 * Hook to get navigation items for current user
 */
export function useNavigationForUser(userRoles: string[]) {
  const [items, setItems] = useState<NavigationItem[]>([]);

  useEffect(() => {
    setItems(navigationRegistry.getItemsForUser(userRoles));

    const unsubscribe = navigationRegistry.subscribe(() => {
      setItems(navigationRegistry.getItemsForUser(userRoles));
    });

    return unsubscribe;
  }, [userRoles]);

  return items;
}

/**
 * Hook to get navigation items by section for current user
 */
export function useNavigationSectionsForUser(userRoles: string[]) {
  const [sections, setSections] = useState<Map<string, NavigationItem[]>>(new Map());

  useEffect(() => {
    const allSections = navigationRegistry.getNavigationBySection();
    const filteredSections = new Map<string, NavigationItem[]>();

    allSections.forEach((items, sectionId) => {
      const accessibleItems = items.filter((item) =>
        navigationRegistry.hasAccess(item.id, userRoles)
      );
      if (accessibleItems.length > 0) {
        filteredSections.set(sectionId, accessibleItems);
      }
    });

    setSections(filteredSections);

    const unsubscribe = navigationRegistry.subscribe(() => {
      const updatedSections = navigationRegistry.getNavigationBySection();
      const newFiltered = new Map<string, NavigationItem[]>();

      updatedSections.forEach((items, sectionId) => {
        const accessibleItems = items.filter((item) =>
          navigationRegistry.hasAccess(item.id, userRoles)
        );
        if (accessibleItems.length > 0) {
          newFiltered.set(sectionId, accessibleItems);
        }
      });

      setSections(newFiltered);
    });

    return unsubscribe;
  }, [userRoles]);

  return sections;
}

/**
 * Hook to get navigation statistics
 */
export function useNavigationStats() {
  const [stats, setStats] = useState(navigationRegistry.getStats());

  useEffect(() => {
    const unsubscribe = navigationRegistry.subscribe(() => {
      setStats(navigationRegistry.getStats());
    });

    return unsubscribe;
  }, []);

  return stats;
}

/**
 * Hook to get all navigation sections
 */
export function useNavigationSections() {
  const [sections, setSections] = useState(navigationRegistry.getSections());

  useEffect(() => {
    const unsubscribe = navigationRegistry.subscribe(() => {
      setSections(navigationRegistry.getSections());
    });

    return unsubscribe;
  }, []);

  return sections;
}
