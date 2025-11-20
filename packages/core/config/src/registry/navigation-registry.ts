// Navigation Registry
// Dynamic navigation menu management system
// ----------------------------------------------------------------------

'use client';

import type { Plugin } from '../types';

export interface NavigationItem {
  /** Unique identifier */
  id: string;

  /** Display title */
  title: string;

  /** Navigation path */
  path?: string;

  /** Icon name (Iconify format) */
  icon?: string;

  /** Plugin that owns this item */
  pluginId: string;

  /** Parent navigation item ID (for nested menus) */
  parentId?: string;

  /** Children navigation items */
  children?: NavigationItem[];

  /** Navigation section/group */
  section?: string;

  /** Display order (lower = first) */
  order?: number;

  /** Is item enabled */
  enabled?: boolean;

  /** Required roles to see this item */
  roles?: string[];

  /** Badge configuration */
  badge?: {
    label: string;
    color?: 'default' | 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';
  };

  /** External link */
  external?: boolean;

  /** Open in new tab */
  newTab?: boolean;

  /** Custom metadata */
  meta?: Record<string, any>;
}

export interface NavigationSection {
  id: string;
  title: string;
  order: number;
  enabled?: boolean;
  roles?: string[];
}

/**
 * Navigation Registry - Manages dynamic navigation menus
 */
class NavigationRegistry {
  private static instance: NavigationRegistry;
  private items: Map<string, NavigationItem> = new Map();
  private sections: Map<string, NavigationSection> = new Map();
  private itemsByPlugin: Map<string, Set<string>> = new Map();
  private itemsBySection: Map<string, Set<string>> = new Map();
  private subscribers: Set<(items: NavigationItem[]) => void> = new Set();

  private constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public static getInstance(): NavigationRegistry {
    if (!NavigationRegistry.instance) {
      NavigationRegistry.instance = new NavigationRegistry();
    }
    return NavigationRegistry.instance;
  }

  /**
   * Initialize navigation registry
   */
  private init() {
    // Register default sections
    this.registerSection({
      id: 'overview',
      title: 'Overview',
      order: 0,
      enabled: true,
    });

    this.registerSection({
      id: 'management',
      title: 'Management',
      order: 1,
      enabled: true,
    });

    this.registerSection({
      id: 'ecommerce',
      title: 'E-Commerce',
      order: 2,
      enabled: true,
    });

    console.log('[NavigationRegistry] Initialized');
  }

  /**
   * Register a navigation item
   */
  public registerItem(item: NavigationItem): void {
    if (this.items.has(item.id)) {
      console.warn(`[NavigationRegistry] Item ${item.id} already registered, overwriting`);
    }

    // Set defaults
    const itemWithDefaults: NavigationItem = {
      ...item,
      enabled: item.enabled !== false,
      order: item.order || 0,
      external: item.external || false,
      newTab: item.newTab || false,
    };

    this.items.set(item.id, itemWithDefaults);

    // Track by plugin
    if (!this.itemsByPlugin.has(item.pluginId)) {
      this.itemsByPlugin.set(item.pluginId, new Set());
    }
    this.itemsByPlugin.get(item.pluginId)!.add(item.id);

    // Track by section
    if (item.section) {
      if (!this.itemsBySection.has(item.section)) {
        this.itemsBySection.set(item.section, new Set());
      }
      this.itemsBySection.get(item.section)!.add(item.id);
    }

    console.log(`[NavigationRegistry] Registered navigation item: ${item.title} (${item.id})`);
    this.notifySubscribers();
  }

  /**
   * Register multiple navigation items
   */
  public registerItems(items: NavigationItem[]): void {
    items.forEach((item) => this.registerItem(item));
  }

  /**
   * Unregister a navigation item
   */
  public unregisterItem(itemId: string): void {
    const item = this.items.get(itemId);
    if (!item) return;

    this.items.delete(itemId);

    // Remove from plugin tracking
    const pluginItems = this.itemsByPlugin.get(item.pluginId);
    if (pluginItems) {
      pluginItems.delete(itemId);
    }

    // Remove from section tracking
    if (item.section) {
      const sectionItems = this.itemsBySection.get(item.section);
      if (sectionItems) {
        sectionItems.delete(itemId);
      }
    }

    console.log(`[NavigationRegistry] Unregistered navigation item: ${itemId}`);
    this.notifySubscribers();
  }

  /**
   * Unregister all items from a plugin
   */
  public unregisterPluginItems(pluginId: string): void {
    const itemIds = this.itemsByPlugin.get(pluginId);
    if (!itemIds) return;

    itemIds.forEach((itemId) => {
      const item = this.items.get(itemId);
      if (item && item.section) {
        const sectionItems = this.itemsBySection.get(item.section);
        if (sectionItems) {
          sectionItems.delete(itemId);
        }
      }
      this.items.delete(itemId);
    });

    this.itemsByPlugin.delete(pluginId);
    console.log(`[NavigationRegistry] Unregistered all items for plugin: ${pluginId}`);
    this.notifySubscribers();
  }

