'use client';

import type { Plugin } from '@app/config/types';
import { OrderListView } from './view';

export const orderPlugin: Plugin = {
  id: 'order',
  name: 'Order Management',
  version: '1.0.0',
  description: 'Order tracking, management and fulfillment system',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'active',

  routes: [
    {
      path: '/dashboard/order',
      component: OrderListView,
      protected: true,
      layout: 'dashboard',
      meta: {
        title: 'Orders',
        description: 'Manage customer orders',
      },
    },
  ],

  navigation: [
    {
      id: 'order',
      title: 'Orders',
      path: '/dashboard/order',
      icon: 'solar:bag-bold-duotone',
      section: 'ecommerce',
      order: 20,
    },
  ],

  hooks: {
    onInit: async () => {
      console.log('[Order Plugin] Initialized');
    },
  },

  settings: {
    statuses: ['pending', 'processing', 'completed', 'cancelled'],
    notifications: true,
    autoArchive: 90, // days
  },

  metadata: {
    tags: ['orders', 'ecommerce', 'fulfillment'],
    license: 'MIT',
  },

  installDate: new Date().toISOString(),
  source: 'local',
  isSystem: false,
};
