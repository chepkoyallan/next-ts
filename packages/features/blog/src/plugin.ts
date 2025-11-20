import type { Plugin } from '@app/types';

export const blogPlugin: Plugin = {
  id: 'blog',
  name: 'Blog',
  version: '1.0.0',
  description: 'Blog post management and publishing',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'inactive',

  routes: [
    { path: '/blog', component: 'PostListHomeView', layout: 'main' },
    { path: '/blog/posts', component: 'PostListView', layout: 'dashboard' },
    { path: '/blog/post/:id', component: 'PostDetailsView', layout: 'main' },
    { path: '/blog/create', component: 'PostCreateView', layout: 'dashboard' },
    { path: '/blog/edit/:id', component: 'PostEditView', layout: 'dashboard' },
  ],

  navigation: [
    {
      title: 'Blog',
      path: '/blog/posts',
      icon: 'solar:notebook-bold-duotone',
      children: [
        { title: 'Posts', path: '/blog/posts' },
        { title: 'Create', path: '/blog/create' },
      ],
    },
  ],

  components: {
    PostListHomeView: () => import('./view/post-list-home-view'),
    PostListView: () => import('./view/post-list-view'),
    PostDetailsView: () => import('./view/post-details-view'),
    PostCreateView: () => import('./view/post-create-view'),
    PostEditView: () => import('./view/post-edit-view'),
  },

  hooks: {
    onInit: async () => {
      console.log('[Blog Plugin] Initialized');
    },
  },

  settings: {},
  dependencies: [],
  metadata: {
    license: 'MIT',
    tags: ['blog', 'content', 'posts'],
  },

  source: 'local',
  installDate: new Date().toISOString(),
  isSystem: false,
};

export default blogPlugin;
