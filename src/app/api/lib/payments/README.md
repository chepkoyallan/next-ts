# Payment System Documentation

## Overview

This is a comprehensive, production-ready payment system built for the Next.js API with support for multiple payment providers. The system is designed with enterprise-grade features including RBAC integration, comprehensive error handling, webhook processing, and extensive logging.

## Architecture

### Core Components

1. **Payment Types & Interfaces** (`types.ts`)

   - Comprehensive TypeScript interfaces for all payment operations
   - Error handling classes
   - Provider interface definition

2. **Payment Providers** (`providers/`)

   - Stripe provider implementation (`stripe-provider.ts`)
   - Extensible architecture for additional providers (PayPal, Square, etc.)

3. **Payment Service** (`payment-service.ts`)

   - Business logic layer
   - Provider management and routing
   - Centralized logging and error handling

4. **API Routes** (`/api/v1/payments/`)
   - RESTful endpoints for all payment operations
   - RBAC-integrated access control
   - Comprehensive validation and error handling

## Features

### ✅ **Production-Ready Features**

- **Multi-Provider Support**: Extensible architecture supporting multiple payment providers
- **RBAC Integration**: Full integration with the existing role-based access control system
- **Comprehensive Error Handling**: Custom error types and standardized error responses
- **Webhook Processing**: Secure webhook handling with signature verification
- **Rate Limiting**: Payment-specific rate limiting to prevent abuse
- **Audit Logging**: Comprehensive logging for all payment operations
- **Type Safety**: Full TypeScript support throughout the system
- **Validation**: Zod-based request validation for all endpoints

### 🔒 **Security Features**

- **Webhook Signature Verification**: Ensures webhook authenticity
- **Role-Based Access Control**: Different permission levels for different operations
- **Rate Limiting**: Prevents payment abuse and fraud attempts
- **Input Validation**: Comprehensive validation of all payment data
- **Error Sanitization**: Secure error responses that don't leak sensitive information

## API Endpoints

### Payment Intents

#### Create Payment Intent

```http
POST /api/v1/payments/intents
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 2000,
  "currency": "usd",
  "customer": {
    "email": "customer@example.com",
    "name": "John Doe"
  },
  "description": "Payment for order #12345",
  "automatic_payment_methods": {
    "enabled": true
  }
}
```

#### Confirm Payment Intent

```http
POST /api/v1/payments/intents/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "payment_method_id": "pm_1234567890"
}
```

#### Get Payment Intent

```http
GET /api/v1/payments/intents/{id}
Authorization: Bearer <token>
```

#### Cancel Payment Intent

```http
DELETE /api/v1/payments/intents/{id}
Authorization: Bearer <token>
```

### Refunds

#### Create Refund

```http
POST /api/v1/payments/refunds
Authorization: Bearer <token>
Content-Type: application/json

{
  "payment_intent_id": "pi_1234567890",
  "amount": 1000,
  "reason": "requested_by_customer"
}
```

#### Get Refund

```http
GET /api/v1/payments/refunds/{id}
Authorization: Bearer <token>
```

### Webhooks

#### Process Webhook

```http
POST /api/v1/payments/webhooks?provider=stripe
Stripe-Signature: <signature>
Content-Type: application/json

{
  "id": "evt_1234567890",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      // Payment intent object
    }
  }
}
```

## Environment Configuration

### Required Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Payment System Configuration
DEFAULT_PAYMENT_PROVIDER=stripe
NODE_ENV=development|production

# Existing Auth Configuration
JWT_SECRET=your-jwt-secret
```

### Optional Environment Variables

```bash
# User Role Configuration (for testing)
ADMIN_USERS=user1@example.com,user2@example.com
DEVELOPER_USERS=dev1@example.com,dev2@example.com
DEFAULT_USER_ROLE=viewer

# Additional Provider Configuration (future)
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
```

## RBAC Integration

### Required Permissions

- **`payments:create`** - Create payment intents
- **`payments:read`** - View payment information
- **`payments:write`** - Confirm/cancel payments
- **`payments:refund`** - Create refunds

### Role-Based Access

- **Viewers**: No payment access
- **Users**: Can create and manage their own payments
- **Developers**: Can create and manage their own payments
- **Operators**: Can view all payments, create refunds
- **Admins**: Full payment system access
- **System Admins**: Full payment system access

## Usage Examples

### Basic Payment Flow

```typescript
import { PaymentService } from './lib/payments/payment-service';

