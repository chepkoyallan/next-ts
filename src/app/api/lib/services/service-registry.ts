// Service registry for extensible external services
import { ServiceProvider } from './service-interfaces';

export class ServiceRegistry {
  private static services = new Map<string, ServiceProvider>();

  /**
   * Register a service
   */
  static register<T extends ServiceProvider>(service: T): void {
    this.services.set(service.name, service);
  }

  /**
   * Get service by name
   */
  static get<T extends ServiceProvider>(name: string): T {
    const service = this.services.get(name) as T;
    if (!service) {
      throw new Error(`Service '${name}' not registered`);
    }
    return service;
  }

  /**
   * Initialize all services
   */
  static async initializeAll(): Promise<void> {
    const promises = Array.from(this.services.values()).map((service) => service.initialize());
    await Promise.all(promises);
  }

  /**
   * Health check all services
   */
  static async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const serviceEntries = Array.from(this.services.entries());

    const healthChecks = serviceEntries.map(async ([name, service]) => {
      try {
        const isHealthy = await service.healthCheck();
        return { name, isHealthy };
      } catch {
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
   * Shutdown all services
   */
  static async shutdownAll(): Promise<void> {
    const promises = Array.from(this.services.values()).map((service) => service.shutdown());
    await Promise.all(promises);
  }

  /**
   * Get all registered service names
   */
  static getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Check if service is registered
   */
  static hasService(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Unregister a service
   */
  static unregister(name: string): boolean {
    return this.services.delete(name);
  }
}
