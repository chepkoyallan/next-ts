/**
 * Engine Configuration
 * Configuration helpers and presets for engine services
 */

import { EngineClientConfig } from './grpc/types';

/**
 * Create configuration from environment variables
 */
export function createConfigFromEnv(
  prefix: string,
  serviceName: string
): EngineClientConfig | null {
  const hostKey = `${prefix}_HOST`;
  const portKey = `${prefix}_PORT`;

  const host = process.env[hostKey];
  const port = process.env[portKey];

  if (!host) {
    return null;
  }

  return {
    name: serviceName,
    host,
    port: parseInt(port || '8089', 10),
    secure: process.env[`${prefix}_SECURE`] === 'true',
    timeout: parseInt(process.env[`${prefix}_TIMEOUT`] || '30000', 10),
    credentials: createCredentialsFromEnv(prefix),
    healthCheck: {
      enabled: process.env[`${prefix}_HEALTH_CHECK`] !== 'false',
      intervalMs: parseInt(process.env[`${prefix}_HEALTH_INTERVAL`] || '30000', 10),
      timeoutMs: parseInt(process.env[`${prefix}_HEALTH_TIMEOUT`] || '5000', 10),
    },
  };
}

/**
 * Create credentials from environment variables
 */
function createCredentialsFromEnv(prefix: string) {
  const authType = process.env[`${prefix}_AUTH_TYPE`];
  const token = process.env[`${prefix}_TOKEN`];
  const apiKey = process.env[`${prefix}_API_KEY`];

  if (!authType || authType === 'insecure') {
    return {
      type: 'insecure' as const,
    };
  }

  if (authType === 'token' && token) {
    return {
      type: 'token' as const,
      token,
    };
  }

  if (authType === 'api-key' && apiKey) {
    return {
      type: 'api-key' as const,
      apiKey,
    };
  }

  return {
    type: 'insecure' as const,
  };
}

/**
 * Configuration presets for common scenarios
 */
export const ConfigPresets = {
  /**
   * Local development configuration
   */
  local: (serviceName: string): EngineClientConfig => ({
    name: serviceName,
    host: 'localhost',
    port: 8089,
    secure: false,
    timeout: 30000,
    credentials: {
      type: 'insecure',
    },
    healthCheck: {
      enabled: true,
      intervalMs: 30000,
      timeoutMs: 5000,
    },
  }),

  /**
   * Production configuration with SSL
   */
  production: (serviceName: string, host: string, port: number): EngineClientConfig => ({
    name: serviceName,
    host,
    port,
    secure: true,
    timeout: 60000,
    credentials: {
      type: 'ssl',
    },
    retryPolicy: {
      maxAttempts: 5,
      initialBackoff: 2000,
      maxBackoff: 60000,
      backoffMultiplier: 2,
      retryableStatusCodes: [14, 4, 8], // UNAVAILABLE, DEADLINE_EXCEEDED, RESOURCE_EXHAUSTED
    },
    healthCheck: {
      enabled: true,
      intervalMs: 60000,
      timeoutMs: 10000,
    },
  }),

  /**
   * Testing configuration
   */
  test: (serviceName: string): EngineClientConfig => ({
    name: serviceName,
    host: 'localhost',
    port: 8089,
    secure: false,
    timeout: 10000,
    credentials: {
      type: 'insecure',
    },
    retryPolicy: {
      maxAttempts: 1,
      initialBackoff: 100,
      maxBackoff: 1000,
      backoffMultiplier: 1,
      retryableStatusCodes: [],
    },
    healthCheck: {
      enabled: false,
      intervalMs: 0,
      timeoutMs: 0,
    },
  }),
};

/**
 * Validate configuration
 */
export function validateConfig(config: EngineClientConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.name) {
    errors.push('Service name is required');
  }

  if (!config.host) {
    errors.push('Host is required');
  }

  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Valid port number is required (1-65535)');
  }

  if (config.timeout && config.timeout < 0) {
    errors.push('Timeout must be positive');
  }

  if (config.retryPolicy) {
    if (config.retryPolicy.maxAttempts < 1) {
      errors.push('maxAttempts must be at least 1');
    }
    if (config.retryPolicy.initialBackoff < 0) {
      errors.push('initialBackoff must be positive');
    }
    if (config.retryPolicy.maxBackoff < config.retryPolicy.initialBackoff) {
      errors.push('maxBackoff must be greater than initialBackoff');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
