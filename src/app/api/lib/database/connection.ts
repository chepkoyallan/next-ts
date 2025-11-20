// Database connection and management - Re-exports for backward compatibility
export { MySQLManager } from './mysql';
export { MongoDBManager } from './mongodb';
export { PostgreSQLManager } from './postgresql';
export type { DatabaseConfig } from '../types/api';
export { DatabaseFactory, checkDatabaseHealth } from './factory';
