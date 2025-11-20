import type { Plugin } from '@app/types';

export const calendarPlugin: Plugin = {
  id: 'calendar',
  name: 'Calendar',
  version: '1.0.0',
  description: 'Event scheduling and calendar management',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'inactive',

  routes: [{ path: '/calendar', component: 'CalendarView', layout: 'dashboard' }],

  navigation: [
    {
      title: 'Calendar',
      path: '/calendar',
      icon: 'solar:calendar-bold-duotone',
    },
  ],

  components: {
    CalendarView: () => import('./view/calendar-view'),
  },

  hooks: {
    onInit: async () => {
      console.log('[Calendar Plugin] Initialized');
    },
  },

  settings: {},
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['calendar', 'events', 'scheduling'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: false,
};

export default calendarPlugin;
