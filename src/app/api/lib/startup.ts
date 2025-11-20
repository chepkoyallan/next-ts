// API startup initialization
import { logger } from './utils/logger';
import { validateApiConfiguration } from './utils/api-validator';
import { initializeServices } from './services/service-initializer';

/**
 * Initialize the API on startup
 */
export async function initializeAPI(): Promise<void> {
  try {
    logger.info('🚀 Initializing Production-Ready Next.js API...');

    // Validate configuration
    logger.info('📋 Validating API configuration...');
    const configValidation = await validateApiConfiguration();

    if (!configValidation.valid) {
      logger.error('❌ API configuration validation failed');
      configValidation.issues.forEach((issue) => logger.error(`  - ${issue}`));
      throw new Error(`Configuration validation failed: ${configValidation.issues.join(', ')}`);
    }

    if (configValidation.warnings.length > 0) {
      logger.warn('⚠️  Configuration warnings', { warnings: configValidation.warnings });
    }

    logger.info('✅ API configuration validated');

    // Initialize services
    logger.info('🔧 Initializing services...');
    await initializeServices();
    logger.info('✅ Services initialized');

    logger.info('🎉 API initialization completed successfully!');
    logger.info('📊 API is ready to handle requests');
  } catch (error) {
    logger.error('❌ API initialization failed', error as Error);
    throw error;
  }
}

/**
 * Get API status
 */
export async function getAPIStatus(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  environment: string;
  services: Record<string, boolean>;
}> {
  try {
    const { getServiceHealth } = await import('./services/service-initializer');
    const services = await getServiceHealth();

    const healthyServices = Object.values(services).filter(Boolean).length;
    const totalServices = Object.values(services).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === totalServices) {
      status = 'healthy';
    } else if (healthyServices > totalServices / 2) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
    };
  } catch (error) {
    logger.error('Failed to get API status', error as Error);
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: 'unknown',
      environment: process.env.NODE_ENV || 'development',
      services: {},
    };
  }
}
