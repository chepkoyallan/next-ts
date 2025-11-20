// gRPC client factory for creating and managing gRPC clients
import { logger } from '../utils/logger';
import { GrpcClient, GrpcClientConfig } from './grpc-client';

/**
 * gRPC client registry entry
 */
interface GrpcClientEntry {
  client: GrpcClient;
  config: GrpcClientConfig;
  createdAt: Date;
  lastUsed: Date;
}

/**
 * gRPC client factory for creating and managing multiple gRPC clients
 */
export class GrpcClientFactory {
  private static clients = new Map<string, GrpcClientEntry>();

  /**
   * Create a new gRPC client
   */
  static create(config: GrpcClientConfig): GrpcClient {
    logger.info('Creating gRPC client', { name: config.name });

    const client = new GrpcClient(config);
    const entry: GrpcClientEntry = {
      client,
      config,
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.clients.set(config.name, entry);
    return client;
  }

  /**
   * Get an existing gRPC client
   */
  static get(name: string): GrpcClient | null {
    const entry = this.clients.get(name);
    if (entry) {
      entry.lastUsed = new Date();
      return entry.client;
    }
    return null;
  }

  /**
   * Get or create a gRPC client
   */
  static getOrCreate(config: GrpcClientConfig): GrpcClient {
    const existing = this.get(config.name);
    if (existing) {
      return existing;
    }
    return this.create(config);
  }

  /**
   * Remove a gRPC client
   */
  static async remove(name: string): Promise<boolean> {
    const entry = this.clients.get(name);
    if (entry) {
      try {
        await entry.client.shutdown();
        this.clients.delete(name);
        logger.info('gRPC client removed', { name });
        return true;
      } catch (error) {
        logger.error('Failed to remove gRPC client', error as Error, { name });
        return false;
      }
    }
    return false;
  }

  /**
   * Initialize all clients
   */
  static async initializeAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(async (entry) => {
      try {
        await entry.client.initialize();
        logger.info('gRPC client initialized', { name: entry.client.name });
      } catch (error) {
        logger.error('Failed to initialize gRPC client', error as Error, {
          name: entry.client.name,
        });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Shutdown all clients
   */
  static async shutdownAll(): Promise<void> {
    const promises = Array.from(this.clients.values()).map(async (entry) => {
      try {
        await entry.client.shutdown();
        logger.info('gRPC client shutdown', { name: entry.client.name });
      } catch (error) {
        logger.error('Failed to shutdown gRPC client', error as Error, {
          name: entry.client.name,
        });
      }
    });

    await Promise.all(promises);
    this.clients.clear();
  }

  /**
   * Health check all clients
   */
  static async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const clientEntries = Array.from(this.clients.entries());

    const healthChecks = clientEntries.map(async ([name, entry]) => {
      try {
        const isHealthy = await entry.client.healthCheck();
        return { name, isHealthy };
      } catch (error) {
        logger.error('gRPC health check failed', error as Error, { name });
        return { name, isHealthy: false };
      }
    });

    const healthResults = await Promise.all(healthChecks);
    healthResults.forEach(({ name, isHealthy }) => {
      results[name] = isHealthy;
    });

    return results;
  }

  /**
   * Get all client names
   */
  static getClientNames(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get client statistics
   */
  static getClientStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    this.clients.forEach((entry, name) => {
      stats[name] = {
        connected: entry.client.isConnected(),
        connectionStatus: entry.client.getConnectionStatus(),
        createdAt: entry.createdAt,
        lastUsed: entry.lastUsed,
        config: {
          endpoint: `${entry.config.host}:${entry.config.port}`,
          secure: entry.config.secure,
          packageName: entry.config.packageName,
          serviceName: entry.config.serviceName,
        },
      };
    });

    return stats;
  }

  /**
   * Cleanup unused clients
   */
  static async cleanupUnused(maxIdleTimeMs: number = 300000): Promise<void> {
    const now = new Date();
    const clientsToRemove: string[] = [];

    this.clients.forEach((entry, name) => {
      const idleTime = now.getTime() - entry.lastUsed.getTime();
      if (idleTime > maxIdleTimeMs && !entry.client.isConnected()) {
        clientsToRemove.push(name);
      }
    });

    // Use Promise.all for parallel cleanup
    const cleanupPromises = clientsToRemove.map(async (name) => {
      await this.remove(name);
      logger.info('Cleaned up unused gRPC client', { name });
    });

    await Promise.all(cleanupPromises);
  }
}
