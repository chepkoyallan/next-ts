/**
 * Task Interface Service
 * Fetches and analyzes task interfaces from Flyte Admin to determine parameter wrapping strategy
 */

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';
import type { AdminService } from '@app/engine/services/admin-service';

/**
 * Cache for task interfaces to avoid repeated Flyte API calls
 */
const taskInterfaceCache = new Map<string, flyteidl.core.ITypedInterface>();

/**
 * Analysis result for parameter wrapping
 */
export interface WrappingAnalysis {
  wrapperParam: string | null;
  reason: string;
  wrapInCollection?: boolean; // True if fields should be wrapped in an object then into a list
}

/**
 * Service to fetch and analyze task interfaces from Flyte
 */
export class TaskInterfaceService {
  private adminService: AdminService;

  constructor(adminService: AdminService) {
    this.adminService = adminService;
  }

  /**
   * Get task interface from Flyte Admin (with caching)
   */
  async getTaskInterface(
    taskId: flyteidl.core.IIdentifier
  ): Promise<flyteidl.core.ITypedInterface | null> {
    const cacheKey = `${taskId.project}:${taskId.domain}:${taskId.name}:${taskId.version}`;

    // Check cache first
    if (taskInterfaceCache.has(cacheKey)) {
      console.log(`[TaskInterface] Cache hit for ${cacheKey}`);
      return taskInterfaceCache.get(cacheKey)!;
    }

    try {
      console.log(`[TaskInterface] Fetching task interface for ${cacheKey}`);
      console.log(`[TaskInterface] Task ID details:`, JSON.stringify(taskId, null, 2));

      const task = await this.adminService.getTask({
        id: taskId,
      });

      console.log(`[TaskInterface] Got task response:`, {
        hasTask: !!task,
        hasClosure: !!task?.closure,
        hasCompiledTask: !!task?.closure?.compiledTask,
        hasTemplate: !!task?.closure?.compiledTask?.template,
        hasInterface: !!task?.closure?.compiledTask?.template?.interface,
      });

      const taskInterface = task.closure?.compiledTask?.template?.interface;

      if (taskInterface) {
        taskInterfaceCache.set(cacheKey, taskInterface);
        console.log(`[TaskInterface] ✅ Cached interface for ${cacheKey}:`, {
          inputs: Object.keys(taskInterface.inputs?.variables || {}),
          outputs: Object.keys(taskInterface.outputs?.variables || {}),
        });
        return taskInterface;
      }

      console.warn(`[TaskInterface] No interface found for ${cacheKey}`);
      console.warn(`[TaskInterface] Task structure:`, JSON.stringify(task, null, 2));
      return null;
    } catch (error: any) {
      console.error(`[TaskInterface] Failed to fetch task ${cacheKey}:`, {
        errorName: error?.name,
        errorMessage: error?.message,
        errorCode: error?.code,
        errorStack: error?.stack?.split('\n').slice(0, 3).join('\n'),
      });
      return null;
    }
  }

