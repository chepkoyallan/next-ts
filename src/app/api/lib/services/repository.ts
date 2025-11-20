// Repository pattern base class
import { BaseService } from './base';
import { PaginationParams, PaginatedResponse } from '../types/api';

/**
 * Repository pattern base class
 */
export abstract class BaseRepository<T> extends BaseService {
  protected abstract tableName: string;

  abstract findById(id: string): Promise<T | null>;
  abstract findAll(params?: PaginationParams): Promise<PaginatedResponse<T>>;
  abstract create(data: Partial<T>): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T | null>;
  abstract delete(id: string): Promise<boolean>;

  /**
   * Find by field value
   */
  abstract findBy(field: keyof T, value: any): Promise<T[]>;

  /**
   * Count records
   */
  abstract count(filters?: Record<string, any>): Promise<number>;

  /**
   * Check if record exists
   */
  async exists(id: string): Promise<boolean> {
    const record = await this.findById(id);
    return record !== null;
  }
}
