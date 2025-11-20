/**
 * Anthropic (Claude) Provider Implementation
 * Supports Claude 3 Opus, Sonnet, and Haiku models
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
// Anthropic Provider
// ============================================================================

export class AnthropicProvider extends BaseAIProvider {
  private baseUrl = 'https://api.anthropic.com/v1';
  private apiVersion = '2023-06-01';

  constructor(config: AIProviderConfig) {
    super(config, 'anthropic');
  }

  /**
   * Generate completion (non-streaming)
   */
  async generate(
    messages: AIMessage[],
    options?: AIGenerationOptions
  ): Promise<AIGenerationResult> {
    const model = options?.model || this.config.model || this.getDefaultModel();

    // Anthropic requires separating system messages
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens || 2000,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 1.0,
          ...(systemMessage && { system: systemMessage }),
          messages: conversationMessages.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();

      const promptTokens = data.usage?.input_tokens || 0;
      const completionTokens = data.usage?.output_tokens || 0;
      const tokensUsed = promptTokens + completionTokens;

      return {
        content: data.content[0]?.text || '',
        model: data.model,
        tokensUsed,
        promptTokens,
        completionTokens,
        costUsd: this.calculateCost(promptTokens, completionTokens, data.model),
        finishReason: data.stop_reason || 'end_turn',
        raw: data,
      };
    } catch (error: any) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError(
        `Anthropic generation failed: ${error.message}`,
        'anthropic',
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

    // Anthropic requires separating system messages
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens || 2000,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 1.0,
          ...(systemMessage && { system: systemMessage }),
          messages: conversationMessages.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
          })),
          stream: true,
        }),
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (!response.body) {
        throw new AIProviderError('No response body received', 'anthropic');
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

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'content_block_delta') {
                const delta = parsed.delta?.text;
                if (delta) {
                  yield {
                    content: delta,
                    isComplete: false,
                  };
                }
              } else if (parsed.type === 'message_stop') {
                yield {
                  content: '',
                  isComplete: true,
                  finishReason: parsed.stop_reason || 'end_turn',
                };
                return;
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
        `Anthropic streaming failed: ${error.message}`,
        'anthropic',
        'STREAMING_ERROR'
      );
    }
  }

  /**
   * Count tokens (approximate)
   */
  // eslint-disable-next-line class-methods-use-this
  countTokens(text: string): number {
    // Use model from config for potential model-specific counting
    // const model = this.config.model || 'claude-3-5-sonnet-20241022';
    // Simple approximation: ~1 token per 4 characters
    // For production, use Anthropic's token counting API with model
    return Math.ceil(text.length / 4);
  }

  /**
   * Get token pricing for Anthropic models
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
      'claude-3-5-sonnet-20241022': {
        promptTokensPer1M: 3.0,
        completionTokensPer1M: 15.0,
      },
      'claude-3-5-sonnet-20240620': {
        promptTokensPer1M: 3.0,
        completionTokensPer1M: 15.0,
      },
      'claude-3-opus-20240229': {
        promptTokensPer1M: 15.0,
        completionTokensPer1M: 75.0,
      },
      'claude-3-sonnet-20240229': {
        promptTokensPer1M: 3.0,
        completionTokensPer1M: 15.0,
      },
      'claude-3-haiku-20240307': {
        promptTokensPer1M: 0.25,
        completionTokensPer1M: 1.25,
      },
      'claude-2.1': {
        promptTokensPer1M: 8.0,
        completionTokensPer1M: 24.0,
      },
      'claude-2.0': {
        promptTokensPer1M: 8.0,
        completionTokensPer1M: 24.0,
      },
      'claude-instant-1.2': {
        promptTokensPer1M: 0.8,
        completionTokensPer1M: 2.4,
      },
    };

    // Default to Claude 3 Sonnet pricing if model not found
    return (
      pricingMap[model] || {
        promptTokensPer1M: 3.0,
        completionTokensPer1M: 15.0,
      }
    );
  }

  /**
   * Get default model
   */
  getDefaultModel(): string {
    return this.config.model || 'claude-3-5-sonnet-20241022';
  }

  /**
   * Validate API key format
   */
  validateApiKey(): boolean {
    return this.config.apiKey.startsWith('sk-ant-');
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
      case 429:
        if (errorMessage.includes('quota') || errorMessage.includes('credits')) {
          throw new AIProviderQuotaError('Anthropic quota exceeded', providerName);
        }
        throw new AIProviderRateLimitError('Rate limit exceeded', providerName);
      default:
        throw new AIProviderError(errorMessage, providerName, 'API_ERROR', response.status);
    }
  }
}
