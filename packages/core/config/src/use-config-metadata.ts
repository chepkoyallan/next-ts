'use client';

import { useConfig } from './hooks/use-config';

// Hook to get configuration-based metadata
// Use this in layout.tsx or page.tsx for dynamic meta tags
// ----------------------------------------------------------------------

export function useConfigMetadata() {
  const { config } = useConfig();

  return {
    title: config.branding?.appName || 'Dashboard',
    description: config.branding?.metaDescription || 'Application dashboard',
    keywords: config.branding?.metaKeywords || '',
    applicationName: config.branding?.appName || 'App',
    authors: [{ name: config.branding?.companyName || 'Company' }],
    creator: config.branding?.companyName || 'Company',
    publisher: config.branding?.companyName || 'Company',
    icons: {
      icon: config.branding?.favicon || '/favicon/favicon.ico',
    },
    themeColor: config.branding?.primaryColor || '#00AB55',
  };
}

// Server-side metadata generator (for app directory)
// Import getConfigManager for server components
// ----------------------------------------------------------------------

export function getConfigBasedMetadata() {
  try {
    const { getConfigManager } = require('./config-manager');
    const configManager = getConfigManager();
    const config = configManager.getConfig();

    return {
      title: config.branding?.appName || 'Dashboard',
      description: config.branding?.metaDescription || 'Application dashboard',
      keywords: config.branding?.metaKeywords || '',
      applicationName: config.branding?.appName || 'App',
      authors: [{ name: config.branding?.companyName || 'Company' }],
      creator: config.branding?.companyName || 'Company',
      publisher: config.branding?.companyName || 'Company',
      icons: {
        icon: config.branding?.favicon || '/favicon/favicon.ico',
      },
      themeColor: config.branding?.primaryColor || '#00AB55',
      openGraph: {
        title: config.branding?.metaTitle || config.branding?.appName || 'Dashboard',
        description: config.branding?.metaDescription || 'Application dashboard',
        siteName: config.branding?.appName || 'App',
      },
      twitter: {
        card: 'summary_large_image',
        title: config.branding?.metaTitle || config.branding?.appName || 'Dashboard',
        description: config.branding?.metaDescription || 'Application dashboard',
      },
    };
  } catch {
    // Fallback if config not available
    return {
      title: 'Dashboard',
      description: 'Application dashboard',
    };
  }
}
