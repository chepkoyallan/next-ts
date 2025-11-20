/**
 * AI Generation Service
 * Handles AI-powered code generation for Flyte tasks
 * Supports generate, explain, improve, and refactor operations
 */

import { Prisma } from '@prisma/client';

import { prisma } from '@app/database';

import { logger } from '../utils/logger';
import { AIMessage } from '../ai/base-provider';
import { AIProviderFactory } from '../ai/provider-factory';

// ============================================================================
// Types
// ============================================================================

export interface TaskContext {
  taskId?: string; // Task definition ID if editing existing task
  taskName: string;
  description?: string;
  inputSchema: any; // JSON Schema for input
  outputSchema: any; // JSON Schema for output
  functionName: string; // Dynamic function name (e.g., "process_data", "validate_input")
  parameterName: string; // Dynamic parameter name (e.g., "input_data", "data")
  inputTypeName: string; // Input Pydantic model name (e.g., "UserInput")
  outputTypeName: string; // Output Pydantic model name (e.g., "UserOutput")
  existingCode?: string; // For improve/refactor operations
}

export interface GenerationOptions {
  generationType: 'generate' | 'explain' | 'improve' | 'refactor';
  userDescription?: string; // User's natural language description
  providerKeyId?: string; // Specific provider key to use
  temperature?: number; // 0-1, controls randomness
  maxTokens?: number;
}

export interface GenerationResult {
  generatedCode: string;
  explanation?: string; // For explain operations
  model: string;
  provider: string;
  tokensUsed: number;
  costUsd: number;
  generationLogId: string; // ID of the log entry
}

// ============================================================================
// AI Generation Service
// ============================================================================

export class AIGenerationService {
  /**
   * Generate task code using AI
   */
  static async generateCode(
    userId: string,
    organizationId: string,
    context: TaskContext,
    options: GenerationOptions
  ): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      logger.info('Starting AI code generation', {
        userId,
        generationType: options.generationType,
        taskName: context.taskName,
      });

      // Get AI provider
      const provider = options.providerKeyId
        ? await AIProviderFactory.createFromKeyId(options.providerKeyId, userId)
        : await AIProviderFactory.getDefaultProvider(userId, organizationId);

      // Build prompt messages
      const messages = this.buildPrompt(context, options);

      // Generate code
      const result = await provider.generate(messages, {
        temperature: options.temperature ?? 0.7,
        maxTokens: options.maxTokens ?? 3000,
      });

      // Log generation to database
      const log = await this.logGeneration({
        userId,
        organizationId,
        taskId: context.taskId,
        providerKeyId: options.providerKeyId,
        generationType: options.generationType,
        provider: provider.getProviderName(),
        model: result.model,
        prompt: JSON.stringify(messages),
        userDescription: options.userDescription,
        generatedCode: result.content,
        inputSchema: context.inputSchema,
        outputSchema: context.outputSchema,
        functionName: context.functionName,
        existingCode: context.existingCode,
        tokensUsed: result.tokensUsed,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        costUsd: result.costUsd,
        generationTimeMs: Date.now() - startTime,
        success: true,
      });