  /**
   * Analyze if UI fields need to be wrapped into a single parameter
   *
   * Returns:
   * - null: No wrapping needed (fields match task params 1:1)
   * - string: Wrapper parameter name (e.g., "config", "request")
   */
  async analyzeWrappingNeeded(
    taskId: flyteidl.core.IIdentifier,
    uiFields: string[]
  ): Promise<WrappingAnalysis> {
    console.log(`[TaskInterface] ===== WRAPPING ANALYSIS START =====`);
    console.log(`[TaskInterface] Task: ${taskId.name}`);
    console.log(`[TaskInterface] UI fields:`, uiFields);

    // PRIORITY 1: Check known tasks FIRST (before expensive gRPC call)
    // TODO: Move this to database configuration (FormAssignment.configuration)
    const knownTasks: Record<string, { param: string; isCollection: boolean }> = {
      'apiexecutor.pipeline.rest_api': { param: 'requests', isCollection: true },
      // Add more known tasks here as needed
    };

    const knownTaskConfig = taskId.name ? knownTasks[taskId.name] : undefined;
    if (knownTaskConfig && uiFields.length > 0) {
      console.log(
        `[TaskInterface] ✅ Task '${taskId.name}' has known wrapping config - wrapping into '${knownTaskConfig.param}'`
      );
      return {
        wrapperParam: knownTaskConfig.param,
        reason: `Known task configuration - wrapping ${uiFields.length} fields into '${
          knownTaskConfig.param
        }'${knownTaskConfig.isCollection ? ' list' : ''}`,
        wrapInCollection: knownTaskConfig.isCollection,
      };
    }

    // PRIORITY 2: Try fetching actual task interface from Flyte
    const taskInterface = await this.getTaskInterface(taskId);

    // FALLBACK: No task interface available
    if (!taskInterface || !taskInterface.inputs?.variables) {
      console.warn(
        `[TaskInterface] ⚠️  Task interface not available for ${taskId.name} - using heuristics`
      );

      // HEURISTIC 1: Check if UI provides schema metadata hint
      const uiHint = TaskInterfaceService.checkUISchemaHints(uiFields);
      if (uiHint) {
        return uiHint;
      }

      // HEURISTIC 3: If task name contains "batch" or field names suggest list processing, assume collection wrapping
      const taskNameLower = (taskId.name || '').toLowerCase();
      const suggestsCollection =
        taskNameLower.includes('batch') ||
        taskNameLower.includes('multi') ||
        taskNameLower.includes('bulk');

      if (suggestsCollection && uiFields.length > 0) {
        console.log(
          `[TaskInterface] Task name '${taskId.name}' suggests collection processing - wrapping into 'requests'`
        );
        return {
          wrapperParam: 'requests',
          reason: `Task name suggests collection processing - wrapping ${uiFields.length} fields into 'requests' list`,
          wrapInCollection: true,
        };
      }

      return {
        wrapperParam: null,
        reason: 'No task interface and no UI hints - assuming flat parameters',
      };
    }

    const taskParams = Object.keys(taskInterface.inputs.variables);

    console.log('[TaskInterface] Task params:', taskParams);
    console.log('[TaskInterface] Task params count:', taskParams.length);
    console.log('[TaskInterface] UI fields count:', uiFields.length);

    // Case 1: Task has SINGLE parameter
    if (taskParams.length === 1) {
      const singleParam = taskParams[0];
      const paramType = taskInterface.inputs.variables[singleParam]?.type;

      // Check if it's a struct/object type
      if (paramType?.simple === flyteidl.core.SimpleType.STRUCT) {
        console.log(`[TaskInterface] ✅ Task expects single STRUCT parameter '${singleParam}'`);
        return {
          wrapperParam: singleParam,
          reason: `Task has single struct parameter '${singleParam}' - UI fields should be wrapped`,
        };
      }

      // Check if it's a Union type (Flyte represents Pydantic Union types this way)
      if (paramType?.unionType) {
        console.log(
          `[TaskInterface] ✅ Task expects single UNION parameter '${singleParam}' - likely needs wrapping`
        );
        return {
          wrapperParam: singleParam,
          reason: `Task has single union parameter '${singleParam}' - UI fields should be wrapped`,
        };
      }

      // Single parameter but not struct/union - check if UI has multiple fields
      if (uiFields.length > 1) {
        console.warn(
          `[TaskInterface] ⚠️  Mismatch: Task expects single param '${singleParam}' but UI has ${uiFields.length} fields`
        );
        // Assume wrapping needed
        return {
          wrapperParam: singleParam,
          reason: `Task expects single parameter but UI has multiple fields - wrapping into '${singleParam}'`,
        };
      }
    }

    // Case 2: Task has MULTIPLE parameters, check if UI fields match
    const unmatchedFields = uiFields.filter((field) => !taskParams.includes(field));
    const unmatchedParams = taskParams.filter((param) => !uiFields.includes(param));

    if (unmatchedFields.length === 0 && unmatchedParams.length === 0) {
      console.log('[TaskInterface] ✅ UI fields match task parameters 1:1 - no wrapping needed');
      return {
        wrapperParam: null,
        reason: 'UI fields match task parameters exactly',
      };
    }

    // Case 3: Check for COLLECTION type parameters (List)
    // If task expects List[RequestConfig], UI fields should be wrapped into object then into list
    const collectionParams = taskParams.filter((param) => {
      const paramType = taskInterface.inputs?.variables?.[param]?.type;
      return paramType?.collectionType !== undefined;
    });

    console.log('[TaskInterface] Collection parameter analysis:', {
      collectionParams,
      collectionCount: collectionParams.length,
      unmatchedFieldsCount: unmatchedFields.length,
      unmatchedFields,
      unmatchedParamsCount: unmatchedParams.length,
      unmatchedParams,
    });

    // ENHANCED LOGIC: Wrap if we have a single collection param and UI fields don't match ANY task param
    // This handles the case where task expects `requests: List[HttpRequest]` but UI provides `url, method, ...`
    if (collectionParams.length === 1) {
      const collectionParam = collectionParams[0];

      // If ALL UI fields are unmatched (none are direct task params), wrap them
      if (unmatchedFields.length === uiFields.length && uiFields.length > 0) {
        console.log(
          `[TaskInterface] ✅ Found collection parameter '${collectionParam}' with all UI fields unmatched - wrapping into list`
        );
        return {
          wrapperParam: collectionParam,
          reason: `Task expects list parameter '${collectionParam}' - wrapping UI fields into object then list`,
          wrapInCollection: true,
        };
      }

      // Original condition: Some fields match, some don't
      if (unmatchedFields.length > 0 && unmatchedFields.length < uiFields.length) {
        console.log(
          `[TaskInterface] ✅ Found collection parameter '${collectionParam}' with partial match - wrapping unmatched fields into list`
        );
        return {
          wrapperParam: collectionParam,
          reason: `Task expects list parameter '${collectionParam}' - wrapping UI fields into object then list`,
          wrapInCollection: true,
        };
      }
    } else if (collectionParams.length > 0) {
      console.log('[TaskInterface] ❌ Multiple collection params found - cannot auto-wrap:', {
        collectionParamsCount: collectionParams.length,
        collectionParams,
      });
    }

    // Case 4: Mismatch - check if ALL UI fields match a nested struct
    // Look for a task parameter that's a STRUCT type
    const structParams = taskParams.filter((param) => {
      const paramType = taskInterface.inputs?.variables?.[param]?.type;
      return paramType?.simple === flyteidl.core.SimpleType.STRUCT;
    });

    if (structParams.length === 1) {
      console.log(
        `[TaskInterface] ✅ Found single struct parameter '${structParams[0]}' - likely wrapper`
      );
      return {
        wrapperParam: structParams[0],
        reason: `Task has struct parameter '${structParams[0]}' that may contain UI fields`,
      };
    }

    if (structParams.length > 1) {
      // Multiple struct params - choose the first one that might match
      console.warn(
        `[TaskInterface] ⚠️  Multiple struct parameters found: ${structParams.join(', ')}`
      );
      return {
        wrapperParam: structParams[0],
        reason: `Task has multiple struct parameters - using first one '${structParams[0]}'`,
      };
    }

    // Case 4: Cannot determine - log warning and don't wrap
    console.warn('[TaskInterface] ⚠️  Cannot determine wrapping strategy:', {
      taskParams,
      uiFields,
      unmatchedFields,
      unmatchedParams,
    });

    return {
      wrapperParam: null,
      reason: 'Cannot determine wrapping - assuming flat parameters',
    };
  }

