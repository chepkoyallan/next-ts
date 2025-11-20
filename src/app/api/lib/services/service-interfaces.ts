// Service interfaces for extensible external services
export interface ServiceProvider {
  name: string;
  initialize(): Promise<void>;
  healthCheck(): Promise<boolean>;
  shutdown(): Promise<void>;
}

// Email Service Interface
export interface EmailService extends ServiceProvider {
  sendEmail(to: string, subject: string, body: string): Promise<boolean>;
  sendTemplate(to: string, templateId: string, data: any): Promise<boolean>;
}

// Storage Service Interface
export interface StorageService extends ServiceProvider {
  upload(key: string, data: Buffer, metadata?: any): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}

// Cache Service Interface
export interface CacheService extends ServiceProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<boolean>;
}
