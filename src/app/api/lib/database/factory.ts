// Database factory and health checks
import { MySQLManager } from './mysql';
import { MongoDBManager } from './mongodb';
import { PostgreSQLManager } from './postgresql';

/**
 * Database factory for getting the appropriate database manager
 */
export class DatabaseFactory {
  static getDatabase(type: 'postgresql' | 'mongodb' | 'mysql') {
    switch (type) {
      case 'postgresql':
        return PostgreSQLManager.getInstance();
      case 'mongodb':
        return MongoDBManager.getInstance();
      case 'mysql':
        return MySQLManager.getInstance();
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }
}

/**
 * Health check for all database connections
 */
export async function checkDatabaseHealth(): Promise<{
  postgresql?: boolean;
  mongodb?: boolean;
  mysql?: boolean;
}> {
  const health: any = {};

  // Check PostgreSQL
  try {
    const pg = PostgreSQLManager.getInstance();
    await pg.query('SELECT 1');
    health.postgresql = true;
  } catch {
    health.postgresql = false;
  }

  // Check MongoDB
  try {
    const mongo = MongoDBManager.getInstance();
    const db = mongo.getDb();
    await db.admin().ping();
    health.mongodb = true;
  } catch {
    health.mongodb = false;
  }

  // Check MySQL
  try {
    const mysqlManager = MySQLManager.getInstance();
    await mysqlManager.query('SELECT 1');
    health.mysql = true;
  } catch {
    health.mysql = false;
  }

  return health;
}
