import type { Plugin } from '@app/types';

export const dashboardPlugin: Plugin = {
  id: 'dashboard',
  name: 'Dashboard',
  version: '1.0.0',
  description: 'Application dashboard and overview',
  author: 'Core Team',
  enabled: true,
  type: 'ui',
  status: 'inactive',

  routes: [
    { path: '/dashboard', component: 'OverviewAppView', layout: 'dashboard' },
    { path: '/dashboard/app', component: 'OverviewAppView', layout: 'dashboard' },
  ],

  navigation: [
    {
      title: 'Dashboard',
      path: '/dashboard',
      icon: 'solar:widget-5-bold-duotone',
    },
  ],

  components: {
    OverviewAppView: () => import('./view/overview-app-view'),
  },

  hooks: {
    onInit: async () => {
      console.log('[Dashboard Plugin] Initialized');
    },
  },

  settings: {},
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['dashboard', 'overview', 'analytics'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: true,
};

export default dashboardPlugin;
