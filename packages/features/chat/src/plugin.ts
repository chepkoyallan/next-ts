import type { Plugin } from '@app/types';

export const chatPlugin: Plugin = {
  id: 'chat',
  name: 'Chat',
  version: '1.0.0',
  description: 'Real-time messaging and chat',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'inactive',

  routes: [
    { path: '/chat', component: 'ChatView', layout: 'dashboard' },
    { path: '/chat/:conversationId', component: 'ChatView', layout: 'dashboard' },
  ],

  navigation: [
    {
      title: 'Chat',
      path: '/chat',
      icon: 'solar:chat-round-dots-bold-duotone',
    },
  ],

  components: {
    ChatView: () => import('./view/chat-view'),
  },

  hooks: {
    onInit: async () => {
      console.log('[Chat Plugin] Initialized');
    },
  },

  settings: {},
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['chat', 'messaging', 'real-time'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: false,
};

export default chatPlugin;
