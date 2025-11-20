'use client';

import type { Plugin } from '@app/config/types';
import { CheckoutView } from './view';

export const checkoutPlugin: Plugin = {
  id: 'checkout',
  name: 'Checkout',
  version: '1.0.0',
  description: 'E-commerce checkout flow with cart, delivery and payment',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'active',

  routes: [
    {
      path: '/product/checkout',
      component: CheckoutView,
      protected: true,
      layout: 'dashboard',
      meta: {
        title: 'Checkout',
        description: 'Complete your purchase',
      },
    },
  ],

  navigation: [
    {
      id: 'checkout',
      title: 'Checkout',
      path: '/product/checkout',
      icon: 'solar:cart-check-bold-duotone',
      section: 'ecommerce',
      order: 10,
    },
  ],

  hooks: {
    onInit: async () => {
      console.log('[Checkout Plugin] Initialized');
    },
  },

  settings: {
    guestCheckout: true,
    shippingMethods: ['standard', 'express', 'overnight'],
    taxCalculation: 'automatic',
  },

  dependencies: ['payment'],

  metadata: {
    tags: ['checkout', 'ecommerce', 'cart'],
    license: 'MIT',
  },

  installDate: new Date().toISOString(),
  source: 'local',
  isSystem: false,
};
