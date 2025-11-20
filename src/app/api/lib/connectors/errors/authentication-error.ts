/**
 * Connector Authentication Error
 */

import { ConnectorError } from './base-error';

export class ConnectorAuthenticationError extends ConnectorError {
  constructor(message: string, connectorId: string) {
    super(message, 'AUTHENTICATION_ERROR', connectorId);
    this.name = 'ConnectorAuthenticationError';
  }
}