  /**
   * Get a navigation item by ID
   */
  public getItem(itemId: string): NavigationItem | undefined {
    return this.items.get(itemId);
  }

  /**
   * Get all navigation items
   */
  public getItems(): NavigationItem[] {
    return Array.from(this.items.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get enabled navigation items
   */
  public getEnabledItems(): NavigationItem[] {
    return this.getItems().filter((item) => item.enabled);
  }

  /**
   * Get items for a plugin
   */
  public getPluginItems(pluginId: string): NavigationItem[] {
    const itemIds = this.itemsByPlugin.get(pluginId);
    if (!itemIds) return [];

    return Array.from(itemIds)
      .map((id) => this.items.get(id))
      .filter((item): item is NavigationItem => item !== undefined)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get items by section
   */
  public getItemsBySection(sectionId: string): NavigationItem[] {
    const itemIds = this.itemsBySection.get(sectionId);
    if (!itemIds) return [];

    return Array.from(itemIds)
      .map((id) => this.items.get(id))
      .filter((item): item is NavigationItem => item !== undefined && item.enabled)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Get top-level items (no parent)
   */
  public getTopLevelItems(): NavigationItem[] {
    return this.getEnabledItems().filter((item) => !item.parentId);
  }

  /**
   * Get children of a navigation item
   */
  public getChildren(parentId: string): NavigationItem[] {
    return this.getEnabledItems()
      .filter((item) => item.parentId === parentId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  /**
   * Build navigation tree structure
   */
  public buildTree(): NavigationItem[] {
    const topLevel = this.getTopLevelItems();

    const buildChildren = (item: NavigationItem): NavigationItem => {
      const children = this.getChildren(item.id);
      return {
        ...item,
        children: children.length > 0 ? children.map(buildChildren) : undefined,
      };
    };

    return topLevel.map(buildChildren);
  }

  /**
   * Get navigation by section (organized)
   */
  public getNavigationBySection(): Map<string, NavigationItem[]> {
    const result = new Map<string, NavigationItem[]>();
    const sections = this.getSections().filter((s) => s.enabled);

    sections.forEach((section) => {
      const items = this.getItemsBySection(section.id);
      if (items.length > 0) {
        result.set(section.id, items);
      }
    });

    return result;
  }

  /**
   * Check if user has access to navigation item
   */
  public hasAccess(itemId: string, userRoles: string[]): boolean {
    const item = this.items.get(itemId);
    if (!item || !item.enabled) return false;
    if (!item.roles || item.roles.length === 0) return true;

    return userRoles.some((role) => item.roles!.includes(role));
  }

  /**
   * Filter items by user roles
   */
  public getItemsForUser(userRoles: string[]): NavigationItem[] {
    return this.getEnabledItems().filter((item) => this.hasAccess(item.id, userRoles));
  }

  /**
   * Register a navigation section
   */
  public registerSection(section: NavigationSection): void {
    this.sections.set(section.id, { ...section, enabled: section.enabled !== false });
    console.log(`[NavigationRegistry] Registered section: ${section.title}`);
  }

  /**
   * Get a section
   */
  public getSection(sectionId: string): NavigationSection | undefined {
    return this.sections.get(sectionId);
  }

  /**
   * Get all sections
   */
  public getSections(): NavigationSection[] {
    return Array.from(this.sections.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Load navigation from plugin
   */
  public loadPluginNavigation(plugin: Plugin): void {
    if (!plugin.navigation || plugin.navigation.length === 0) return;

    const items: NavigationItem[] = plugin.navigation.map((nav) => ({
      id: `${plugin.id}.nav.${nav.id}`,
      title: nav.title,
      path: nav.path,
      icon: nav.icon,
      pluginId: plugin.id,
      section: nav.section,
      order: nav.order,
      enabled: plugin.enabled,
      roles: nav.roles,
    }));

    this.registerItems(items);
  }

  /**
   * Subscribe to navigation changes
   */
  public subscribe(callback: (items: NavigationItem[]) => void): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers of navigation changes
   */
  private notifySubscribers(): void {
    const items = this.getItems();
    this.subscribers.forEach((callback) => {
      try {
        callback(items);
      } catch (error) {
        console.error('[NavigationRegistry] Error in subscriber:', error);
      }
    });
  }

  /**
   * Clear all navigation items
   */
  public clear(): void {
    this.items.clear();
    this.itemsByPlugin.clear();
    this.itemsBySection.clear();
    console.log('[NavigationRegistry] Cleared all items');
    this.notifySubscribers();
  }

  /**
   * Get registry stats
   */
  public getStats() {
    return {
      totalItems: this.items.size,
      enabledItems: this.getEnabledItems().length,
      topLevelItems: this.getTopLevelItems().length,
      plugins: this.itemsByPlugin.size,
      sections: this.sections.size,
    };
  }
}

// Export singleton instance
export const navigationRegistry = NavigationRegistry.getInstance();

export default NavigationRegistry;
