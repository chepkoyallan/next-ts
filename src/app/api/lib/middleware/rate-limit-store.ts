// Rate limit store implementations
export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limit store (use Redis in production)
 */
export class MemoryStore {
  private store = new Map<string, RateLimitEntry>();

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);

    // Clean up expired entries
    if (entry && entry.resetTime < Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    return entry;
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry);
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const existing = this.get(key);

    if (existing) {
      existing.count += 1;
      return existing;
    }

    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };

    this.set(key, newEntry);
    return newEntry;
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.store.forEach((entry, key) => {
      if (entry.resetTime < now) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.store.delete(key);
    });
  }
}

// Re-export Redis store from separate file
export { RedisStore } from './redis-store';
