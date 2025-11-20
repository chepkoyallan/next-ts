// Hook Registry
// Event-driven communication system for cross-plugin interaction
// ----------------------------------------------------------------------

'use client';

export type HookCallback<T = any> = (data: T) => void | Promise<void>;
export type HookFilter<T = any> = (data: T) => boolean;

export interface HookSubscription {
  /** Unique subscription ID */
  id: string;

  /** Hook name */
  hookName: string;

  /** Callback function */
  callback: HookCallback;

  /** Plugin that owns this subscription */
  pluginId: string;

  /** Priority (higher = runs first) */
  priority: number;

  /** Optional filter function */
  filter?: HookFilter;

  /** Is subscription active */
  enabled: boolean;
}

export interface HookDefinition {
  /** Hook name */
  name: string;

  /** Hook description */
  description?: string;

  /** Plugin that defined this hook */
  pluginId: string;

  /** Number of subscriptions */
  subscriberCount: number;

  /** Execution count */
  executionCount: number;

  /** Last execution timestamp */
  lastExecuted?: number;
}

/**
 * Hook Registry - Event-driven communication between plugins
 *
 * Enables plugins to:
 * - Define custom hooks that other plugins can subscribe to
 * - Subscribe to hooks from other plugins
 * - Emit events that trigger subscribed callbacks
 * - Filter events with conditional logic
 *
 * Example usage:
 * ```typescript
 * // Plugin A defines a hook
 * hookRegistry.defineHook('user.login', 'auth-plugin');
 *
 * // Plugin B subscribes to the hook
 * hookRegistry.subscribe('user.login', async (userData) => {
 *   console.log('User logged in:', userData);
 * }, 'analytics-plugin');
 *
 * // Plugin A emits the event
 * await hookRegistry.emit('user.login', { userId: 123, email: 'user@example.com' });
 * ```
 */
class HookRegistry {
  private static instance: HookRegistry;
  private hooks: Map<string, HookDefinition> = new Map();
  private subscriptions: Map<string, HookSubscription[]> = new Map();
  private subscriptionsByPlugin: Map<string, Set<string>> = new Map();
  private nextSubscriptionId = 1;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public static getInstance(): HookRegistry {
    if (!HookRegistry.instance) {
      HookRegistry.instance = new HookRegistry();
    }
    return HookRegistry.instance;
  }

  /**
   * Initialize hook registry
   */
  private init() {
    console.log('[HookRegistry] Initialized');
  }

  /**
   * Define a new hook
   */
  public defineHook(hookName: string, pluginId: string, description?: string): void {
    if (this.hooks.has(hookName)) {
      console.warn(`[HookRegistry] Hook ${hookName} already defined, overwriting`);
    }

    this.hooks.set(hookName, {
      name: hookName,
      description,
      pluginId,
      subscriberCount: 0,
      executionCount: 0,
    });

    console.log(`[HookRegistry] Defined hook: ${hookName} by plugin: ${pluginId}`);
  }

  /**
   * Subscribe to a hook
   */
  public subscribe<T = any>(
    hookName: string,
    callback: HookCallback<T>,
    pluginId: string,
    options: {
      priority?: number;
      filter?: HookFilter<T>;
      enabled?: boolean;
    } = {}
  ): string {
    const subscriptionId = `sub_${this.nextSubscriptionId++}`;

    const subscription: HookSubscription = {
      id: subscriptionId,
      hookName,
      callback,
      pluginId,
      priority: options.priority || 0,
      filter: options.filter,
      enabled: options.enabled !== false,
    };

    // Add to subscriptions
    if (!this.subscriptions.has(hookName)) {
      this.subscriptions.set(hookName, []);
    }
    this.subscriptions.get(hookName)!.push(subscription);

    // Sort by priority (higher first)
    this.subscriptions.get(hookName)!.sort((a, b) => b.priority - a.priority);

    // Track by plugin
    if (!this.subscriptionsByPlugin.has(pluginId)) {
      this.subscriptionsByPlugin.set(pluginId, new Set());
    }
    this.subscriptionsByPlugin.get(pluginId)!.add(subscriptionId);

    // Update hook definition
    const hook = this.hooks.get(hookName);
    if (hook) {
      hook.subscriberCount++;
    }

    console.log(
      `[HookRegistry] Plugin ${pluginId} subscribed to hook: ${hookName} (priority: ${subscription.priority})`
    );

    // Return unsubscribe function ID
    return subscriptionId;
  }

