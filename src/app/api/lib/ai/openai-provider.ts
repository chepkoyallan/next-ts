/**
 * OpenAI Provider Implementation
 * Supports GPT-4, GPT-4 Turbo, GPT-3.5-Turbo models
 */

import {
  AIMessage,
  TokenPricing,
  AIStreamChunk,
  BaseAIProvider,
  AIProviderError,
  AIProviderConfig,
  AIGenerationResult,
  AIGenerationOptions,
  AIProviderAuthError,
  AIProviderQuotaError,
  AIProviderRateLimitError,
} from './base-provider';

// ============================================================================
// OpenAI Provider
// ============================================================================

export class OpenAIProvider extends BaseAIProvider {
  private baseUrl = 'https://api.openai.com/v1';

  constructor(config: AIProviderConfig) {
    super(config, 'openai');
  }

  /**
   * Generate completion (non-streaming)
   */
  async generate(
    messages: AIMessage[],
    options?: AIGenerationOptions
  ): Promise<AIGenerationResult> {
    const model = options?.model || this.config.model || this.getDefaultModel();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          ...(this.config.organizationId && {
            'OpenAI-Organization': this.config.organizationId,
          }),
        },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: options?.maxTokens || 2000,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 1.0,
        }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();

      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;
      const tokensUsed = data.usage?.total_tokens || promptTokens + completionTokens;

      return {
        content: data.choices[0]?.message?.content || '',
        model: data.model,
        tokensUsed,
        promptTokens,
        completionTokens,
        costUsd: this.calculateCost(promptTokens, completionTokens, data.model),
        finishReason: data.choices[0]?.finish_reason || 'stop',
        raw: data,
      };
    } catch (error: any) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError(
        `OpenAI generation failed: ${error.message}`,
        'openai',
        'GENERATION_ERROR'
      );
    }
  }

  /**
   * Generate completion (streaming)
   */
  /* eslint-disable no-await-in-loop, no-restricted-syntax */
  async *generateStream(
    messages: AIMessage[],
    options?: AIGenerationOptions
  ): AsyncGenerator<AIStreamChunk> {
    const model = options?.model || this.config.model || this.getDefaultModel();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
          ...(this.config.organizationId && {
            'OpenAI-Organization': this.config.organizationId,
          }),
        },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: options?.maxTokens || 2000,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 1.0,
          stream: true,
        }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (!response.body) {
        throw new AIProviderError('No response body received', 'openai');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield {
                content: '',
                isComplete: true,
                finishReason: 'stop',
              };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta?.content;
              if (delta) {
                yield {
                  content: delta,
                  isComplete: false,
                };
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError(
        `OpenAI streaming failed: ${error.message}`,
        'openai',
        'STREAMING_ERROR'
      );
    }
  }

  /**
   * Count tokens (approximate using tiktoken-like estimation)
   */
  // eslint-disable-next-line class-methods-use-this
  countTokens(text: string): number {
    // Use model from config for potential model-specific counting
    // const model = this.config.model || 'gpt-4-turbo';
    // Simple approximation: ~1 token per 4 characters
    // For production, use @dqbd/tiktoken library with model-specific encoding
    return Math.ceil(text.length / 4);
  }

  /**
   * Get token pricing for OpenAI models
   */
  getTokenPricing(modelParam?: string): TokenPricing {
    const model = modelParam || this.config.model || this.getDefaultModel();
    return this.getPricingForModel(model);
  }

  /**
   * Get pricing for specific model
   */
  // eslint-disable-next-line class-methods-use-this
  private getPricingForModel(model: string): TokenPricing {
    // Could use this.config for custom pricing overrides in future
    // const useConfig = this.config;
    const pricingMap: Record<string, TokenPricing> = {
      'gpt-4-turbo': {
        promptTokensPer1M: 10.0,
        completionTokensPer1M: 30.0,
      },
      'gpt-4-turbo-2024-04-09': {
        promptTokensPer1M: 10.0,
        completionTokensPer1M: 30.0,
      },
      'gpt-4': {
        promptTokensPer1M: 30.0,
        completionTokensPer1M: 60.0,
      },
      'gpt-4-32k': {
        promptTokensPer1M: 60.0,
        completionTokensPer1M: 120.0,
      },
      'gpt-3.5-turbo': {
        promptTokensPer1M: 0.5,
        completionTokensPer1M: 1.5,
      },
      'gpt-3.5-turbo-16k': {
        promptTokensPer1M: 3.0,
        completionTokensPer1M: 4.0,
      },
      'o1-preview': {
        promptTokensPer1M: 15.0,
        completionTokensPer1M: 60.0,
      },
      'o1-mini': {
        promptTokensPer1M: 3.0,
        completionTokensPer1M: 12.0,
      },
    };

    // Default to GPT-3.5-Turbo pricing if model not found
    return (
      pricingMap[model] || {
        promptTokensPer1M: 0.5,
        completionTokensPer1M: 1.5,
      }
    );
  }

  /**
   * Get default model
   */
  getDefaultModel(): string {
    return this.config.model || 'gpt-4-turbo';
  }

  /**
   * Validate API key format
   */
  validateApiKey(): boolean {
    return this.config.apiKey.startsWith('sk-');
  }

  /**
   * Handle API error responses
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: { message: await response.text() } };
    }

    const errorMessage = errorData.error?.message || 'Unknown error';
    const { providerName } = this; // Use instance provider name

    switch (response.status) {
      case 401:
        throw new AIProviderAuthError('Invalid API key', providerName);
      case 429: {
        const retryAfter = response.headers.get('retry-after');
        if (errorMessage.includes('quota')) {
          throw new AIProviderQuotaError('OpenAI quota exceeded', providerName);
        }
        throw new AIProviderRateLimitError(
          'Rate limit exceeded',
          providerName,
          retryAfter ? parseInt(retryAfter, 10) : undefined
        );
      }
      default:
        throw new AIProviderError(errorMessage, providerName, 'API_ERROR', response.status);
    }
  }
}
