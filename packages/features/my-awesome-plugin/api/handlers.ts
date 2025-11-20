import { apiRegistry } from '@app/config/registry';

/**
 * Register API routes for my-awesome-plugin
 */
export function registerApiRoutes(pluginId: string) {
  // GET endpoint
  apiRegistry.registerRoute({
    id: `${pluginId}.get`,
    path: `/api/${pluginId}`,
    method: 'GET',
    handler: async (req, res) => {
      res.status(200).json({
        message: 'Hello from my-awesome-plugin API',
        timestamp: Date.now()
      });
    },
    pluginId,
    description: 'Get my-awesome-plugin data',
    tags: [pluginId]
  });

  // POST endpoint
  apiRegistry.registerRoute({
    id: `${pluginId}.create`,
    path: `/api/${pluginId}`,
    method: 'POST',
    handler: async (req, res) => {
      const body = await req.json();
      res.status(201).json({
        message: 'Created successfully',
        data: body
      });
    },
    pluginId,
    description: 'Create my-awesome-plugin data',
    tags: [pluginId],
    protected: false
  });

  console.log(`[API] Registered routes for ${pluginId}`);
}
