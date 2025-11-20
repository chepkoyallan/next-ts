// Environment configuration and validation
import { z } from 'zod';

// Environment schema validation
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server configuration
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('localhost'),

  // Database configuration
  DB_TYPE: z.enum(['postgresql', 'mysql', 'mongodb']).default('postgresql'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('app_db'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default(''),
  DB_SSL: z.coerce.boolean().default(false),
  DB_POOL_MIN: z.coerce.number().default(2),
  DB_POOL_MAX: z.coerce.number().default(10),

  // MongoDB specific
  MONGODB_URI: z.string().optional(),
  MONGODB_DB_NAME: z.string().optional(),

  // Authentication
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // API Keys
  VALID_API_KEYS: z.string().optional(),

  // External services
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // AWS Configuration
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),

  // Email service
  EMAIL_SERVICE: z.enum(['sendgrid', 'ses', 'smtp']).optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Monitoring and logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SENTRY_DSN: z.string().optional(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // File upload
  MAX_FILE_SIZE: z.coerce.number().default(10485760), // 10MB
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,application/pdf'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z.coerce.boolean().default(true),

  // Security
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  SESSION_SECRET: z.string().optional(),

  // Feature flags
  ENABLE_SWAGGER: z.coerce.boolean().default(true),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  ENABLE_RATE_LIMITING: z.coerce.boolean().default(true),

  // Headless Mode Configuration
  HEADLESS: z.coerce.boolean().default(false),
  NEXT_PUBLIC_HEADLESS: z.coerce.boolean().default(false),
  PRODUCT_NAME: z.string().default('Flyte'),
  PRODUCT_NAME_SHORT: z.string().default('flyte'),
  NEXT_PUBLIC_PRODUCT_NAME: z.string().default('Flyte'),
  NEXT_PUBLIC_PRODUCT_NAME_SHORT: z.string().default('flyte'),
});

// Parse and validate environment variables
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
      throw new Error(`Environment validation failed:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
}

// Export validated environment configuration
export const env = validateEnv();

// Database configuration object
export const dbConfig = {
  type: env.DB_TYPE,
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: env.DB_SSL,
  pool: {
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
  },
};

// MongoDB configuration
export const mongoConfig = {
  uri: env.MONGODB_URI || `mongodb://${env.DB_HOST}:27017`,
  dbName: env.MONGODB_DB_NAME || env.DB_NAME,
};

// JWT configuration
export const jwtConfig = {
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
  issuer: 'your-app-name',
  audience: 'your-app-users',
};

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  enabled: env.ENABLE_RATE_LIMITING,
};

// File upload configuration
export const fileUploadConfig = {
  maxSize: env.MAX_FILE_SIZE,
  allowedTypes: env.ALLOWED_FILE_TYPES.split(','),
};

// CORS configuration
export const corsConfig = {
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
  credentials: env.CORS_CREDENTIALS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
};

// Feature flags
export const features = {
  swagger: env.ENABLE_SWAGGER,
  metrics: env.ENABLE_METRICS,
  rateLimiting: env.ENABLE_RATE_LIMITING,
};

// Utility function to check if we're in development
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

// Export environment for external use
export default env;
