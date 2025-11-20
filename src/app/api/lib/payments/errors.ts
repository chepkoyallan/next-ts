// Payment Error Classes
export class PaymentError extends Error {
  constructor(
    message: string,
    public code: string,
    public type:
      | 'card_error'
      | 'invalid_request_error'
      | 'api_error'
      | 'authentication_error'
      | 'rate_limit_error',
    public decline_code?: string,
    public payment_intent_id?: string
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}
