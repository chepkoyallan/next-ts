import type { Plugin } from '@app/types';

export const userPlugin: Plugin = {
  id: 'user',
  name: 'User Management',
  version: '1.0.0',
  description: 'User management and profiles',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'inactive',

  routes: [
    { path: '/user/list', component: 'UserListView', layout: 'dashboard' },
    { path: '/user/cards', component: 'UserCardsView', layout: 'dashboard' },
    { path: '/user/profile', component: 'UserProfileView', layout: 'dashboard' },
    { path: '/user/create', component: 'UserCreateView', layout: 'dashboard' },
    { path: '/user/edit/:id', component: 'UserEditView', layout: 'dashboard' },
  ],

  navigation: [
    {
      title: 'User',
      path: '/user',
      icon: 'solar:users-group-rounded-bold-duotone',
      children: [
        { title: 'List', path: '/user/list' },
        { title: 'Cards', path: '/user/cards' },
        { title: 'Profile', path: '/user/profile' },
        { title: 'Create', path: '/user/create' },
      ],
    },
  ],

  components: {
    UserListView: () => import('./view/user-list-view'),
    UserCardsView: () => import('./view/user-cards-view'),
    UserProfileView: () => import('./view/user-profile-view'),
    UserCreateView: () => import('./view/user-create-view'),
    UserEditView: () => import('./view/user-edit-view'),
  },

  hooks: {
    onInit: async () => {
      console.log('[User Plugin] Initialized');
    },
  },

  settings: {},
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['user', 'profile', 'management'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: false,
};

export default userPlugin;
