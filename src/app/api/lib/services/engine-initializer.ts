/**
 * Engine Service Initializer
 * Integration point for new engine-based gRPC services
 */

import { logger } from '../utils/logger';
import type { EngineManager } from '../../../../engine';

let engineManager: EngineManager | null = null;

/**
 * Initialize engine services
 */
export async function initializeEngineServices(): Promise<void> {
  try {
    logger.info('Initializing engine gRPC services');

    // Dynamic import to ensure module resolution at runtime
    const { createEngineServicesFromEnv } = await import('../../../../engine');

    // Create services from environment configuration
    const manager = createEngineServicesFromEnv();
    engineManager = manager;

    // Check if any services were configured
    const configuredServices = Object.keys(manager.services).filter(
      (key) => manager.services[key as keyof typeof manager.services] !== null
    );

    if (configuredServices.length === 0) {
      logger.warn('No engine services configured. Check environment variables.');
      return;
    }

    logger.info('Configured engine services', { services: configuredServices });

    // Log detailed service status
    logger.info('Engine services status:', {
      admin: manager.services.admin ? 'created' : 'null',
      tasks: manager.services.tasks ? 'created' : 'null',
      workflows: manager.services.workflows ? 'created' : 'null',
      authMetadata: manager.services.authMetadata ? 'created' : 'null',
      dataProxy: manager.services.dataProxy ? 'created' : 'null',
      externalPlugin: manager.services.externalPlugin ? 'created' : 'null',
      identity: manager.services.identity ? 'created' : 'null',
      signal: manager.services.signal ? 'created' : 'null',
    });

    // Try to initialize all configured services (but don't fail if connection fails)
    try {
      await manager.initialize();
      logger.info('Engine services initialized');
    } catch (initError) {
      logger.warn('Engine services initialization had errors (may be due to server not running)', {
        error: initError instanceof Error ? initError.message : 'Unknown error',
      });
      // Continue even if initialization fails - services can reconnect later
    }

    // Note: Flyte Admin client not needed for workflow deployment
    // Workflows are compiled and stored in database
    // Execution happens via engine services when workflow is launched
    logger.info('Workflow deployment uses database storage (no Flyte Admin connection needed)');

    // Note: Engine services don't implement ServiceProvider interface
    // so we don't register them with ServiceRegistry
    // They are accessed directly via getEngineManager()
    logger.info('Engine services available via getEngineManager()');

    // Perform health check
    const healthResults = await manager.healthCheck();
    logger.info('Engine services health check', { healthResults });

    logger.info('Engine services setup completed', {
      services: configuredServices,
      note: 'Services may reconnect automatically when gRPC server becomes available',
    });
  } catch (error) {
    logger.error('Failed to initialize engine services', error as Error);
    throw error;
  }
}

/**
 * Get engine manager instance
 */
export function getEngineManager(): EngineManager | null {
  return engineManager;
}

/**
 * Shutdown engine services
 */
export async function shutdownEngineServices(): Promise<void> {
  if (engineManager) {
    logger.info('Shutting down engine services');
    await engineManager.shutdown();
    engineManager = null;
    logger.info('Engine services shut down');
  }
}

/**
 * Check if engine services are initialized
 */
export function isEngineInitialized(): boolean {
  return engineManager !== null;
}

/**
 * Get engine service health status
 */
export async function getEngineHealth(): Promise<Record<string, boolean>> {
  if (!engineManager) {
    return {};
  }

  return engineManager.healthCheck();
}