const paymentService = new PaymentService();

// Create payment intent
const paymentIntent = await paymentService.createPaymentIntent({
  amount: 2000, // $20.00
  currency: 'usd',
  customer: {
    email: 'customer@example.com',
    name: 'John Doe',
  },
  description: 'Payment for premium subscription',
});

// Confirm payment
const result = await paymentService.confirmPaymentIntent(
  paymentIntent.id,
  'pm_card_visa' // Payment method ID from frontend
);

if (result.success) {
  console.log('Payment succeeded!');
} else {
  console.error('Payment failed:', result.error);
}
```

### Webhook Handling

The system automatically handles common webhook events:

- `payment_intent.succeeded` - Payment completed successfully
- `payment_intent.payment_failed` - Payment failed
- `payment_intent.canceled` - Payment was canceled
- `customer.created` - New customer created
- `invoice.payment_succeeded` - Subscription payment succeeded
- `customer.subscription.created` - New subscription created

### Custom Provider Implementation

To add a new payment provider:

1. Implement the `PaymentProvider` interface
2. Add the provider to `PaymentService.initializeProviders()`
3. Update environment configuration
4. Add provider-specific error handling

```typescript
export class PayPalPaymentProvider implements PaymentProvider {
  name = 'paypal';

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntent> {
    // PayPal implementation
  }

  // Implement other required methods...
}
```

## Error Handling

### Payment-Specific Errors

- **`PAYMENT_ERROR`** - General payment processing error
- **`PAYMENT_PROVIDER_ERROR`** - Provider-specific error
- **`PAYMENT_DECLINED`** - Payment was declined by bank/card issuer
- **`INSUFFICIENT_FUNDS`** - Insufficient funds in account

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_ERROR",
    "message": "Payment processing error",
    "details": {
      "type": "card_error",
      "decline_code": "insufficient_funds",
      "payment_intent_id": "pi_1234567890"
    }
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "req_1234567890",
    "version": "1.0.0"
  }
}
```

## Security Best Practices

1. **Never store sensitive payment data** - Use payment provider tokens/IDs
2. **Validate webhook signatures** - Always verify webhook authenticity
3. **Use HTTPS in production** - Encrypt all payment communications
4. **Implement proper logging** - Log all payment operations for audit trails
5. **Rate limit payment endpoints** - Prevent abuse and fraud attempts
6. **Sanitize error responses** - Don't leak sensitive information in errors

## Testing

### Test Cards (Stripe)

```javascript
// Successful payment
const successCard = '4242424242424242';

// Declined payment
const declinedCard = '4000000000000002';

// Insufficient funds
const insufficientFundsCard = '4000000000009995';
```

### Webhook Testing

Use Stripe CLI for local webhook testing:

```bash
stripe listen --forward-to localhost:8082/api/v1/payments/webhooks
```

## Deployment Checklist

- [ ] Set production Stripe keys
- [ ] Configure webhook endpoints in Stripe dashboard
- [ ] Set up proper SSL certificates
- [ ] Configure production logging
- [ ] Set up monitoring and alerting
- [ ] Test all payment flows
- [ ] Verify webhook signature validation
- [ ] Test error handling scenarios

## Monitoring & Observability

The system includes comprehensive logging for:

- Payment intent creation and status changes
- Refund processing
- Webhook event processing
- Error conditions and failures
- Performance metrics

All logs include request IDs for tracing and debugging.

## Support

For issues or questions:

1. Check the error logs for detailed error information
2. Verify environment configuration
3. Test with Stripe's test cards
4. Check webhook signature validation
5. Review RBAC permissions

## Future Enhancements

- [ ] PayPal provider implementation
- [ ] Square provider implementation
- [ ] Subscription management UI
- [ ] Payment analytics dashboard
- [ ] Automated fraud detection
- [ ] Multi-currency support
- [ ] Payment method management
- [ ] Recurring payment templates
