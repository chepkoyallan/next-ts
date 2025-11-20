/**
 * Connector Timeout Error
 */

import { ConnectorError } from './base-error';

export class ConnectorTimeoutError extends ConnectorError {
  constructor(message: string, connectorId: string, timeout: number) {
    super(message, 'TIMEOUT_ERROR', connectorId, { timeout });
    this.name = 'ConnectorTimeoutError';
  }
}
