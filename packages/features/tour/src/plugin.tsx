'use client';

import type { Plugin } from '@app/config/types';
import { TourListView } from './view';

export const tourPlugin: Plugin = {
  id: 'tour',
  name: 'Tour Management',
  version: '1.0.0',
  description: 'Tour and trip management with bookings and reservations',
  author: 'Core Team',
  enabled: true,
  type: 'full',
  status: 'active',

  routes: [
    {
      path: '/dashboard/tour',
      component: TourListView,
      protected: true,
      layout: 'dashboard',
      meta: {
        title: 'Tours',
        description: 'Manage tours and trips',
      },
    },
  ],

  navigation: [
    {
      id: 'tour',
      title: 'Tours',
      path: '/dashboard/tour',
      icon: 'solar:map-bold-duotone',
      section: 'management',
      order: 60,
    },
  ],

  hooks: {
    onInit: async () => {
      console.log('[Tour Plugin] Initialized');
    },
  },

  settings: {
    categories: ['adventure', 'cultural', 'nature', 'city'],
    bookingEnabled: true,
    capacity: 20,
  },

  metadata: {
    tags: ['tours', 'travel', 'booking'],
    license: 'MIT',
  },

  installDate: new Date().toISOString(),
  source: 'local',
  isSystem: false,
};
