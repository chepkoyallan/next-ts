// MySQL connection manager
import mysql from 'mysql2/promise';

import { logger } from '../utils/logger';
import { DatabaseConfig } from '../types/api';

/**
 * MySQL connection manager
 */
export class MySQLManager {
  private static instance: MySQLManager;

  private pool: mysql.Pool | null = null;

  static getInstance(): MySQLManager {
    if (!MySQLManager.instance) {
      MySQLManager.instance = new MySQLManager();
    }
    return MySQLManager.instance;
  }

  async connect(config?: DatabaseConfig): Promise<mysql.Pool> {
    if (this.pool) {
      return this.pool;
    }

    const dbConfig = config || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      database: process.env.DB_NAME || 'app_db',
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      pool: {
        min: parseInt(process.env.DB_POOL_MIN || '2', 10),
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      },
    };

    this.pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
      waitForConnections: true,
      connectionLimit: dbConfig.pool?.max,
      queueLimit: 0,
    });

    // Test connection
    try {
      const connection = await this.pool.getConnection();
      await connection.execute('SELECT 1');
      connection.release();
      logger.database('connection', 'MySQL', true);
    } catch (error) {
      logger.database('connection', 'MySQL', false, error as Error);
      throw error;
    }

    return this.pool;
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      await this.connect();
    }
    const [rows] = await this.pool!.execute(sql, params);
    return rows;
  }

  async transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
    if (!this.pool) {
      await this.connect();
    }

    const connection = await this.pool!.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
