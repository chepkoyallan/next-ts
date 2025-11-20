'use client';

import isEqual from 'lodash/isEqual';
import { useMemo, useState, useEffect, useCallback } from 'react';

import { useLocalStorage } from '@app/hooks/use-local-storage';

import { localStorageGetItem } from '@app/utils/storage-available';

import { useConfig } from '@app/config';

import { SettingsValueProps } from '../types';
import { SettingsContext } from './settings-context';

// ----------------------------------------------------------------------

const STORAGE_KEY = 'settings';

type SettingsProviderProps = {
  children: React.ReactNode;
  defaultSettings: SettingsValueProps;
};

export function SettingsProvider({ children, defaultSettings }: SettingsProviderProps) {
  const { state, update, reset } = useLocalStorage(STORAGE_KEY, defaultSettings);
  const { config, setValue: setConfigValue } = useConfig();

  const [openDrawer, setOpenDrawer] = useState(false);

  const isArabic = localStorageGetItem('i18nextLng') === 'ar';

  // Sync config system with settings on mount
  useEffect(() => {
    if (config.ui) {
      // Sync theme mode
      if (state.themeMode !== config.ui.defaultTheme) {
        update('themeMode', config.ui.defaultTheme);
      }
      // Sync color preset
      if (state.themeColorPresets !== config.ui.defaultColorPreset) {
        update('themeColorPresets', config.ui.defaultColorPreset);
      }
      // Sync layout
      if (state.themeLayout !== config.ui.defaultLayout) {
        update('themeLayout', config.ui.defaultLayout);
      }
      // Sync contrast
      if (state.themeContrast !== config.ui.defaultContrast) {
        update('themeContrast', config.ui.defaultContrast);
      }
      // Sync stretch
      if (state.themeStretch !== config.ui.defaultStretch) {
        update('themeStretch', config.ui.defaultStretch);
      }
    }
  }, [config.ui, state, update]);

  useEffect(() => {
    if (isArabic) {
      onChangeDirectionByLang('ar');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArabic]);

  // Direction by lang
  const onChangeDirectionByLang = useCallback(
    (lang: string) => {
      update('themeDirection', lang === 'ar' ? 'rtl' : 'ltr');
    },
    [update]
  );

  // Drawer
  const onToggleDrawer = useCallback(() => {
    setOpenDrawer((prev) => !prev);
  }, []);

  const onCloseDrawer = useCallback(() => {
    setOpenDrawer(false);
  }, []);

  const canReset = !isEqual(state, defaultSettings);

  const memoizedValue = useMemo(
    () => ({
      ...state,
      onUpdate: update,
      // Direction
      onChangeDirectionByLang,
      // Reset
      canReset,
      onReset: reset,
      // Drawer
      open: openDrawer,
      onToggle: onToggleDrawer,
      onClose: onCloseDrawer,
    }),
    [
      reset,
      update,
      state,
      canReset,
      openDrawer,
      onCloseDrawer,
      onToggleDrawer,
      onChangeDirectionByLang,
    ]
  );

  return <SettingsContext.Provider value={memoizedValue}>{children}</SettingsContext.Provider>;
}