  /**
   * Unsubscribe from a hook
   */
  public unsubscribe(subscriptionId: string): void {
    let found = false;

    this.subscriptions.forEach((subs, hookName) => {
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index !== -1) {
        const subscription = subs[index];
        subs.splice(index, 1);

        // Remove from plugin tracking
        const pluginSubs = this.subscriptionsByPlugin.get(subscription.pluginId);
        if (pluginSubs) {
          pluginSubs.delete(subscriptionId);
        }

        // Update hook definition
        const hook = this.hooks.get(hookName);
        if (hook) {
          hook.subscriberCount--;
        }

        console.log(`[HookRegistry] Unsubscribed from hook: ${hookName}`);
        found = true;
      }
    });

    if (!found) {
      console.warn(`[HookRegistry] Subscription ${subscriptionId} not found`);
    }
  }

  /**
   * Unsubscribe all hooks for a plugin
   */
  public unsubscribePlugin(pluginId: string): void {
    const subscriptionIds = this.subscriptionsByPlugin.get(pluginId);
    if (!subscriptionIds) return;

    const ids = Array.from(subscriptionIds);
    ids.forEach((id) => this.unsubscribe(id));

    this.subscriptionsByPlugin.delete(pluginId);
    console.log(`[HookRegistry] Unsubscribed all hooks for plugin: ${pluginId}`);
  }

  /**
   * Emit a hook event (parallel execution)
   */
  public async emit<T = any>(hookName: string, data: T): Promise<void> {
    const subscriptions = this.subscriptions.get(hookName);
    if (!subscriptions || subscriptions.length === 0) {
      console.debug(`[HookRegistry] No subscribers for hook: ${hookName}`);
      return;
    }

    // Update hook stats
    const hook = this.hooks.get(hookName);
    if (hook) {
      hook.executionCount++;
      hook.lastExecuted = Date.now();
    }

    // Filter and execute subscriptions in parallel
    const promises = subscriptions
      .filter((sub) => sub.enabled)
      .filter((sub) => !sub.filter || sub.filter(data))
      .map(async (sub) => {
        try {
          await sub.callback(data);
        } catch (error) {
          console.error(
            `[HookRegistry] Error in subscription ${sub.id} for hook ${hookName}:`,
            error
          );
        }
      });

    await Promise.all(promises);
    console.debug(`[HookRegistry] Emitted hook: ${hookName} to ${promises.length} subscribers`);
  }

  /**
   * Emit a hook event (sequential execution)
   */
  public async emitSequential<T = any>(hookName: string, data: T): Promise<void> {
    const subscriptions = this.subscriptions.get(hookName);
    if (!subscriptions || subscriptions.length === 0) {
      console.debug(`[HookRegistry] No subscribers for hook: ${hookName}`);
      return;
    }

    // Update hook stats
    const hook = this.hooks.get(hookName);
    if (hook) {
      hook.executionCount++;
      hook.lastExecuted = Date.now();
    }

    // Execute subscriptions sequentially
    for (const sub of subscriptions) {
      if (!sub.enabled) continue;
      if (sub.filter && !sub.filter(data)) continue;

      try {
        await sub.callback(data);
      } catch (error) {
        console.error(
          `[HookRegistry] Error in subscription ${sub.id} for hook ${hookName}:`,
          error
        );
      }
    }

    console.debug(
      `[HookRegistry] Emitted hook sequentially: ${hookName} to ${subscriptions.length} subscribers`
    );
  }

  /**
   * Emit a hook event with data transformation (reduce pattern)
   */
  public async emitReduce<T = any, R = T>(
    hookName: string,
    initialData: T,
    reducer: (acc: R, result: any) => R,
    initialAccumulator: R
  ): Promise<R> {
    const subscriptions = this.subscriptions.get(hookName);
    if (!subscriptions || subscriptions.length === 0) {
      return initialAccumulator;
    }

    // Update hook stats
    const hook = this.hooks.get(hookName);
    if (hook) {
      hook.executionCount++;
      hook.lastExecuted = Date.now();
    }

    let accumulator = initialAccumulator;

    // Execute subscriptions sequentially and reduce results
    for (const sub of subscriptions) {
      if (!sub.enabled) continue;
      if (sub.filter && !sub.filter(initialData)) continue;

      try {
        const result = await sub.callback(initialData);
        accumulator = reducer(accumulator, result);
      } catch (error) {
        console.error(
          `[HookRegistry] Error in subscription ${sub.id} for hook ${hookName}:`,
          error
        );
      }
    }

    return accumulator;
  }

  /**
   * Get all defined hooks
   */
  public getHooks(): HookDefinition[] {
    return Array.from(this.hooks.values());
  }

  /**
   * Get hook by name
   */
  public getHook(hookName: string): HookDefinition | undefined {
    return this.hooks.get(hookName);
  }

  /**
   * Get hooks defined by a plugin
   */
  public getPluginHooks(pluginId: string): HookDefinition[] {
    return Array.from(this.hooks.values()).filter((h) => h.pluginId === pluginId);
  }

  /**
   * Get subscriptions for a hook
   */
  public getSubscriptions(hookName: string): HookSubscription[] {
    return this.subscriptions.get(hookName) || [];
  }

  /**
   * Get subscriptions for a plugin
   */
  public getPluginSubscriptions(pluginId: string): HookSubscription[] {
    const subscriptionIds = this.subscriptionsByPlugin.get(pluginId);
    if (!subscriptionIds) return [];

    const allSubscriptions: HookSubscription[] = [];
    this.subscriptions.forEach((subs) => {
      subs.forEach((sub) => {
        if (subscriptionIds.has(sub.id)) {
          allSubscriptions.push(sub);
        }
      });
    });

    return allSubscriptions;
  }

  /**
   * Check if a hook exists
   */
  public hasHook(hookName: string): boolean {
    return this.hooks.has(hookName);
  }

  /**
   * Enable/disable a subscription
   */
  public setSubscriptionEnabled(subscriptionId: string, enabled: boolean): void {
    let found = false;

    this.subscriptions.forEach((subs) => {
      const sub = subs.find((s) => s.id === subscriptionId);
      if (sub) {
        sub.enabled = enabled;
        found = true;
      }
    });

    if (!found) {
      console.warn(`[HookRegistry] Subscription ${subscriptionId} not found`);
    }
  }

  /**
   * Clear all hooks and subscriptions
   */
  public clear(): void {
    this.hooks.clear();
    this.subscriptions.clear();
    this.subscriptionsByPlugin.clear();
    console.log('[HookRegistry] Cleared all hooks and subscriptions');
  }

  /**
   * Get registry statistics
   */
  public getStats() {
    return {
      totalHooks: this.hooks.size,
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce(
        (sum, subs) => sum + subs.length,
        0
      ),
      activeSubscriptions: Array.from(this.subscriptions.values()).reduce(
        (sum, subs) => sum + subs.filter((s) => s.enabled).length,
        0
      ),
      plugins: this.subscriptionsByPlugin.size,
    };
  }
}

// Export singleton instance
export const hookRegistry = HookRegistry.getInstance();

export default HookRegistry;
