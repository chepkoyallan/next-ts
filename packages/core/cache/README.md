# @app/cache

Caching, session management, and Redis utilities.

## Usage

```typescript
import { redisClient } from '@app/cache';
import { sessionStore } from '@app/cache/session';
import { tokenBlacklist } from '@app/cache/blacklist';

// Use Redis client
await redisClient.set('key', 'value');

// Session management
await sessionStore.save(sessionId, data);

// Token blacklist
await tokenBlacklist.add(token);
```

## Configuration

Set `REDIS_URL` environment variable (defaults to `redis://localhost:6379`).
