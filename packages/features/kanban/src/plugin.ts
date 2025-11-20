import type { Plugin } from '@app/types';

export const kanbanPlugin: Plugin = {
  id: 'kanban',
  name: 'Kanban Board',
  version: '1.0.0',
  description: 'Task management with kanban board',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'inactive',

  routes: [{ path: '/kanban', component: 'KanbanView', layout: 'dashboard' }],

  navigation: [
    {
      title: 'Kanban',
      path: '/kanban',
      icon: 'solar:clipboard-list-bold-duotone',
    },
  ],

  components: {
    KanbanView: () => import('./view/kanban-view'),
  },

  hooks: {
    onInit: async () => {
      console.log('[Kanban Plugin] Initialized');
    },
  },

  settings: {},
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['kanban', 'tasks', 'project-management'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: false,
};

export default kanbanPlugin;
