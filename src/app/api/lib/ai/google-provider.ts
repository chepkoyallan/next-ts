/**
 * Google (Gemini) Provider Implementation
 * Supports Gemini 1.5 Pro, Flash models
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
// Google Provider
// ============================================================================

export class GoogleProvider extends BaseAIProvider {
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(config: AIProviderConfig) {
    super(config, 'google');
  }

  /**
   * Generate completion (non-streaming)
   */
  async generate(
    messages: AIMessage[],
    options?: AIGenerationOptions
  ): Promise<AIGenerationResult> {
    const model = options?.model || this.config.model || this.getDefaultModel();

    // Convert messages to Gemini format
    const contents = this.convertMessagesToGemini(messages);

    try {
      const response = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              maxOutputTokens: options?.maxTokens || 2000,
              temperature: options?.temperature ?? 0.7,
              topP: options?.topP ?? 1.0,
            },
          }),
        }
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const promptTokens = data.usageMetadata?.promptTokenCount || 0;
      const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;
      const tokensUsed = data.usageMetadata?.totalTokenCount || promptTokens + completionTokens;

      return {
        content,
        model,
        tokensUsed,
        promptTokens,
        completionTokens,
        costUsd: this.calculateCost(promptTokens, completionTokens, model),
        finishReason: data.candidates?.[0]?.finishReason || 'STOP',
        raw: data,
      };
    } catch (error: any) {
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError(
        `Google generation failed: ${error.message}`,
        'google',
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

    // Convert messages to Gemini format
    const contents = this.convertMessagesToGemini(messages);

    try {
      const response = await fetch(
        `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              maxOutputTokens: options?.maxTokens || 2000,
              temperature: options?.temperature ?? 0.7,
              topP: options?.topP ?? 1.0,
            },
          }),
        }
      );

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      if (!response.body) {
        throw new AIProviderError('No response body received', 'google');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          yield {
            content: '',
            isComplete: true,
            finishReason: 'STOP',
          };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                yield {
                  content: text,
                  isComplete: false,
                };
              }

              // Check for finish reason
              const finishReason = parsed.candidates?.[0]?.finishReason;
              if (finishReason && finishReason !== 'STOP') {
                yield {
                  content: '',
                  isComplete: true,
                  finishReason,
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
        `Google streaming failed: ${error.message}`,
        'google',
        'STREAMING_ERROR'
      );
    }
  }

  /**
   * Convert messages to Gemini format
   */
  // eslint-disable-next-line class-methods-use-this
  private convertMessagesToGemini(messages: AIMessage[]): any[] {
    // Use provider name for logging/debugging
    // const provider = this.providerName;
    const contents: any[] = [];
    const mergedSystemIndices = new Set<number>();

    let idx = 0;
    while (idx < messages.length) {
      const message = messages[idx];

      // Gemini doesn't support system role in contents, merge with first user message
      if (message.role === 'system') {
        // Find next user message and prepend system message to it
        const currentIdx = idx;
        const nextUserIndex = messages.findIndex((m, i) => currentIdx < i && m.role === 'user');
        if (nextUserIndex === -1) {
          // No user message found, add as user message
          contents.push({
            role: 'user',
            parts: [{ text: message.content }],
          });
          mergedSystemIndices.add(idx);
        }
        // Otherwise, system message will be prepended to next user message
        idx += 1;
      } else {
        // Find if there's a pending system message
        let previousSystem = null;
        let systemIdx = idx - 1;
        while (systemIdx >= 0) {
          const msg = messages[systemIdx];
          if (msg.role === 'system' && !mergedSystemIndices.has(systemIdx)) {
            previousSystem = msg;
            mergedSystemIndices.add(systemIdx);
            break;
          }
          systemIdx -= 1;
        }

        const textContent =
          previousSystem && message.role === 'user'
            ? `${previousSystem.content}\n\n${message.content}`
            : message.content;

        contents.push({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: textContent }],
        });

        idx += 1;
      }
    }

    return contents;
  }

  /**
   * Count tokens (approximate)
   */
  // eslint-disable-next-line class-methods-use-this
  countTokens(text: string): number {
    // Use model from config for potential model-specific counting
    // const model = this.config.model || 'gemini-1.5-flash';
    // Simple approximation: ~1 token per 4 characters
    // For production, use Google's token counting API with model
    return Math.ceil(text.length / 4);
  }

  /**
   * Get token pricing for Google models
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
      'gemini-1.5-pro': {
        promptTokensPer1M: 3.5,
        completionTokensPer1M: 10.5,
      },
      'gemini-1.5-pro-001': {
        promptTokensPer1M: 3.5,
        completionTokensPer1M: 10.5,
      },
      'gemini-1.5-flash': {
        promptTokensPer1M: 0.35,
        completionTokensPer1M: 1.05,
      },
      'gemini-1.5-flash-001': {
        promptTokensPer1M: 0.35,
        completionTokensPer1M: 1.05,
      },
      'gemini-1.0-pro': {
        promptTokensPer1M: 0.5,
        completionTokensPer1M: 1.5,
      },
    };

    // Default to Gemini 1.5 Flash pricing if model not found
    return (
      pricingMap[model] || {
        promptTokensPer1M: 0.35,
        completionTokensPer1M: 1.05,
      }
    );
  }

  /**
   * Get default model
   */
  getDefaultModel(): string {
    return this.config.model || 'gemini-1.5-flash';
  }

  /**
   * Validate API key format
   */
  validateApiKey(): boolean {
    // Google API keys typically start with "AIza"
    return this.config.apiKey.startsWith('AIza') || this.config.apiKey.length > 20;
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
      case 403:
        throw new AIProviderAuthError('Invalid API key or insufficient permissions', providerName);
      case 429:
        if (errorMessage.includes('quota')) {
          throw new AIProviderQuotaError('Google quota exceeded', providerName);
        }
        throw new AIProviderRateLimitError('Rate limit exceeded', providerName);
      default:
        throw new AIProviderError(errorMessage, providerName, 'API_ERROR', response.status);
    }
  }
}
