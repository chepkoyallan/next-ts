# @app/security

Security utilities and middleware.

## Usage

```typescript
import { checkAccountLockout, recordFailedLogin } from '@app/security/lockout';

// Check if account is locked
const isLocked = await checkAccountLockout(userId);

// Record failed login attempt
await recordFailedLogin(userId);
```
