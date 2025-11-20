// Service initialization and registry setup
import { logger } from '../utils/logger';
import { AuthFactory } from '../auth/auth-factory';
import { ServiceRegistry } from './service-registry';
import { RedisCacheService } from './cache-services';
import { S3StorageService } from './storage-services';
import { SendGridEmailService } from './email-services';
import { GrpcClientFactory } from '../grpc/grpc-client-factory';
import { JWTAuthProvider } from '../auth/providers/jwt-provider';
// import { AIServiceGrpcService, WorkflowEngineGrpcService } from './grpc-services';
import { shutdownEngineServices, initializeEngineServices } from './engine-initializer';

/**
 * Initialize all services and providers
 */
export async function initializeServices(): Promise<void> {
  try {
    logger.info('Initializing services...');

    // Initialize Auth Providers
    const jwtProvider = new JWTAuthProvider();
    AuthFactory.registerProvider('jwt', jwtProvider);
    logger.info('JWT auth provider registered');

    // Initialize Email Services
    if (process.env.EMAIL_SERVICE === 'sendgrid' && process.env.EMAIL_API_KEY) {
      const emailService = new SendGridEmailService();
      ServiceRegistry.register(emailService);
      await emailService.initialize();
      logger.info('SendGrid email service initialized');
    }

    // Initialize Storage Services
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      const storageService = new S3StorageService();
      ServiceRegistry.register(storageService);
      await storageService.initialize();
      logger.info('S3 storage service initialized');
    }

    // Initialize Cache Services
    if (process.env.REDIS_URL) {
      const cacheService = new RedisCacheService();
      ServiceRegistry.register(cacheService);
      await cacheService.initialize();
      logger.info('Redis cache service initialized');
    }

    // Initialize Engine Services (new unified engine)
    if (process.env.ENGINE_GRPC_HOST || process.env.FLYTE_ADMIN_HOST) {
      try {
        logger.info('Attempting to initialize Engine services...');
        await initializeEngineServices();
        logger.info('Engine services initialized successfully');
      } catch (engineError) {
        logger.error('Engine service initialization failed', engineError as Error, {
          details: 'Failed to initialize engine services',
        });
      }
    }

    // Initialize Task Management Service
    logger.info('Checking Task Management initialization conditions', {
      FLYTE_ADMIN_HOST: process.env.FLYTE_ADMIN_HOST,
      FLYTE_ADMIN_PORT: process.env.FLYTE_ADMIN_PORT,
      TASK_MANAGEMENT_ENABLED: process.env.TASK_MANAGEMENT_ENABLED,
    });

    // Perform health check on all services
    const healthResults = await ServiceRegistry.healthCheckAll();
    const healthyServices = Object.entries(healthResults).filter(([, isHealthy]) => isHealthy);

    logger.info('Services initialization completed', {
      totalServices: Object.keys(healthResults).length,
      healthyServices: healthyServices.length,
      services: healthResults,
    });
  } catch (error) {
    logger.error('Failed to initialize services', error as Error);
    throw error;
  }
}

/**
 * Shutdown all services gracefully
 */
export async function shutdownServices(): Promise<void> {
  try {
    logger.info('Shutting down services...');

    // Shutdown engine services
    try {
      await shutdownEngineServices();
    } catch (engineShutdownError) {
      logger.warn('Engine services shutdown failed', {
        error: (engineShutdownError as Error).message,
      });
    }
    // Shutdown service registry services
    await ServiceRegistry.shutdownAll();

    // Shutdown gRPC clients
    await GrpcClientFactory.shutdownAll();

    logger.info('All services shut down successfully');
  } catch (error) {
    logger.error('Error during service shutdown', error as Error);
    throw error;
  }
}

/**
 * Get service health status
 */
export async function getServiceHealth(): Promise<Record<string, boolean>> {
  try {
    return await ServiceRegistry.healthCheckAll();
  } catch (error) {
    logger.error('Failed to check service health', error as Error);
    return {};
  }
}

/**
 * Get available auth providers
 */
export function getAvailableAuthProviders(): string[] {
  return AuthFactory.getAvailableProviders();
}

/**
 * Get registered services
 */
export function getRegisteredServices(): string[] {
  return ServiceRegistry.getServiceNames();
}
