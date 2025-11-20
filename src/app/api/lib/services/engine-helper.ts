/**
 * Engine Helper Functions
 * Utilities for lazy initialization and service access
 */

import { EngineManager } from '@app/engine';

import { getEngineManager, initializeEngineServices } from './engine-initializer';

/**
 * Get or initialize the engine manager
 * This ensures services are lazily initialized on first use
 */
export async function getOrInitializeEngine(): Promise<EngineManager | null> {
  let engineManager = getEngineManager();

  if (!engineManager) {
    try {
      await initializeEngineServices();
      engineManager = getEngineManager();
    } catch (error) {
      console.error('Failed to initialize engine services:', error);
      return null;
    }
  }

  return engineManager;
}

/**
 * Ensure engine is initialized and return error response if not
 */
export async function requireEngine(serviceName?: keyof EngineManager['services']) {
  const engineManager = await getOrInitializeEngine();

  if (!engineManager) {
    return {
      error: {
        success: false,
        error: 'Failed to initialize engine services',
      },
      status: 503,
    };
  }

  // If a specific service is required, check if it's available
  if (serviceName && !engineManager.services[serviceName]) {
    return {
      error: {
        success: false,
        error: `${serviceName} service not available`,
      },
      status: 503,
    };
  }

  return { engineManager };
}
