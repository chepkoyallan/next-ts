// API Error constants and definitions
export const API_ERRORS = {
  // Authentication & Authorization
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication required',
    statusCode: 401,
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'Insufficient permissions',
    statusCode: 403,
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    message: 'Invalid or expired token',
    statusCode: 401,
  },

  // Validation
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    statusCode: 400,
  },
  INVALID_INPUT: {
    code: 'INVALID_INPUT',
    message: 'Invalid input provided',
    statusCode: 400,
  },
  MISSING_REQUIRED_FIELD: {
    code: 'MISSING_REQUIRED_FIELD',
    message: 'Required field is missing',
    statusCode: 400,
  },

  // Resource Management
  RESOURCE_NOT_FOUND: {
    code: 'RESOURCE_NOT_FOUND',
    message: 'Requested resource not found',
    statusCode: 404,
  },
  RESOURCE_ALREADY_EXISTS: {
    code: 'RESOURCE_ALREADY_EXISTS',
    message: 'Resource already exists',
    statusCode: 409,
  },
  RESOURCE_CONFLICT: {
    code: 'RESOURCE_CONFLICT',
    message: 'Resource conflict detected',
    statusCode: 409,
  },

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Rate limit exceeded',
    statusCode: 429,
  },

  // Server Errors
  INTERNAL_SERVER_ERROR: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    statusCode: 500,
  },
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    message: 'Database operation failed',
    statusCode: 500,
  },
  EXTERNAL_SERVICE_ERROR: {
    code: 'EXTERNAL_SERVICE_ERROR',
    message: 'External service unavailable',
    statusCode: 503,
  },

  // Method & Content
  METHOD_NOT_ALLOWED: {
    code: 'METHOD_NOT_ALLOWED',
    message: 'HTTP method not allowed',
    statusCode: 405,
  },
  UNSUPPORTED_MEDIA_TYPE: {
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'Unsupported media type',
    statusCode: 415,
  },
  PAYLOAD_TOO_LARGE: {
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Request payload too large',
    statusCode: 413,
  },

  // Business Logic
  BUSINESS_RULE_VIOLATION: {
    code: 'BUSINESS_RULE_VIOLATION',
    message: 'Business rule violation',
    statusCode: 422,
  },
  INSUFFICIENT_BALANCE: {
    code: 'INSUFFICIENT_BALANCE',
    message: 'Insufficient balance',
    statusCode: 422,
  },
  QUOTA_EXCEEDED: {
    code: 'QUOTA_EXCEEDED',
    message: 'Quota exceeded',
    statusCode: 422,
  },

  // Feature Flags
  FEATURE_DISABLED: {
    code: 'FEATURE_DISABLED',
    message: 'Feature is currently disabled',
    statusCode: 403,
  },

  // Payment Errors
  PAYMENT_ERROR: {
    code: 'PAYMENT_ERROR',
    message: 'Payment processing error',
    statusCode: 402,
  },
  PAYMENT_PROVIDER_ERROR: {
    code: 'PAYMENT_PROVIDER_ERROR',
    message: 'Payment provider error',
    statusCode: 502,
  },
  PAYMENT_DECLINED: {
    code: 'PAYMENT_DECLINED',
    message: 'Payment was declined',
    statusCode: 402,
  },
  INSUFFICIENT_FUNDS: {
    code: 'INSUFFICIENT_FUNDS',
    message: 'Insufficient funds',
    statusCode: 402,
  },
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;
