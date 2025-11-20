# @app/database

Database client and utilities for the application.

## Usage

```typescript
import { prisma } from '@app/database';

// Use Prisma client
const users = await prisma.user.findMany();
```

## Configuration

The Prisma schema is located at `prisma/schema.prisma` in the project root.

## Scripts

- `pnpm generate` - Generate Prisma client
