# Production-Ready Next.js API

This is a comprehensive, production-ready API structure built with Next.js App Router, following industry best practices for maintainability, extensibility, modularity, and scalability.

## 🏗️ Architecture Overview

### Directory Structure

```
src/app/api/
├── lib/                          # Core library and utilities
│   ├── types/                    # TypeScript type definitions
│   │   └── api.ts               # Core API types and interfaces
│   ├── constants/               # Application constants
│   │   └── errors.ts           # Error codes and definitions
│   ├── utils/                   # Utility functions
│   │   ├── response.ts         # Standardized API responses
│   │   └── validation.ts       # Request validation utilities
│   ├── middleware/              # Middleware functions
│   │   ├── auth.ts             # Authentication middleware
│   │   ├── logger.ts           # Logging and monitoring
│   │   └── rate-limit.ts       # Rate limiting
│   ├── database/               # Database connections and management
│   │   └── connection.ts       # Multi-database connection managers
│   ├── handlers/               # Request handlers and base classes
│   │   └── base.ts            # Base handler with middleware composition
│   ├── services/               # Business logic services
│   │   └── base.ts            # Base service and repository classes
│   └── config/                 # Configuration management
│       └── environment.ts      # Environment validation and config
├── v1/                         # API version 1
│   ├── users/                  # User management endpoints
│   │   ├── route.ts           # Users CRUD operations
│   │   └── [id]/route.ts      # Individual user operations
│   └── auth/                   # Authentication endpoints
│       ├── login/route.ts     # User login
│       └── me/route.ts        # Current user profile
├── health/route.ts             # Health check endpoint
├── metrics/route.ts            # Metrics and monitoring
└── README.md                   # This documentation
```

## 🚀 Key Features

### 1. **Standardized Response Format**

All API responses follow a consistent structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "unique-request-id",
    "version": "1.0.0"
  }
}
```

### 2. **Comprehensive Error Handling**

- Standardized error codes and messages
- Detailed error responses with context
- Automatic error logging and monitoring
- Development vs production error details

### 3. **Authentication & Authorization**

- JWT-based authentication
- Role-based access control (RBAC)
- Permission-based authorization
- API key authentication support
- Optional authentication for public endpoints

### 4. **Request Validation**

- Zod schema validation for all inputs
- Type-safe request/response handling
- Automatic validation error responses
- Sanitization and security checks

### 5. **Rate Limiting**

- Configurable rate limiting per endpoint
- IP-based and user-based limiting
- Multiple rate limit strategies
- Redis support for distributed systems

### 6. **Database Support**

- Multi-database support (PostgreSQL, MongoDB, MySQL)
- Connection pooling and management
- Transaction support
- Health checks and monitoring

### 7. **Logging & Monitoring**

- Structured logging with request tracking
- Performance monitoring
- Error tracking and reporting
- Metrics collection

### 8. **Middleware Composition**

- Modular middleware system
- Easy to extend and customize
- Automatic middleware application
- Request context management

## 🛠️ Setup and Configuration

### 1. Environment Variables

Create a `.env.local` file with the following variables:

```env
# Node Environment
NODE_ENV=development

# Database Configuration
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_app_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=false

# Authentication
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Optional: MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=your_app_db

# Optional: Redis for rate limiting
REDIS_URL=redis://localhost:6379

# Optional: API Keys
VALID_API_KEYS=key1,key2,key3
```

### 2. Install Dependencies

The following dependencies are required (already included in your package.json):

- `zod` - Runtime type validation
- `jsonwebtoken` - JWT authentication
- `nanoid` - Unique ID generation
- Database drivers: `pg`, `mongodb`, `mysql2`

### 3. Database Setup

Choose your database and run the appropriate setup:

```bash
# PostgreSQL
createdb your_app_db

# MongoDB
# No setup required, database will be created automatically

# MySQL
mysql -u root -p -e "CREATE DATABASE your_app_db;"
```

## 📚 Usage Examples

### 1. Creating a New API Endpoint

```typescript
// src/app/api/v1/posts/route.ts
import { z } from 'zod';
import { createApiHandler } from '../../lib/handlers/base';
import { createSuccessResponse } from '../../lib/utils/response';
import { rateLimitConfigs } from '../../lib/middleware/rate-limit';

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

const handler = createApiHandler(
  {
    auth: { required: true, permissions: ['posts:write'] },
    rateLimit: rateLimitConfigs.standard,
    validation: { body: createPostSchema },
    allowedMethods: ['GET', 'POST'],
  },
  {
    GET: async ({ query, context }) => {
      // List posts logic
      return createSuccessResponse(posts, 200, context.requestId);
    },
    POST: async ({ body, auth, context }) => {
      // Create post logic
      const newPost = await createPost(body, auth.user.id);
      return createSuccessResponse(newPost, 201, context.requestId);
    },
  }
);

