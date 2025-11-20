'use client';

import type { Plugin } from '@app/config/types';
import { JobListView } from './view';

export const jobPlugin: Plugin = {
  id: 'job',
  name: 'Job Board',
  version: '1.0.0',
  description: 'Job listings, applications and candidate management system',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'active',

  routes: [
    {
      path: '/dashboard/job',
      component: JobListView,
      protected: true,
      layout: 'dashboard',
      meta: {
        title: 'Jobs',
        description: 'Manage job postings',
      },
    },
  ],

  navigation: [
    {
      id: 'job',
      title: 'Jobs',
      path: '/dashboard/job',
      icon: 'solar:case-bold-duotone',
      section: 'management',
      order: 50,
    },
  ],

  hooks: {
    onInit: async () => {
      console.log('[Job Plugin] Initialized');
    },
  },

  settings: {
    categories: ['engineering', 'design', 'marketing', 'sales'],
    applicationForm: true,
    autoExpire: 30, // days
  },

  metadata: {
    tags: ['jobs', 'recruitment', 'hr'],
    license: 'MIT',
  },

  installDate: new Date().toISOString(),
  source: 'local',
  isSystem: false,
};
