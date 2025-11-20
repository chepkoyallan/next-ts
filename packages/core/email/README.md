# @app/email

Email service and templates using Mailgun.

## Usage

```typescript
import { sendWelcomeEmail, sendPasswordResetEmail } from '@app/email';

// Send emails
await sendWelcomeEmail(user.email, user.name);
await sendPasswordResetEmail(user.email, resetToken);
```

## Configuration

Set environment variables:

- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `NEXT_PUBLIC_APP_URL` (for email links)
