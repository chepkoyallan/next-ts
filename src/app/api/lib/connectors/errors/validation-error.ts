/**
 * Connector Validation Error
 */

import { ConnectorError } from './base-error';
import type { ValidationError } from '../types';

export class ConnectorValidationError extends ConnectorError {
  constructor(message: string, errors: ValidationError[]) {
    super(message, 'VALIDATION_ERROR', undefined, { errors });
    this.name = 'ConnectorValidationError';
  }
}
