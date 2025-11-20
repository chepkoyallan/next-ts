/**
 * Task Interface Registry
 *
 * Fetches and caches task interface information from Flyte
 * Provides type information for binding validation
 */

import type { AdminService } from '@app/engine';
import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';
import { logger } from 'src/app/api/lib/utils/logger';

import type { TaskId, FlyteType, SimpleType, TaskInterface, FlyteVariable } from './types-v4';

/**
 * Cache entry with TTL
 */
interface CacheEntry {
  interface: TaskInterface;
  expiresAt: Date;
}

/**
 * Task Interface Registry Configuration
 */
export interface TaskInterfaceRegistryConfig {
  // Cache TTL in milliseconds (default: 5 minutes)
  cacheTtlMs: number;

  // Maximum cache size (LRU eviction)
  maxCacheSize: number;

  // Timeout for task fetches (milliseconds)
  fetchTimeoutMs: number;

  // Base URL for HTTP fallback
  baseUrl?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: TaskInterfaceRegistryConfig = {
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 1000,
  fetchTimeoutMs: 5000, // 5 seconds
};

/**
 * Task Interface Registry
 *
 * Manages fetching and caching of task interfaces from Flyte
 */
export class TaskInterfaceRegistry {
  private cache = new Map<string, CacheEntry>();
  private config: TaskInterfaceRegistryConfig;
  private adminService?: AdminService;

  constructor(config: Partial<TaskInterfaceRegistryConfig> = {}, adminService?: AdminService) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.adminService = adminService;
  }

  /**
   * Get task interface (with caching)
   */
  async getTaskInterface(taskId: TaskId): Promise<TaskInterface | null> {
    const cacheKey = TaskInterfaceRegistry.buildCacheKey(taskId);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      logger.info(`[TaskRegistry] Cache hit: ${cacheKey}`);
      return cached.interface;
    }

    // Cache miss or expired - fetch from Flyte
    logger.info(`[TaskRegistry] Cache miss: ${cacheKey}, fetching...`);

