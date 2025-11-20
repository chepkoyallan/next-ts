// PostgreSQL connection manager
import { Pool, PoolClient } from 'pg';

import { logger } from '../utils/logger';
import { DatabaseConfig } from '../types/api';

/**
 * PostgreSQL connection manager
 */
export class PostgreSQLManager {
  private static instance: PostgreSQLManager;

  private pool: Pool | null = null;

  static getInstance(): PostgreSQLManager {
    if (!PostgreSQLManager.instance) {
      PostgreSQLManager.instance = new PostgreSQLManager();
    }
    return PostgreSQLManager.instance;
  }

  async connect(config?: DatabaseConfig): Promise<Pool> {
    if (this.pool) {
      return this.pool;
    }

    const dbConfig = config || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'app_db',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true',
      pool: {
        min: parseInt(process.env.DB_POOL_MIN || '2', 10),
        max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      },
    };

    this.pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
      ssl: dbConfig.ssl,
      min: dbConfig.pool?.min,
      max: dbConfig.pool?.max,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.database('connection', 'PostgreSQL', true);
    } catch (error) {
      logger.database('connection', 'PostgreSQL', false, error as Error);
      throw error;
    }

    return this.pool;
  }

  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      await this.connect();
    }
    return this.pool!.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
