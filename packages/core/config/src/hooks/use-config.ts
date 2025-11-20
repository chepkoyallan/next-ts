'use client';

import { useState, useEffect, useCallback } from 'react';

import { AppConfig } from '../types';
import { getConfigManager } from '../config-manager';

// Hook to access and subscribe to configuration
// ----------------------------------------------------------------------

export function useConfig() {
  const configManager = getConfigManager();
  const [config, setConfig] = useState<AppConfig>(configManager.getConfig());

  useEffect(() => {
    // Subscribe to config changes
    const unsubscribe = configManager.subscribe((newConfig) => {
      setConfig(newConfig);
    });

    return unsubscribe;
  }, [configManager]);

  const updateConfig = useCallback(
    (updates: Partial<AppConfig>) => {
      configManager.updateConfig(updates);
    },
    [configManager]
  );

  const resetConfig = useCallback(() => {
    configManager.resetConfig();
  }, [configManager]);

  const getValue = useCallback(
    <T = any>(path: string): T | undefined => configManager.getValue<T>(path),
    [configManager]
  );

  const setValue = useCallback(
    (path: string, value: any) => {
      configManager.setValue(path, value);
    },
    [configManager]
  );

  return {
    config,
    updateConfig,
    resetConfig,
    getValue,
    setValue,
  };
}

// Hook to check if a feature is enabled
// ----------------------------------------------------------------------

export function useFeature(feature: keyof AppConfig['features']): boolean {
  const { config } = useConfig();
  return config.features[feature];
}

// Hook to check if a module is enabled
// ----------------------------------------------------------------------

export function useModule(module: keyof AppConfig['modules']) {
  const { config } = useConfig();
  const moduleConfig = config.modules[module];

  return {
    enabled: moduleConfig.enabled,
    permissions: moduleConfig.permissions,
    hidden: moduleConfig.hidden,
    badge: moduleConfig.badge,
    beta: moduleConfig.beta,
  };
}

// Hook to check module permissions
// ----------------------------------------------------------------------

export function useModulePermission(
  module: keyof AppConfig['modules'],
  userRoles: string[]
): boolean {
  const configManager = getConfigManager();
  const [hasPermission, setHasPermission] = useState<boolean>(
    configManager.hasModulePermission(module, userRoles)
  );

  useEffect(() => {
    const unsubscribe = configManager.subscribe(() => {
      setHasPermission(configManager.hasModulePermission(module, userRoles));
    });

    return unsubscribe;
  }, [configManager, module, userRoles]);

  return hasPermission;
}

// Hook for UI configuration
// ----------------------------------------------------------------------

export function useUIConfig() {
  const { config } = useConfig();
  return config.ui;
}

// Hook for navigation configuration
// ----------------------------------------------------------------------

export function useNavigationConfig() {
  const { config } = useConfig();
  return config.navigation;
}

// Hook for auth configuration
// ----------------------------------------------------------------------

export function useAuthConfig() {
  const { config } = useConfig();
  return config.auth;
}

// Hook for branding configuration
// ----------------------------------------------------------------------

export function useBrandingConfig() {
  const { config } = useConfig();
  return config.branding;
}

// Hook for notification configuration
// ----------------------------------------------------------------------

export function useNotificationConfig() {
  const { config } = useConfig();
  return config.notifications;
}

// Hook for table configuration
// ----------------------------------------------------------------------

export function useTableConfig() {
  const { config } = useConfig();
  return config.table;
}

// Hook for form configuration
// ----------------------------------------------------------------------

export function useFormConfig() {
  const { config } = useConfig();
  return config.form;
}

// Hook for API configuration
// ----------------------------------------------------------------------

export function useAPIConfig() {
  const { config } = useConfig();
  return config.api;
}

// Hook for localization configuration
// ----------------------------------------------------------------------

export function useLocalizationConfig() {
  const { config } = useConfig();
  return config.localization;
}

// Hook for performance configuration
// ----------------------------------------------------------------------

export function usePerformanceConfig() {
  const { config } = useConfig();
  return config.performance;
}

// Hook for security configuration
// ----------------------------------------------------------------------

export function useSecurityConfig() {
  const { config } = useConfig();
  return config.security;
}

// Hook for analytics configuration
// ----------------------------------------------------------------------

export function useAnalyticsConfig() {
  const { config } = useConfig();
  return config.analytics;
}