    try {
      const taskInterface = await this.fetchTaskInterface(taskId);

      if (taskInterface) {
        // Add to cache with TTL
        this.addToCache(cacheKey, taskInterface);
        return taskInterface;
      }

      logger.warn(`[TaskRegistry] Task interface not found: ${cacheKey}`);
      return null;
    } catch (error) {
      logger.error(`[TaskRegistry] Failed to fetch task interface: ${cacheKey}`, error as Error);
      return null;
    }
  }

  /**
   * Get workflow interface (with caching) - for subworkflow nodes
   */
  async getWorkflowInterface(workflowId: any): Promise<TaskInterface | null> {
    const cacheKey = `workflow:${workflowId.project}:${workflowId.domain}:${workflowId.name}:${workflowId.version}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > new Date()) {
      logger.info(`[TaskRegistry] Cache hit (workflow): ${cacheKey}`);
      return cached.interface;
    }

    // Cache miss - fetch from Flyte
    logger.info(`[TaskRegistry] Cache miss (workflow): ${cacheKey}, fetching...`);

    try {
      const workflowInterface = await this.fetchWorkflowInterface(workflowId);

      if (workflowInterface) {
        // Cache the result
        this.cache.set(cacheKey, {
          interface: workflowInterface,
          expiresAt: new Date(Date.now() + this.config.cacheTtlMs),
        });
        logger.info(`[TaskRegistry] Cached workflow interface: ${cacheKey}`);
      }

      return workflowInterface;
    } catch (error) {
      logger.error(`[TaskRegistry] Failed to fetch workflow interface: ${cacheKey}`, error);
      return null;
    }
  }

  /**
   * Get parameter type for a specific field
   */
  async getParameterType(taskId: TaskId, paramName: string): Promise<FlyteType | null> {
    const taskInterface = await this.getTaskInterface(taskId);
    if (!taskInterface) return null;

    const variable = taskInterface.inputs.get(paramName);
    return variable ? variable.type : null;
  }

  /**
   * Check if parameter exists in task interface
   */
  async hasParameter(taskId: TaskId, paramName: string): Promise<boolean> {
    const taskInterface = await this.getTaskInterface(taskId);
    if (!taskInterface) return false;

    return taskInterface.inputs.has(paramName);
  }

  /**
   * Prefetch multiple task interfaces in parallel
   */
  async prefetchInterfaces(taskIds: TaskId[]): Promise<void> {
    logger.info(`[TaskRegistry] Prefetching ${taskIds.length} task interfaces`);

    const startTime = Date.now();

    await Promise.all(
      taskIds.map((taskId) =>
        this.getTaskInterface(taskId).catch((error) => {
          logger.warn(
            `[TaskRegistry] Failed to prefetch ${TaskInterfaceRegistry.buildCacheKey(taskId)}`,
            error
          );
        })
      )
    );

    const duration = Date.now() - startTime;
    logger.info(`[TaskRegistry] Prefetch completed in ${duration}ms`);
  }

  /**
   * Invalidate cache entry
   */
  invalidate(taskId: TaskId): void {
    const cacheKey = TaskInterfaceRegistry.buildCacheKey(taskId);
    this.cache.delete(cacheKey);
    logger.info(`[TaskRegistry] Invalidated cache: ${cacheKey}`);
  }

  /**
   * Clear entire cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('[TaskRegistry] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ taskId: string; fetchedAt: string; expiresAt: string }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([taskId, entry]) => ({
      taskId,
      fetchedAt: entry.interface.fetchedAt.toISOString(),
      expiresAt: entry.expiresAt.toISOString(),
    }));

    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      entries,
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Fetch task interface from Flyte (gRPC or HTTP)
   */
  private async fetchTaskInterface(taskId: TaskId): Promise<TaskInterface | null> {
    // Try gRPC first (if AdminService available)
    if (this.adminService) {
      const result = await this.fetchViaGrpc(taskId);
      if (result) return result;
    }

    // Fallback to HTTP
    if (this.config.baseUrl) {
      return this.fetchViaHttp(taskId);
    }

    logger.error('[TaskRegistry] No fetch method available (no AdminService or baseUrl)');
    return null;
  }

  /**
   * Fetch workflow interface from Flyte
   */
  private async fetchWorkflowInterface(workflowId: any): Promise<TaskInterface | null> {
    if (!this.adminService) {
      logger.error('[TaskRegistry] Cannot fetch workflow interface: no AdminService');
      return null;
    }

    try {
      logger.info(`[TaskRegistry] Fetching workflow interface via gRPC`);

      const workflow = await this.adminService.getWorkflow({
        id: {
          resourceType: 2, // WORKFLOW
          project: workflowId.project,
          domain: workflowId.domain,
          name: workflowId.name,
          version: workflowId.version,
        },
      });

      if (!workflow || !workflow.closure?.compiledWorkflow?.primary?.template?.interface) {
        logger.warn('[TaskRegistry] Workflow has no interface in gRPC response');
        return null;
      }

      const rawInterface = workflow.closure.compiledWorkflow.primary.template.interface;
      return this.parseTaskInterface(workflowId, rawInterface);
    } catch (error) {
      logger.warn(`[TaskRegistry] Workflow fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Fetch task interface via gRPC
   */
  private async fetchViaGrpc(taskId: TaskId): Promise<TaskInterface | null> {
    if (!this.adminService) return null;

    try {
      logger.info(
        `[TaskRegistry] Fetching via gRPC: ${TaskInterfaceRegistry.buildCacheKey(taskId)}`
      );

      const task = await this.adminService.getTask({
        id: {
          resourceType: 1, // TASK
          project: taskId.project,
          domain: taskId.domain,
          name: taskId.name,
          version: taskId.version,
        },
      });

      if (!task || !task.closure?.compiledTask?.template?.interface) {
        logger.warn('[TaskRegistry] Task has no interface in gRPC response');
        return null;
      }

      const rawInterface = task.closure.compiledTask.template.interface;
      return this.parseTaskInterface(taskId, rawInterface);
    } catch (error) {
      logger.warn(`[TaskRegistry] gRPC fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Fetch task interface via HTTP API
   */
  private async fetchViaHttp(taskId: TaskId): Promise<TaskInterface | null> {
    if (!this.config.baseUrl) return null;

    try {
      logger.info(
        `[TaskRegistry] Fetching via HTTP: ${TaskInterfaceRegistry.buildCacheKey(taskId)}`
      );

      const params = new URLSearchParams({
        domain: taskId.domain,
        name: taskId.name,
        version: taskId.version,
        limit: '1',
      });

      const url = `${this.config.baseUrl}/api/v1/engine/tasks?${params}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.fetchTimeoutMs);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          logger.error(`[TaskRegistry] HTTP request failed: ${response.status}`);
          return null;
        }

        const result = await response.json();

        if (!result.success || !result.data?.tasks || result.data.tasks.length === 0) {
          logger.warn('[TaskRegistry] No task found in HTTP response');
          return null;
        }

        const task = result.data.tasks[0];
        const rawInterface = task.closure?.compiledTask?.template?.interface;

        if (!rawInterface) {
          logger.warn('[TaskRegistry] Task has no interface in HTTP response');
          return null;
        }

        return this.parseTaskInterface(taskId, rawInterface);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          logger.error('[TaskRegistry] HTTP fetch timeout');
        } else {
          logger.error('[TaskRegistry] HTTP fetch error', fetchError);
        }
        return null;
      }
    } catch (error) {
      logger.warn(`[TaskRegistry] HTTP fetch failed: ${error}`);
      return null;
    }
  }

  /**
   * Parse raw Flyte interface into structured TaskInterface
   */
  private parseTaskInterface(
    taskId: TaskId,
    rawInterface: flyteidl.core.ITypedInterface
  ): TaskInterface {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.cacheTtlMs);

    const inputs = new Map<string, FlyteVariable>();
    const outputs = new Map<string, FlyteVariable>();

    // Parse inputs
    if (rawInterface.inputs?.variables) {
      Object.entries(rawInterface.inputs.variables).forEach(([name, variable]) => {
        inputs.set(name, this.parseFlyteVariable(name, variable));
      });
    }

    // Parse outputs
    if (rawInterface.outputs?.variables) {
      Object.entries(rawInterface.outputs.variables).forEach(([name, variable]) => {
        outputs.set(name, this.parseFlyteVariable(name, variable));
      });
    }

    return {
      taskId,
      inputs,
      outputs,
      fetchedAt: now,
      expiresAt,
    };
  }

  /**
   * Parse Flyte variable
   */
  private parseFlyteVariable(name: string, variable: flyteidl.core.IVariable): FlyteVariable {
    // Determine if parameter is optional
    // In Flyte/Python: Optional[X] = None translates to a parameter that can be omitted
    // Detection strategies:
    // 1. Union types that include NONE type (Optional[X] = Union[X, None])
    // 2. Check if the type annotation includes None
    const isOptional = TaskInterfaceRegistry.isOptionalType(variable.type!);

    if (isOptional) {
      logger.info(`[TaskRegistry] Parameter '${name}' detected as optional`);
    }

    // Log raw literal type for debugging
    logger.info(`[TaskRegistry] Parameter '${name}' raw literal type:`, {
      simple: variable.type!.simple,
      hasCollectionType: !!variable.type!.collectionType,
      hasMapValueType: !!variable.type!.mapValueType,
      hasUnionType: !!variable.type!.unionType,
      hasStructure: !!(variable.type! as any).structure,
      structureTag: (variable.type! as any).structure?.tag,
    });

    const parsedType = this.parseFlyteType(variable.type!);
    logger.info(`[TaskRegistry] Parameter '${name}' parsed type: ${JSON.stringify(parsedType)}`);

    return {
      name,
      type: parsedType,
      description: variable.description || '',
      optional: isOptional,
    };
  }

  /**
   * Check if a Flyte type represents an optional parameter
   */
  private static isOptionalType(literalType: flyteidl.core.ILiteralType): boolean {
    // STRATEGY 1: SimpleType.NONE (0) means type info unavailable
    // This typically occurs for complex Python types with default values (e.g., Optional[PipelineConfig] = None)
    // If Flyte can't represent the full type, it marks it as NONE and it's safe to treat as optional
    if (literalType.simple === 0) {
      return true; // NONE type is optional
    }

    // STRATEGY 2: Union types that include NONE are optional (e.g., Optional[str] = Union[str, None])
    if (literalType.unionType?.variants) {
      return literalType.unionType.variants.some(
        (variant) => variant.simple === 0 // SimpleType.NONE means None/null in Python
      );
    }

    // STRATEGY 3: Type annotation may indicate optional
    if (literalType.annotation) {
      const annotations = literalType.annotation as any;
      if (annotations.annotations?.fields) {
        const { fields } = annotations.annotations;
        // Check for "optional" or "python_default" fields
        if (fields.optional?.boolValue || fields.python_default) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Parse Flyte type recursively
   */
  private parseFlyteType(literalType: flyteidl.core.ILiteralType): FlyteType {
    // IMPORTANT: Check structural types BEFORE simple type
    // Flyte sometimes sets simple=0 (NONE) along with structure info
    // Priority: collection > map > union > blob > struct > structure.dataclass_type > simple

    // Collection type - HIGHEST PRIORITY
    if (literalType.collectionType) {
      logger.info('[TaskRegistry] Detected collection type');
      return {
        kind: 'collection',
        collectionType: this.parseFlyteType(literalType.collectionType),
      };
    }

    // Map type
    if (literalType.mapValueType) {
      logger.info('[TaskRegistry] Detected map type');
      return {
        kind: 'map',
        mapValueType: this.parseFlyteType(literalType.mapValueType),
      };
    }

    // Union type
    if (literalType.unionType?.variants) {
      logger.info('[TaskRegistry] Detected union type');
      return {
        kind: 'union',
        unionTypes: literalType.unionType.variants.map((v) => this.parseFlyteType(v)),
      };
    }

    // Blob type
    if (literalType.blob) {
      logger.info('[TaskRegistry] Detected blob type');
      return {
        kind: 'blob',
        blobDimensionality: literalType.blob.dimensionality?.toString(),
      };
    }

    // Structured dataset or schema
    if (literalType.structuredDatasetType || literalType.schema) {
      logger.info('[TaskRegistry] Detected structured dataset/schema type');
      return {
        kind: 'struct',
      };
    }

    // Check structure field for dataclass_type (Pydantic models, dataclasses)
    const { structure } = literalType as any;
    if (structure) {
      logger.info('[TaskRegistry] Found structure field:', { structure });

      // Check if it's a dataclass_type (indicates a structured type like Pydantic model)
      if (structure.dataclass_type) {
        logger.info('[TaskRegistry] Detected dataclass structure (treating as struct)');
        return {
          kind: 'struct',
        };
      }

      // Check for collection structure tags
      if (structure.tag && typeof structure.tag === 'string') {
        const tag = structure.tag.toLowerCase();
        if (tag.includes('list') || tag.includes('array')) {
          logger.info('[TaskRegistry] Detected list/array in structure tag');
          return {
            kind: 'collection',
            collectionType: { kind: 'struct' }, // Unknown element type
          };
        }
      }
    }

    // Simple type - CHECK LAST
    // Only use simple type if no other type information is available
    if (literalType.simple !== undefined && literalType.simple !== null) {
      logger.info(`[TaskRegistry] Detected simple type: ${literalType.simple}`);
      return {
        kind: 'simple',
        simple: literalType.simple as SimpleType,
      };
    }

    // Default to struct
    logger.info('[TaskRegistry] Defaulting to struct type');
    return {
      kind: 'struct',
    };
  }

  /**
   * Build cache key from task ID
   */
  private static buildCacheKey(taskId: TaskId): string {
    return `${taskId.project}:${taskId.domain}:${taskId.name}:${taskId.version}`;
  }

  /**
   * Add interface to cache with LRU eviction
   */
  private addToCache(cacheKey: string, taskInterface: TaskInterface): void {
    // Check if cache is full
    if (this.cache.size >= this.config.maxCacheSize) {
      // Remove oldest entry (LRU)
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.info(`[TaskRegistry] Evicted cache entry: ${oldestKey}`);
      }
    }

    // Add to cache
    this.cache.set(cacheKey, {
      interface: taskInterface,
      expiresAt: taskInterface.expiresAt,
    });

    logger.info(
      `[TaskRegistry] Cached: ${cacheKey}, expires at ${taskInterface.expiresAt.toISOString()}`
    );
  }

  /**
   * Find oldest cache entry for LRU eviction
   */
  private findOldestEntry(): string | null {
    return Array.from(this.cache.entries()).reduce<{
      key: string | null;
      time: Date | null;
    }>(
      (acc, [key, entry]) => {
        if (!acc.time || entry.interface.fetchedAt < acc.time) {
          return { key, time: entry.interface.fetchedAt };
        }
        return acc;
      },
      { key: null, time: null }
    ).key;
  }
}
