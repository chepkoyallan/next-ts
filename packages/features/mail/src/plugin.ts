import type { Plugin } from '@app/types';

export const mailPlugin: Plugin = {
  id: 'mail',
  name: 'Mail',
  version: '1.0.0',
  description: 'Email client and inbox management',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'inactive',

  routes: [
    { path: '/mail', component: 'MailView', layout: 'dashboard' },
    { path: '/mail/:mailId', component: 'MailView', layout: 'dashboard' },
  ],

  navigation: [
    {
      title: 'Mail',
      path: '/mail',
      icon: 'solar:mailbox-bold-duotone',
    },
  ],

  components: {
    MailView: () => import('./view/mail-view'),
  },

  hooks: {
    onInit: async () => {
      console.log('[Mail Plugin] Initialized');
    },
  },

  settings: {},
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['mail', 'email', 'inbox'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: false,
};

export default mailPlugin;