      // Update provider key usage stats
      if (options.providerKeyId) {
        await prisma.aIProviderKey.update({
          where: { id: options.providerKeyId },
          data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
            totalCostUsd: { increment: result.costUsd },
          },
        });
      }

      logger.info('AI code generation completed', {
        userId,
        generationLogId: log.id,
        tokensUsed: result.tokensUsed,
        costUsd: result.costUsd,
      });

      return {
        generatedCode: result.content,
        model: result.model,
        provider: provider.getProviderName(),
        tokensUsed: result.tokensUsed,
        costUsd: result.costUsd,
        generationLogId: log.id,
      };
    } catch (error: any) {
      logger.error('AI code generation failed', error);

      // Log failed generation
      if (options.providerKeyId) {
        await this.logGeneration({
          userId,
          organizationId,
          taskId: context.taskId,
          providerKeyId: options.providerKeyId,
          generationType: options.generationType,
          provider: 'unknown',
          model: 'unknown',
          prompt: '',
          userDescription: options.userDescription,
          generatedCode: '',
          tokensUsed: 0,
          costUsd: 0,
          generationTimeMs: Date.now() - startTime,
          success: false,
          errorMessage: error.message,
          errorCode: error.code,
        });
      }

      throw error;
    }
  }

  /**
   * Build AI prompt based on generation type and context
   */
  private static buildPrompt(context: TaskContext, options: GenerationOptions): AIMessage[] {
    const messages: AIMessage[] = [];

    // System message (sets the AI's role and guidelines)
    messages.push({
      role: 'system',
      content: this.getSystemPrompt(options.generationType),
    });

    // User message (specific request)
    switch (options.generationType) {
      case 'generate':
        messages.push({
          role: 'user',
          content: this.buildGeneratePrompt(context, options.userDescription),
        });
        break;

      case 'explain':
        messages.push({
          role: 'user',
          content: this.buildExplainPrompt(context),
        });
        break;

      case 'improve':
        messages.push({
          role: 'user',
          content: this.buildImprovePrompt(context, options.userDescription),
        });
        break;

      case 'refactor':
        messages.push({
          role: 'user',
          content: this.buildRefactorPrompt(context, options.userDescription),
        });
        break;

      default:
        messages.push({
          role: 'user',
          content: this.buildGeneratePrompt(context, options.userDescription),
        });
        break;
    }

    return messages;
  }

  /**
   * Get system prompt for generation type
   */
  private static getSystemPrompt(generationType: string): string {
    const basePrompt = `You are an expert Python developer specializing in writing Flyte tasks with Pydantic models for type safety.

Key Guidelines:
- Always use Pydantic BaseModel for input/output types
- Follow Python best practices and PEP 8 style
- Write clear, maintainable code with proper error handling
- Add docstrings and comments for complex logic
- Use type hints throughout the code
- Ensure the code is production-ready`;

    switch (generationType) {
      case 'generate':
        return `${basePrompt}

Your task is to generate a complete, working Flyte task based on the specifications provided. The task should:
1. Define input and output Pydantic models that match the provided schemas
2. Implement the task function with the specified signature
3. Include all necessary imports
4. Add proper docstrings and comments
5. Handle errors appropriately`;

      case 'explain':
        return `${basePrompt}

Your task is to explain the provided code in clear, simple terms. Break down:
1. What the code does (high-level purpose)
2. How it works (step-by-step logic)
3. Key design decisions and patterns used
4. Potential edge cases or limitations`;

      case 'improve':
        return `${basePrompt}

Your task is to improve the provided code while maintaining its functionality. Focus on:
1. Code quality and readability
2. Performance optimizations
3. Better error handling
4. More comprehensive type hints
5. Improved documentation
6. Following Python and Pydantic best practices`;

      case 'refactor':
        return `${basePrompt}

Your task is to refactor the provided code based on the user's specific requirements. Maintain the core functionality while making the requested structural changes.`;

      default:
        return basePrompt;
    }
  }

  /**
   * Build generate prompt (create new code from scratch)
   */
  private static buildGeneratePrompt(context: TaskContext, userDescription?: string): string {
    return `Generate a complete Flyte task with the following specifications:

**Task Name:** ${context.taskName}
**Task Description:** ${context.description || 'No description provided'}
${userDescription ? `\n**User Requirements:** ${userDescription}\n` : ''}

**Function Signature:**
\`\`\`python
def ${context.functionName}(${context.parameterName}: ${context.inputTypeName}) -> ${
      context.outputTypeName
    }:
\`\`\`

**Input Schema (${context.inputTypeName}):**
\`\`\`json
${JSON.stringify(context.inputSchema, null, 2)}
\`\`\`

**Output Schema (${context.outputTypeName}):**
\`\`\`json
${JSON.stringify(context.outputSchema, null, 2)}
\`\`\`

Generate the complete task code including:
1. All necessary imports (pydantic, flytekit, etc.)
2. Pydantic model definitions for ${context.inputTypeName} and ${context.outputTypeName}
3. The task function decorated with @task
4. Complete implementation of the task logic
5. Proper error handling and validation
6. Docstrings and comments

Return ONLY the Python code, no additional explanations.`;
  }

  /**
   * Build explain prompt (explain existing code)
   */
  private static buildExplainPrompt(context: TaskContext): string {
    return `Explain the following Flyte task code in detail:

\`\`\`python
${context.existingCode || 'No code provided'}
\`\`\`

Provide a clear explanation covering:
1. What the task does (purpose)
2. How it processes the input
3. What output it produces
4. Any important implementation details
5. Potential improvements or concerns`;
  }

  /**
   * Build improve prompt (enhance existing code)
   */
  private static buildImprovePrompt(context: TaskContext, userFeedback?: string): string {
    return `Improve the following Flyte task code:

\`\`\`python
${context.existingCode || 'No code provided'}
\`\`\`

${userFeedback ? `**Specific Improvements Requested:**\n${userFeedback}\n\n` : ''}

Enhance the code by:
1. Improving readability and maintainability
2. Adding better error handling
3. Optimizing performance where possible
4. Adding comprehensive docstrings and type hints
5. Following Python and Pydantic best practices

Keep the same function signature:
\`\`\`python
def ${context.functionName}(${context.parameterName}: ${context.inputTypeName}) -> ${
      context.outputTypeName
    }:
\`\`\`

Return ONLY the improved Python code, no additional explanations.`;
  }

  /**
   * Build refactor prompt (restructure existing code)
   */
  private static buildRefactorPrompt(context: TaskContext, refactorGoals?: string): string {
    return `Refactor the following Flyte task code:

\`\`\`python
${context.existingCode || 'No code provided'}
\`\`\`

**Refactoring Goals:**
${refactorGoals || 'General refactoring to improve code structure and maintainability'}

Maintain the function signature:
\`\`\`python
def ${context.functionName}(${context.parameterName}: ${context.inputTypeName}) -> ${
      context.outputTypeName
    }:
\`\`\`

Input/Output schemas must remain compatible:
- Input: ${context.inputTypeName}
- Output: ${context.outputTypeName}

Return ONLY the refactored Python code, no additional explanations.`;
  }

  /**
   * Log generation to database
   */
  private static async logGeneration(data: {
    userId: string;
    organizationId: string;
    taskId?: string;
    providerKeyId?: string;
    generationType: string;
    provider: string;
    model: string;
    prompt: string;
    userDescription?: string;
    generatedCode: string;
    inputSchema?: any;
    outputSchema?: any;
    functionName?: string;
    existingCode?: string;
    tokensUsed: number;
    promptTokens?: number;
    completionTokens?: number;
    costUsd: number;
    generationTimeMs: number;
    success: boolean;
    errorMessage?: string;
    errorCode?: string;
  }) {
    return await prisma.aIGenerationLog.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        taskId: data.taskId,
        providerKeyId: data.providerKeyId || '',
        generationType: data.generationType,
        provider: data.provider,
        model: data.model,
        prompt: data.prompt,
        userDescription: data.userDescription,
        generatedCode: data.generatedCode,
        inputSchema: data.inputSchema || Prisma.JsonNull,
        outputSchema: data.outputSchema || Prisma.JsonNull,
        functionName: data.functionName,
        existingCode: data.existingCode,
        tokensUsed: data.tokensUsed,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        costUsd: data.costUsd,
        generationTimeMs: data.generationTimeMs,
        success: data.success,
        errorMessage: data.errorMessage,
        errorCode: data.errorCode,
      },
    });
  }
}
