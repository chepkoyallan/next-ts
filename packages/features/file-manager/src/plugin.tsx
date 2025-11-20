'use client';

import type { Plugin } from '@app/config/types';
import { FileManagerView } from './view';

export const fileManagerPlugin: Plugin = {
  id: 'file-manager',
  name: 'File Manager',
  version: '1.0.0',
  description: 'File management with upload, browser, preview and sharing capabilities',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'active',

  routes: [
    {
      path: '/dashboard/file-manager',
      component: FileManagerView,
      protected: true,
      layout: 'dashboard',
      meta: {
        title: 'File Manager',
        description: 'Manage your files and folders',
      },
    },
  ],

  navigation: [
    {
      id: 'file-manager',
      title: 'File Manager',
      path: '/dashboard/file-manager',
      icon: 'solar:folder-bold-duotone',
      section: 'management',
      order: 40,
    },
  ],

  hooks: {
    onInit: async () => {
      console.log('[File Manager Plugin] Initialized');
    },
  },

  settings: {
    maxFileSize: 10485760, // 10MB
    allowedTypes: ['image/*', 'application/pdf', '.doc', '.docx'],
    enableSharing: true,
  },

  metadata: {
    tags: ['files', 'storage', 'management'],
    license: 'MIT',
  },

  installDate: new Date().toISOString(),
  source: 'local',
  isSystem: false,
};
