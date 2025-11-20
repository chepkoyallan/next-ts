/**
 * Base Connector Error Class
 */

export class ConnectorError extends Error {
  constructor(
    message: string,
    public code: string,
    public connectorId?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}
