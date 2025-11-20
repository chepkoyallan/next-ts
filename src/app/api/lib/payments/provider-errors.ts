// Payment Provider Error Class
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
