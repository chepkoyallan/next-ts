import { pluginManager } from '@app/config';

/**
 * Auto-discover and register all feature packages as plugins
 */
export async function loadPackages() {
  console.log('🔌 Loading packages...');

  // List of feature packages to load
  const features = [
    'auth',
    'dashboard',
    'user',
    'product',
    'blog',
    'mail',
    'chat',
    'kanban',
    'calendar',
    'invoice',
  ];

  for (const feature of features) {
    try {
      // Dynamic import of plugin definition
      const pluginModule = await import(`@app/${feature}/plugin`);

      if (pluginModule.default || pluginModule[`${feature}Plugin`]) {
        const plugin = pluginModule.default || pluginModule[`${feature}Plugin`];

        // Register plugin
        pluginManager.registerPlugin(plugin);

        console.log(`✅ Loaded package: @app/${feature}`);
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load @app/${feature}`);
    }
  }

  console.log('✅ All packages loaded');
}