export const GET = handler;
export const POST = handler;
```

### 2. Using the Service Layer

```typescript
// src/app/api/lib/services/posts.ts
import { BaseService } from './base';

export class PostsService extends BaseService {
  async createPost(data: CreatePostData, userId: string) {
    return this.withRetry(async () => {
      const client = await this.pg.getClient();
      try {
        const result = await client.query(
          'INSERT INTO posts (title, content, user_id) VALUES ($1, $2, $3) RETURNING *',
          [data.title, data.content, userId]
        );
        return result.rows[0];
      } finally {
        client.release();
      }
    });
  }
}
```

### 3. Custom Middleware

```typescript
// src/app/api/lib/middleware/custom.ts
import { NextRequest, NextResponse } from 'next/server';

export async function customMiddleware(request: NextRequest): Promise<NextResponse | null> {
  // Your custom logic here
  const customHeader = request.headers.get('x-custom-header');

  if (!customHeader) {
    return createErrorResponse('VALIDATION_ERROR', {
      message: 'Custom header required',
    });
  }

  // Continue to next middleware
  return null;
}
```

## 🔒 Security Best Practices

### 1. Authentication

- Use strong JWT secrets (32+ characters)
- Implement token refresh mechanisms
- Use HTTPS in production
- Validate tokens on every request

### 2. Input Validation

- Validate all inputs with Zod schemas
- Sanitize user inputs
- Use parameterized queries
- Implement file upload restrictions

### 3. Rate Limiting

- Apply appropriate rate limits per endpoint
- Use Redis for distributed rate limiting
- Implement progressive delays
- Monitor for abuse patterns

### 4. Error Handling

- Don't expose sensitive information in errors
- Log all errors for monitoring
- Use different error messages for dev/prod
- Implement proper error boundaries

## 📊 Monitoring and Observability

### 1. Health Checks

```bash
GET /api/health
```

Returns system health status and uptime.

### 2. Metrics

```bash
GET /api/metrics
```

Returns performance metrics and system information (requires admin permissions).

### 3. Logging

All requests are automatically logged with:

- Request ID for tracing
- Response times
- Error details
- User context

## 🧪 Testing

### 1. Unit Tests

```typescript
// __tests__/api/users.test.ts
import { createMocks } from 'node-mocks-http';
import { GET } from '../src/app/api/v1/users/route';

describe('/api/v1/users', () => {
  it('should return users list', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    const response = await GET(req);
    expect(response.status).toBe(200);
  });
});
```

### 2. Integration Tests

```typescript
// __tests__/integration/auth.test.ts
describe('Authentication Flow', () => {
  it('should login and access protected route', async () => {
    // Login
    const loginResponse = await fetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
    });

    const { token } = await loginResponse.json();

    // Access protected route
    const protectedResponse = await fetch('/api/v1/users', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(protectedResponse.status).toBe(200);
  });
});
```

## 🚀 Deployment

### 1. Production Environment

```env
NODE_ENV=production
JWT_SECRET=your-production-secret
DB_SSL=true
ENABLE_SWAGGER=false
LOG_LEVEL=warn
```

### 2. Docker Support

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 3. Health Checks

Configure your load balancer to use `/api/health` for health checks.

## 🔧 Customization

### 1. Adding New Databases

Extend the `DatabaseFactory` in `lib/database/connection.ts` to support additional databases.

### 2. Custom Authentication

Implement custom authentication providers in `lib/middleware/auth.ts`.

### 3. Additional Middleware

Create new middleware in `lib/middleware/` and compose them in your handlers.

### 4. Custom Validation

Add custom validation schemas in `lib/utils/validation.ts`.

## 📈 Performance Optimization

### 1. Database Optimization

- Use connection pooling
- Implement query optimization
- Add database indexes
- Use read replicas for scaling

### 2. Caching

- Implement Redis caching
- Use CDN for static assets
- Cache database queries
- Implement response caching

### 3. Rate Limiting

- Use Redis for distributed rate limiting
- Implement sliding window algorithms
- Add progressive delays
- Monitor and adjust limits

## 🤝 Contributing

1. Follow the established patterns
2. Add tests for new features
3. Update documentation
4. Use TypeScript strictly
5. Follow the error handling patterns

## 📄 License

This API structure is designed to be production-ready and follows industry best practices for scalability, maintainability, and security.
