// Base service class for business logic
import { logger } from '../utils/logger';
import { PaginationParams, PaginatedResponse } from '../types/api';
import { MySQLManager, MongoDBManager, PostgreSQLManager } from '../database/connection';

export abstract class BaseService {
  protected pg = PostgreSQLManager.getInstance();

  protected mongo = MongoDBManager.getInstance();

  protected mysql = MySQLManager.getInstance();

  /**
   * Apply pagination to query results
   */
  protected static paginate<T>(data: T[], params: PaginationParams): PaginatedResponse<T> {
    const { page = 1, limit = 10 } = params;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedData = data.slice(startIndex, endIndex);
    const total = data.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: paginatedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Apply sorting to data
   */
  protected static sort<T>(data: T[], sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc'): T[] {
    if (!sortBy) return data;

    return [...data].sort((a, b) => {
      const aValue = (a as any)[sortBy];
      const bValue = (b as any)[sortBy];

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Generic filter function
   */
  protected static filter<T>(data: T[], filters: Record<string, any>): T[] {
    return data.filter((item) =>
      Object.entries(filters).every(([key, value]) => {
        if (value === undefined || value === null) return true;

        const itemValue = (item as any)[key];

        // Handle string search (case-insensitive)
        if (typeof value === 'string' && typeof itemValue === 'string') {
          return itemValue.toLowerCase().includes(value.toLowerCase());
        }

        // Handle exact match
        return itemValue === value;
      })
    );
  }

  /**
   * Validate required fields
   */
  protected static validateRequired<T>(data: Partial<T>, requiredFields: (keyof T)[]): void {
    const missingFields = requiredFields.filter(
      (field) => data[field] === undefined || data[field] === null
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Generate unique ID
   */
  protected static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Handle database errors
   */
  protected static handleDbError(error: any): never {
    logger.error('Database operation failed', error, { errorCode: error.code });

    if (error.code === '23505') {
      // PostgreSQL unique violation
      throw new Error('Resource already exists');
    }

    if (error.code === '23503') {
      // PostgreSQL foreign key violation
      throw new Error('Referenced resource does not exist');
    }

    throw new Error('Database operation failed');
  }

  /**
   * Execute with retry logic
   */
  protected static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    const executeAttempt = async (attempt: number): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        if (attempt >= maxRetries) {
          throw error;
        }

        // Wait before retrying
        const waitTime = delay * attempt;
        return new Promise((resolve, reject) => {
          setTimeout(async () => {
            try {
              const result = await executeAttempt(attempt + 1);
              resolve(result);
            } catch (retryError) {
              reject(retryError);
            }
          }, waitTime);
        });
      }
    };

    return executeAttempt(1);
  }

  /**
   * Cache wrapper (implement with Redis in production)
   */
  protected static async withCache<T>(
    key: string,
    operation: () => Promise<T>,
    ttl: number = 300 // 5 minutes default
  ): Promise<T> {
    // In production, implement Redis caching here
    // For now, just execute the operation
    return operation();
  }
}
