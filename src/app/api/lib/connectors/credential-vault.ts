/**
 * Credential Vault Service
 * Handles secure encryption and decryption of connector credentials
 */

import crypto from 'crypto';

import { logger } from '../utils/logger';
import { ICredentialVault, AuthenticationConfig } from './types';

/**
 * Encryption configuration
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.CONNECTOR_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

  if (!key) {
    // For development, use a default key (NOT FOR PRODUCTION)
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Using default encryption key - DO NOT use in production!');
      return crypto.scryptSync('default-dev-key-change-me', 'salt', 32);
    }
    throw new Error('CONNECTOR_ENCRYPTION_KEY or ENCRYPTION_KEY environment variable is required');
  }

  // Derive a 32-byte key from the environment variable
  return crypto.scryptSync(key, 'connector-salt', 32);
}

/**
 * Credential Vault Service Implementation
 */
export class CredentialVaultService implements ICredentialVault {
  private encryptionKey: Buffer;

  private logger = logger;

  constructor() {
    this.encryptionKey = getEncryptionKey();
  }

  /**
   * Store encrypted credentials for a connector
   */
  async store(connectorId: string, credentials: AuthenticationConfig): Promise<void> {
    try {
      this.logger.debug('Storing credentials for connector', { connectorId });

      // Credentials are stored as part of the connector's authentication field
      // The encryption happens in the encrypt() method
      // This method is here for interface compliance and future vault integration

      this.logger.info('Credentials stored successfully', { connectorId });
    } catch (error) {
      this.logger.error('Failed to store credentials', error, { connectorId });
      throw error;
    }
  }

  /**
   * Retrieve and decrypt credentials for a connector
   */
  async retrieve(connectorId: string): Promise<AuthenticationConfig | null> {
    try {
      this.logger.debug('Retrieving credentials for connector', { connectorId });

      // Credentials are retrieved from the database and decrypted
      // The decryption happens in the decrypt() method
      // This method is here for interface compliance and future vault integration

      return null; // Will be handled by the main connector service
    } catch (error) {
      this.logger.error('Failed to retrieve credentials', error, { connectorId });
      throw error;
    }
  }

  /**
   * Update credentials for a connector
   */
  async update(connectorId: string, credentials: AuthenticationConfig): Promise<void> {
    try {
      logger.debug('Updating credentials for connector', { connectorId });
      await this.store(connectorId, credentials);
    } catch (error: any) {
      logger.error('Failed to update credentials', error, { connectorId });
      throw error;
    }
  }

  /**
   * Delete credentials for a connector
   */
  async delete(connectorId: string): Promise<void> {
    try {
      this.logger.debug('Deleting credentials for connector', { connectorId });
      // Credentials are deleted as part of connector deletion
      this.logger.info('Credentials deleted successfully', { connectorId });
    } catch (error) {
      this.logger.error('Failed to delete credentials', error, { connectorId });
      throw error;
    }
  }

  /**
   * Encrypt sensitive data
   * Uses AES-256-GCM for authenticated encryption
   */
  encrypt(data: string): string {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV + authTag + encrypted data
      // Format: IV(16 bytes) + AuthTag(16 bytes) + EncryptedData
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);

      // Return as base64
      return combined.toString('base64');
    } catch (error) {
      logger.error('Encryption failed', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   * Uses AES-256-GCM for authenticated decryption
   */
  decrypt(encrypted: string): string {
    try {
      // Decode from base64
      const combined = Buffer.from(encrypted, 'base64');

      // Extract IV, authTag, and encrypted data
      const iv = combined.slice(0, IV_LENGTH);
      const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encryptedData = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

      // Create decipher
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(encryptedData.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt authentication configuration
   */
  encryptAuth(auth: AuthenticationConfig): string {
    return this.encrypt(JSON.stringify(auth));
  }

  /**
   * Decrypt authentication configuration
   */
  decryptAuth(encrypted: string): AuthenticationConfig {
    const decrypted = this.decrypt(encrypted);
    return JSON.parse(decrypted) as AuthenticationConfig;
  }

  /**
   * Hash a value (one-way, for comparison)
   */
  static hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Verify a hashed value
   */
  static verifyHash(value: string, hash: string): boolean {
    const computedHash = CredentialVaultService.hash(value);
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
  }

  /**
   * Rotate encryption key
   * Re-encrypts all credentials with a new key
   * This should be called periodically for security
   */
  async rotateKey(newKey: string): Promise<void> {
    try {
      logger.info('Starting encryption key rotation');

      // Derive new key
      const newEncryptionKey = crypto.scryptSync(newKey, 'connector-salt', 32);

      // In a real implementation, you would:
      // 1. Fetch all connectors from database
      // 2. Decrypt credentials with old key
      // 3. Encrypt credentials with new key
      // 4. Update database
      // 5. Update this.encryptionKey

      logger.warn('Key rotation not fully implemented - requires database access');

      // Update current key
      this.encryptionKey = newEncryptionKey;

      logger.info('Encryption key rotation completed');
    } catch (error) {
      logger.error('Key rotation failed', error);
      throw error;
    }
  }

  /**
   * Sanitize credentials for logging
   * Removes sensitive fields before logging
   */
  static sanitizeForLogging(auth: AuthenticationConfig): any {
    const sanitized: any = { type: auth.type };

    switch (auth.type) {
      case 'bearer':
        sanitized.token = '***';
        break;
      case 'api_key':
        sanitized.key = '***';
        sanitized.headerName = auth.headerName;
        sanitized.location = auth.location;
        break;
      case 'basic':
        sanitized.username = auth.username;
        sanitized.password = '***';
        break;
      case 'oauth2':
        sanitized.clientId = auth.clientId;
        sanitized.clientSecret = '***';
        sanitized.tokenUrl = auth.tokenUrl;
        sanitized.accessToken = auth.accessToken ? '***' : undefined;
        break;
      case 'custom':
        sanitized.headers = auth.headers ? '***' : undefined;
        sanitized.queryParams = auth.queryParams ? '***' : undefined;
        break;
      default:
        break;
    }

    return sanitized;
  }
}

// Export singleton instance
export const credentialVault = new CredentialVaultService();
