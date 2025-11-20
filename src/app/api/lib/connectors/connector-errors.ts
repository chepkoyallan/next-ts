/**
 * Connector Error Classes
 * Custom error types for connector system
 */

export { ConnectorError } from './errors/base-error';
export { ConnectorTimeoutError } from './errors/timeout-error';
export { ConnectorExecutionError } from './errors/execution-error';
export { ConnectorRateLimitError } from './errors/rate-limit-error';
export { ConnectorValidationError } from './errors/validation-error';
export { ConnectorAuthenticationError } from './errors/authentication-error';
