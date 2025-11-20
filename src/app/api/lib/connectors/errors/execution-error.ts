/**
 * Connector Execution Error
 */

import { ConnectorError } from './base-error';

export class ConnectorExecutionError extends ConnectorError {
  constructor(message: string, connectorId: string, details?: any) {
    super(message, 'EXECUTION_ERROR', connectorId, details);
    this.name = 'ConnectorExecutionError';
  }
}
