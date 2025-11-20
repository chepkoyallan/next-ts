/**
 * AI Provider Abstraction Layer
 * Base interface and types for all AI providers (OpenAI, Anthropic, Google, Azure)
 */

// ============================================================================
// Types
// ============================================================================

export * from './errors';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIGenerationOptions {
  model?: string; // Override default model
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
}

export interface AIGenerationResult {
  content: string;
  model: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  finishReason: string;
  raw: any; // Raw response from provider
}

export interface AIStreamChunk {
  content: string;
  isComplete: boolean;
  finishReason?: string;
}

export interface AIProviderConfig {
  apiKey: string;
  model?: string;
  organizationId?: string; // For OpenAI organization
  endpoint?: string; // For Azure OpenAI
}

export interface TokenPricing {
  promptTokensPer1M: number; // Cost per 1 million prompt tokens
  completionTokensPer1M: number; // Cost per 1 million completion tokens
}

// ============================================================================
// Base Provider Class
// ============================================================================

export abstract class BaseAIProvider {
  protected config: AIProviderConfig;
  protected providerName: string;

  constructor(config: AIProviderConfig, providerName: string) {
    this.config = config;
    this.providerName = providerName;
  }

  /**
   * Generate completion (non-streaming)
   */
  abstract generate(
    messages: AIMessage[],
    options?: AIGenerationOptions
  ): Promise<AIGenerationResult>;

  /**
   * Generate completion (streaming)
   */
  abstract generateStream(
    messages: AIMessage[],
    options?: AIGenerationOptions
  ): AsyncGenerator<AIStreamChunk>;

  /**
   * Count tokens in text (approximate)
   */
  abstract countTokens(text: string): number;

  /**
   * Get token pricing for a specific model
   */
  abstract getTokenPricing(model: string): TokenPricing;

  /**
   * Calculate cost based on token usage
   */
  calculateCost(promptTokens: number, completionTokens: number, model: string): number {
    const pricing = this.getTokenPricing(model);
    const promptCost = (promptTokens / 1_000_000) * pricing.promptTokensPer1M;
    const completionCost = (completionTokens / 1_000_000) * pricing.completionTokensPer1M;
    return promptCost + completionCost;
  }

  /**
   * Get default model for this provider
   */
  abstract getDefaultModel(): string;

  /**
   * Validate API key format
   */
  abstract validateApiKey(): boolean;

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.providerName;
  }
}
