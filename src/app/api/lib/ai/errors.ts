/**
 * AI Provider Error Classes
 */

/* eslint-disable max-classes-per-file */

export class AIProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code: string = 'UNKNOWN_ERROR',
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class AIProviderAuthError extends AIProviderError {
  constructor(message: string, provider: string) {
    super(message, provider, 'AUTH_ERROR', 401);
    this.name = 'AIProviderAuthError';
  }
}

export class AIProviderRateLimitError extends AIProviderError {
  constructor(
    message: string,
    provider: string,
    public retryAfter?: number
  ) {
    super(message, provider, 'RATE_LIMIT', 429);
    this.name = 'AIProviderRateLimitError';
  }
}

export class AIProviderQuotaError extends AIProviderError {
  constructor(message: string, provider: string) {
    super(message, provider, 'QUOTA_EXCEEDED', 429);
    this.name = 'AIProviderQuotaError';
  }
}
