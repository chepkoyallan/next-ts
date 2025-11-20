'use client';

import type { Plugin } from '@app/config/types';
import { PaymentView } from './view';

export const paymentPlugin: Plugin = {
  id: 'payment',
  name: 'Payment',
  version: '1.0.0',
  description: 'Payment processing with multiple payment methods and gateways',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'active',

  routes: [
    {
      path: '/payment',
      component: PaymentView,
      protected: true,
      layout: 'dashboard',
      meta: {
        title: 'Payment',
        description: 'Process payments',
      },
    },
  ],

  navigation: [
    {
      id: 'payment',
      title: 'Payment',
      path: '/payment',
      icon: 'solar:card-bold-duotone',
      section: 'ecommerce',
      order: 30,
    },
  ],

  hooks: {
    onInit: async () => {
      console.log('[Payment Plugin] Initialized');
    },
  },

  settings: {
    gateways: ['stripe', 'paypal'],
    currencies: ['USD', 'EUR', 'GBP'],
    testMode: true,
  },

  metadata: {
    tags: ['payment', 'ecommerce', 'gateway'],
    license: 'MIT',
  },

  installDate: new Date().toISOString(),
  source: 'local',
  isSystem: false,
};
