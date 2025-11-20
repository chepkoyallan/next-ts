import type { Plugin } from '@app/config/types';
import { apiRegistry } from '@app/config/registry';
import { registerApiRoutes } from './api/handlers';
import { hookRegistry } from '@app/config/registry';
import ExampleComponent from './components/ExampleComponent';

/**
 * y
 * y functionality
 */
export const myAwesomePluginPlugin: Plugin = {
  id: 'my-awesome-plugin',
  name: 'y',
  version: '1.0.0',
  enabled: true,
  description: 'y functionality',

  routes: [
    {
      id: 'my-awesome-plugin-dashboard',
      path: '/my-awesome-plugin',
      layout: 'dashboard',
      pluginId: 'my-awesome-plugin',
    }
  ],

  navigation: [
    {
      id: 'my-awesome-plugin-nav',
      title: 'y',
      path: '/my-awesome-plugin',
      icon: 'star',
      pluginId: 'my-awesome-plugin',
    }
  ],

  components: {
    ExampleComponent
  },

  hooks: {
    definitions: [
      { name: 'my-awesome-plugin.action', description: 'Plugin action event' }
    ],

    onInit: async () => {
      console.log('[y] Initializing...');

      // Register API routes
      registerApiRoutes('my-awesome-plugin');

      // Subscribe to events
      hookRegistry.subscribe('app.ready', () => {
        console.log('[y] App is ready');
      }, 'my-awesome-plugin');

      console.log('[y] Initialized successfully');
    },

    onLoad: async () => {
      console.log('[y] Loaded');
    },

    onUnload: () => {
      console.log('[y] Unloading...');
      apiRegistry.unregisterPluginRoutes('my-awesome-plugin');
    },

    onDestroy: () => {
      console.log('[y] Destroyed');
    },

    onError: (error: Error) => {
      console.error('[y] Error:', error);
    }
  }
};

export default myAwesomePluginPlugin;