  /**
   * Check if UI provides hints about parameter structure
   * (This would be set by the UI based on user configuration or form structure)
   */
  private static checkUISchemaHints(uiFields: string[]): WrappingAnalysis | null {
    // Could check for special field naming patterns:
    // - If all fields start with same prefix: "config.field1", "config.field2"
    // - If UI metadata includes wrapper hint

    // Example: Detect common prefix
    if (uiFields.length > 1) {
      const firstDotIndex = uiFields[0].indexOf('.');
      if (firstDotIndex > 0) {
        const prefix = uiFields[0].substring(0, firstDotIndex);
        const allHaveSamePrefix = uiFields.every((field) => field.startsWith(`${prefix}.`));

        if (allHaveSamePrefix) {
          console.log(`[TaskInterface] Detected common prefix '${prefix}' in UI fields`);
          return {
            wrapperParam: prefix,
            reason: `UI fields all prefixed with '${prefix}'`,
          };
        }
      }
    }

    return null;
  }

  /**
   * Clear cache (useful for testing)
   */
  static clearCache(): void {
    taskInterfaceCache.clear();
    console.log('[TaskInterface] Cache cleared');
  }

  /**
   * Get the output variable name for a task
   * Returns the first output variable name (most tasks have single output)
   * Returns 'o0' as fallback if no output found
   */
  async getOutputVariableName(taskId: flyteidl.core.IIdentifier): Promise<string> {
    const taskInterface = await this.getTaskInterface(taskId);

    if (!taskInterface || !taskInterface.outputs?.variables) {
      console.warn(
        `[TaskInterface] No output interface found for ${taskId.name} - using default 'o0'`
      );
      return 'o0';
    }

    const outputVars = Object.keys(taskInterface.outputs.variables);
    if (outputVars.length === 0) {
      console.warn(
        `[TaskInterface] Task ${taskId.name} has no output variables - using default 'o0'`
      );
      return 'o0';
    }

    const outputVarName = outputVars[0];
    console.log(`[TaskInterface] Task ${taskId.name} outputs variable: '${outputVarName}'`);
    return outputVarName;
  }

  /**
   * Get cache stats (for debugging)
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: taskInterfaceCache.size,
      keys: Array.from(taskInterfaceCache.keys()),
    };
  }
}
