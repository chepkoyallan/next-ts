/**
 * Connector Rate Limit Error
 */

import { ConnectorError } from './base-error';

export class ConnectorRateLimitError extends ConnectorError {
  constructor(message: string, connectorId: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', connectorId, { retryAfter });
    this.name = 'ConnectorRateLimitError';
  }
}
