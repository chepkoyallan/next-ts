// Example Analytics Plugin
// Demonstrates how to create a plugin with routes, nav items, and hooks
// ----------------------------------------------------------------------

'use client';

import type { Plugin } from '@app/config/types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

// Example plugin component
function AnalyticsDashboard() {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Analytics Dashboard (Plugin)
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            This is an example analytics dashboard loaded from a plugin!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Plugins can provide:
          </Typography>
          <ul>
            <li>Custom routes and pages</li>
            <li>Navigation items</li>
            <li>Lifecycle hooks</li>
            <li>Custom components</li>
            <li>API endpoints</li>
          </ul>
        </CardContent>
      </Card>
    </Box>
  );
}

// Plugin definition
export const analyticsPlugin: Plugin = {
  id: 'analytics-pro',
  name: 'Analytics Pro',
  version: '1.0.0',
  description: 'Advanced analytics dashboard with custom metrics',
  author: 'Your Company',
  enabled: false,
  type: 'ui',
  status: 'inactive',

  // Routes provided by plugin
  routes: [
    {
      path: '/analytics-pro',
      component: AnalyticsDashboard,
      protected: true,
      layout: 'dashboard',
      meta: {
        title: 'Analytics Pro',
        description: 'Advanced analytics dashboard',
      },
    },
  ],

  // Navigation items
  navigation: [
    {
      id: 'analytics-pro',
      title: 'Analytics Pro',
      path: '/analytics-pro',
      icon: 'solar:chart-2-bold-duotone',
      section: 'overview',
      order: 100,
      badge: 'PRO',
    },
  ],

  // Lifecycle hooks
  hooks: {
    onInit: async () => {
      console.log('[Analytics Pro Plugin] Initialized');
    },
    onAuth: async (user) => {
      console.log('[Analytics Pro Plugin] User authenticated:', user?.id);
    },
    onError: (error) => {
      console.error('[Analytics Pro Plugin] Error:', error);
    },
  },

  // Plugin settings
  settings: {
    trackingEnabled: true,
    refreshInterval: 30000,
    showCharts: true,
  },

  // Dependencies
  dependencies: [],

  // Metadata
  metadata: {
    homepage: 'https://example.com/analytics-pro',
    repository: 'https://github.com/example/analytics-pro',
    license: 'MIT',
    tags: ['analytics', 'dashboard', 'metrics'],
  },

  installDate: new Date().toISOString(),
  source: 'local',
  isSystem: false,
};
