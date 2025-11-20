// MongoDB connection manager
import { Db, MongoClient } from 'mongodb';

import { logger } from '../utils/logger';

/**
 * MongoDB connection manager
 */
export class MongoDBManager {
  private static instance: MongoDBManager;

  private client: MongoClient | null = null;

  private db: Db | null = null;

  static getInstance(): MongoDBManager {
    if (!MongoDBManager.instance) {
      MongoDBManager.instance = new MongoDBManager();
    }
    return MongoDBManager.instance;
  }

  async connect(uri?: string, dbName?: string): Promise<Db> {
    if (this.db) {
      return this.db;
    }

    const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const databaseName = dbName || process.env.MONGODB_DB_NAME || 'app_db';

    this.client = new MongoClient(mongoUri);
    await this.client.connect();

    this.db = this.client.db(databaseName);

    // Test connection
    try {
      await this.db.admin().ping();
      logger.database('connection', 'MongoDB', true);
    } catch (error) {
      logger.database('connection', 'MongoDB', false, error as Error);
      throw error;
    }

    return this.db;
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    return this.db;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}
