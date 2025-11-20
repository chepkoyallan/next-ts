// useHooks Hook
// React hooks for accessing the Hook Registry (event system)
// ----------------------------------------------------------------------

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  hookRegistry,
  type HookDefinition,
  type HookSubscription,
  type HookCallback,
  type HookFilter,
} from '../hook-registry';

/**
 * Hook to get all defined hooks
 */
export function useHooks() {
  const [hooks, setHooks] = useState<HookDefinition[]>([]);

  useEffect(() => {
    const updateHooks = () => {
      setHooks(hookRegistry.getHooks());
    };

    updateHooks();

    // Poll for updates (since HookRegistry doesn't have subscribers yet)
    const interval = setInterval(updateHooks, 1000);

    return () => clearInterval(interval);
  }, []);

  return hooks;
}

/**
 * Hook to get a specific hook by name
 */
export function useHook(hookName: string) {
  const [hook, setHook] = useState<HookDefinition | undefined>();

  useEffect(() => {
    const updateHook = () => {
      setHook(hookRegistry.getHook(hookName));
    };

    updateHook();

    const interval = setInterval(updateHook, 1000);

    return () => clearInterval(interval);
  }, [hookName]);

  return hook;
}

/**
 * Hook to subscribe to a hook event
 */
export function useHookSubscription<T = any>(
  hookName: string,
  callback: HookCallback<T>,
  pluginId: string,
  options: {
    priority?: number;
    filter?: HookFilter<T>;
    enabled?: boolean;
  } = {}
) {
  useEffect(() => {
    if (!hookName || !callback) return;

    const subscriptionId = hookRegistry.subscribe(hookName, callback, pluginId, options);

    return () => {
      hookRegistry.unsubscribe(subscriptionId);
    };
  }, [hookName, callback, pluginId, options.priority, options.enabled]);
}

/**
 * Hook to emit a hook event
 */
export function useHookEmitter<T = any>(hookName: string) {
  const emit = useCallback(
    async (data: T) => {
      await hookRegistry.emit(hookName, data);
    },
    [hookName]
  );

  const emitSequential = useCallback(
    async (data: T) => {
      await hookRegistry.emitSequential(hookName, data);
    },
    [hookName]
  );

  return { emit, emitSequential };
}

/**
 * Hook to get subscriptions for a hook
 */
export function useHookSubscriptions(hookName: string) {
  const [subscriptions, setSubscriptions] = useState<HookSubscription[]>([]);

  useEffect(() => {
    const updateSubscriptions = () => {
      setSubscriptions(hookRegistry.getSubscriptions(hookName));
    };

    updateSubscriptions();

    const interval = setInterval(updateSubscriptions, 1000);

    return () => clearInterval(interval);
  }, [hookName]);

  return subscriptions;
}

/**
 * Hook to get hooks defined by a plugin
 */
export function usePluginHooks(pluginId: string) {
  const [hooks, setHooks] = useState<HookDefinition[]>([]);

  useEffect(() => {
    const updateHooks = () => {
      setHooks(hookRegistry.getPluginHooks(pluginId));
    };

    updateHooks();

    const interval = setInterval(updateHooks, 1000);

    return () => clearInterval(interval);
  }, [pluginId]);

  return hooks;
}

/**
 * Hook to get subscriptions for a plugin
 */
export function usePluginSubscriptions(pluginId: string) {
  const [subscriptions, setSubscriptions] = useState<HookSubscription[]>([]);

  useEffect(() => {
    const updateSubscriptions = () => {
      setSubscriptions(hookRegistry.getPluginSubscriptions(pluginId));
    };

    updateSubscriptions();

    const interval = setInterval(updateSubscriptions, 1000);

    return () => clearInterval(interval);
  }, [pluginId]);

  return subscriptions;
}

/**
 * Hook to check if a hook exists
 */
export function useHookExists(hookName: string) {
  const [exists, setExists] = useState(false);

  useEffect(() => {
    const updateExists = () => {
      setExists(hookRegistry.hasHook(hookName));
    };

    updateExists();

    const interval = setInterval(updateExists, 1000);

    return () => clearInterval(interval);
  }, [hookName]);

  return exists;
}

/**
 * Hook to get hook registry statistics
 */
export function useHookStats() {
  const [stats, setStats] = useState(hookRegistry.getStats());

  useEffect(() => {
    const updateStats = () => {
      setStats(hookRegistry.getStats());
    };

    const interval = setInterval(updateStats, 1000);

    return () => clearInterval(interval);
  }, []);

  return stats;
}

/**
 * Hook to define a new hook
 */
export function useHookDefinition(hookName: string, pluginId: string, description?: string) {
  useEffect(() => {
    if (!hookName || !pluginId) return;

    hookRegistry.defineHook(hookName, pluginId, description);

    // Cleanup: Note that we don't undefine hooks on unmount
    // as they may be used by other components
  }, [hookName, pluginId, description]);
}

/**
 * Advanced hook for lifecycle events
 * Provides common lifecycle hooks that components can subscribe to
 */
export function useLifecycleHooks(
  pluginId: string,
  handlers: {
    onMount?: HookCallback;
    onUnmount?: HookCallback;
    onUpdate?: HookCallback;
    onError?: HookCallback<Error>;
  }
) {
  useEffect(() => {
    const subscriptions: string[] = [];

    if (handlers.onMount) {
      const id = hookRegistry.subscribe('lifecycle.mount', handlers.onMount, pluginId);
      subscriptions.push(id);
      // Emit mount event
      hookRegistry.emit('lifecycle.mount', { pluginId });
    }

    if (handlers.onUpdate) {
      const id = hookRegistry.subscribe('lifecycle.update', handlers.onUpdate, pluginId);
      subscriptions.push(id);
    }

    if (handlers.onError) {
      const id = hookRegistry.subscribe('lifecycle.error', handlers.onError, pluginId);
      subscriptions.push(id);
    }

    return () => {
      if (handlers.onUnmount) {
        hookRegistry.emit('lifecycle.unmount', { pluginId });
      }

      subscriptions.forEach((id) => hookRegistry.unsubscribe(id));
    };
  }, [pluginId, handlers.onMount, handlers.onUnmount, handlers.onUpdate, handlers.onError]);
}
