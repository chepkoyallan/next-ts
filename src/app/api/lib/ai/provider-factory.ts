/**
 * AI Provider Factory
 * Creates the appropriate AI provider instance based on provider type
 */

import { prisma } from '@app/database';

import { BaseAIProvider } from './base-provider';
import { GoogleProvider } from './google-provider';
import { OpenAIProvider } from './openai-provider';
import { decrypt } from '../services/encryption-service';
import { AnthropicProvider } from './anthropic-provider';

// ============================================================================
// Provider Factory
// ============================================================================

export class AIProviderFactory {
  /**
   * Create provider from AIProviderKey ID
   */
  static async createFromKeyId(keyId: string, userId: string): Promise<BaseAIProvider> {
    // Fetch the key from database
    const key = await prisma.aIProviderKey.findFirst({
      where: {
        id: keyId,
        userId,
        isActive: true,
      },
    });

    if (!key) {
      throw new Error('AI provider key not found or inactive');
    }

    // Decrypt the API key
    const apiKey = decrypt(key.encryptedKey);

    return this.createProvider(key.provider, apiKey, key.model || undefined);
  }

  /**
   * Get user's default provider for a specific provider type
   */
  static async getDefaultProvider(
    userId: string,
    organizationId: string,
    providerType?: string
  ): Promise<BaseAIProvider> {
    const where: any = {
      userId,
      organizationId,
      isActive: true,
    };

    if (providerType) {
      where.provider = providerType;
    }

    // Find default key or first active key
    const key = await prisma.aIProviderKey.findFirst({
      where,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    if (!key) {
      throw new Error(
        providerType
          ? `No active ${providerType} provider key found`
          : 'No active AI provider keys found'
      );
    }

    // Decrypt and create provider
    const apiKey = decrypt(key.encryptedKey);
    return this.createProvider(key.provider, apiKey, key.model || undefined);
  }

  /**
   * Create provider instance from provider type and API key
   */
  static createProvider(providerType: string, apiKey: string, model?: string): BaseAIProvider {
    const config = {
      apiKey,
      model,
    };

    switch (providerType) {
      case 'openai':
        return new OpenAIProvider(config);

      case 'anthropic':
        return new AnthropicProvider(config);

      case 'google':
        return new GoogleProvider(config);

      case 'azure_openai':
        // Azure OpenAI requires additional configuration (endpoint, deployment)
        // For now, use OpenAI provider as base
        return new OpenAIProvider({
          ...config,
          // endpoint would be set from key metadata
        });

      default:
        throw new Error(`Unsupported AI provider: ${providerType}`);
    }
  }

  /**
   * List all supported providers
   */
  static getSupportedProviders(): string[] {
    return ['openai', 'anthropic', 'google', 'azure_openai'];
  }

  /**
   * Get provider display name
   */
  static getProviderDisplayName(providerType: string): string {
    const names: Record<string, string> = {
      openai: 'OpenAI (GPT)',
      anthropic: 'Anthropic (Claude)',
      google: 'Google (Gemini)',
      azure_openai: 'Azure OpenAI',
    };

    return names[providerType] || providerType;
  }

  /**
   * Get available models for a provider
   */
  static getAvailableModels(providerType: string): string[] {
    const models: Record<string, string[]> = {
      openai: [
        'gpt-4-turbo',
        'gpt-4',
        'gpt-4-32k',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'o1-preview',
        'o1-mini',
      ],
      anthropic: [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-2.1',
        'claude-2.0',
        'claude-instant-1.2',
      ],
      google: [
        'gemini-1.5-pro',
        'gemini-1.5-pro-001',
        'gemini-1.5-flash',
        'gemini-1.5-flash-001',
        'gemini-1.0-pro',
      ],
      azure_openai: ['azure-gpt-4', 'azure-gpt-35-turbo'],
    };

    return models[providerType] || [];
  }
}
