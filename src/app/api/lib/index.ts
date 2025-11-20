// Main barrel export for the API library
export * from './utils';
export * from './types/api';
export * from './handlers/base';
export * from './services/base';
export * from './middleware/auth';
export * from './constants/errors';
export * from './middleware/logger';
export * from './config/environment';
export * from './services/repository';
export * from './middleware/rate-limit';

// Database exports (avoiding duplicate DatabaseConfig export)
export {
  MySQLManager,
  MongoDBManager,
  DatabaseFactory,
  PostgreSQLManager,
  checkDatabaseHealth,
} from './database/connection';
