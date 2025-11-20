/**
 * Binding Engine
 *
 * Type-aware conversion of inputData to Flyte BindingData
 * Validates bindings against task interface
 */

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';
import { logger } from 'src/app/api/lib/utils/logger';

import { TypeValidator } from './type-validator';
import {
  prettyPrintType,
  BindingErrorCode,
  getValueTypeName,
  BindingWarningCode,
  DEFAULT_BINDING_OPTIONS,
} from './types-v4';
import type {
  FlyteType,
  SimpleType,
  BindingError,
  TaskInterface,
  BindingResult,
  BindingOptions,
  BindingWarning,
} from './types-v4';

/**
 * Binding Engine
 *
 * Handles conversion of inputData to Flyte BindingData with type validation
 */
export class BindingEngine {
  private options: BindingOptions;

  constructor(options: Partial<BindingOptions> = {}) {
    this.options = { ...DEFAULT_BINDING_OPTIONS, ...options };
  }

  /**
   * Create bindings for a node's inputData
   * @param inputData - The input data for the node
   * @param taskInterface - The task interface defining expected parameters
   * @param edgeMappings - Optional field mappings from incoming edges (sourceNodeId -> fieldMappings[])
   */
  createBindings(
    inputData: Record<string, any>,
    taskInterface: TaskInterface,
    edgeMappings?: Map<string, any[]>
  ): BindingResult {
    const bindings: flyteidl.core.IBinding[] = [];
    const skipped: string[] = [];
    const missing: string[] = [];
    const errors: BindingError[] = [];
    const warnings: BindingWarning[] = [];

    logger.info(`[BindingEngine] Creating bindings for task ${taskInterface.taskId.name}`);
    logger.info(`[BindingEngine] Input data fields: ${Object.keys(inputData).join(', ')}`);
    logger.info(
      `[BindingEngine] Task interface inputs: ${Array.from(taskInterface.inputs.keys()).join(', ')}`
    );
    logger.info(`[BindingEngine] Input data structure: ${JSON.stringify(inputData, null, 2)}`);

    // Log field mappings if provided
    if (edgeMappings && edgeMappings.size > 0) {
      logger.info(
        `[BindingEngine] Field mappings available from ${edgeMappings.size} source node(s)`
      );
      edgeMappings.forEach((mappings, sourceNodeId) => {
        logger.info(
          `[BindingEngine] Mappings from ${sourceNodeId}: ${JSON.stringify(mappings, null, 2)}`
        );
      });
    }

    // Log each parameter type from task interface
    Array.from(taskInterface.inputs.entries()).forEach(([paramName, variable]) => {
      logger.info(
        `[BindingEngine] Parameter '${paramName}' - Type: ${variable.type.kind}, Optional: ${variable.optional}`
      );
    });

    // Process each field in inputData
    Object.entries(inputData).forEach(([fieldName, value]) => {
      // Check if field exists in task interface
      const variable = taskInterface.inputs.get(fieldName);

      if (!variable) {
        // Field not in task interface
        if (this.options.skipUnknownFields) {
          skipped.push(fieldName);
          warnings.push({
            field: fieldName,
            code: BindingWarningCode.UNKNOWN_FIELD_SKIPPED,
            message: `Field '${fieldName}' not found in task interface, skipping`,
            action: 'Field was not bound to task input',
          });
          return;
        }
        errors.push({
          field: fieldName,
          code: BindingErrorCode.UNKNOWN_PARAMETER,
          message: `Field '${fieldName}' not found in task interface`,
          actualValue: value,
          suggestion: `Remove '${fieldName}' from inputData or check task signature`,
        });
        return;
      }

      // Handle null/undefined
      if (value === null || value === undefined) {
        if (this.options.allowNullForOptional && variable.optional) {
          warnings.push({
            field: fieldName,
            code: BindingWarningCode.NULL_FOR_OPTIONAL,
            message: `Optional parameter '${fieldName}' has null/undefined value, omitting binding`,
          });
          return;
        }
        // For required parameters, we'll let the binding creation handle it
      }

      // Deep type validation using TypeValidator before creating binding
      // Skip validation for promise references (they'll be resolved at runtime)
      const isPromiseReference =
        typeof value === 'string' && (value.startsWith('$node.') || value.startsWith('$workflow.'));

      if (variable.type && value !== null && value !== undefined && !isPromiseReference) {
        const validationResult = TypeValidator.validate(value, variable.type, fieldName);

        if (!validationResult.valid) {
          // Add all validation errors (TypeValidator already returns BindingError[])
          errors.push(...validationResult.errors);
          return; // Skip binding creation for invalid values
        }
      }

      // Create binding for this field
      try {
        // Log value details for collection types
        if (variable.type.kind === 'collection') {
          logger.info(`[BindingEngine] Binding collection field '${fieldName}':`, {
            valueType: Array.isArray(value) ? 'array' : typeof value,
            isArray: Array.isArray(value),
            arrayLength: Array.isArray(value) ? value.length : 'N/A',
            value: JSON.stringify(value, null, 2),
          });
        }

        const binding = this.createBinding(fieldName, value, variable.type, edgeMappings);
        bindings.push(binding);

        // Log the actual binding structure for debugging
        logger.info(`[BindingEngine] ✓ Bound field: ${fieldName}`);
        logger.info(`[BindingEngine] Binding structure for '${fieldName}':`, {
          hasScalar: !!binding.binding?.scalar,
          hasCollection: !!binding.binding?.collection,
          hasMap: !!binding.binding?.map,
          hasPromise: !!binding.binding?.promise,
          collectionLength: binding.binding?.collection?.bindings?.length,
          bindingPreview: JSON.stringify(binding, null, 2).substring(0, 500),
        });
      } catch (error) {
        errors.push({
          field: fieldName,
          code: BindingErrorCode.CONVERSION_FAILED,
          message: `Failed to create binding for '${fieldName}': ${(error as Error).message}`,
          expectedType: variable.type,
          actualValue: value,
          actualType: getValueTypeName(value),
        });
      }
    });

    // Check for missing required parameters
    Array.from(taskInterface.inputs.entries()).forEach(([paramName, variable]) => {
      if (!variable.optional && !(paramName in inputData)) {
        missing.push(paramName);

        // Provide helpful suggestion for common data structure issues
        let suggestion = `Add '${paramName}' to node's inputData`;

        // Check if this looks like a collection type with fields spread at top level
        if (variable.type.kind === 'collection') {
          const hasRelatedFields = Object.keys(inputData).some(
            (key) =>
              // Check if any inputData keys look like they should be nested
              key !== paramName && typeof inputData[key] !== 'undefined'
          );

          if (hasRelatedFields) {
            suggestion =
              `Parameter '${paramName}' expects an array, but inputData has individual fields. ` +
              `Wrap the current fields in a '${paramName}' array. ` +
              `Example: { "${paramName}": [{ ${Object.keys(inputData).slice(0, 3).join(', ')} }] }`;
          }
        }

        errors.push({
          field: paramName,
          code: BindingErrorCode.MISSING_REQUIRED,
          message: `Required parameter '${paramName}' not provided in inputData`,
          expectedType: variable.type,
          suggestion,
        });
      }
    });

    const success = errors.length === 0;

    logger.info(
      `[BindingEngine] Binding result: ${bindings.length} bound, ${skipped.length} skipped, ${missing.length} missing, ${errors.length} errors`
    );

    return {
      bindings,
      skipped,
      missing,
      errors,
      warnings,
      success,
    };
  }

  /**
   * Create a single binding
   */
  createBinding(
    paramName: string,
    value: any,
    expectedType: FlyteType,
    edgeMappings?: Map<string, any[]>
  ): flyteidl.core.IBinding {
    logger.info(
      `[BindingEngine] Creating binding for ${paramName}, expected type: ${prettyPrintType(
        expectedType
      )}`
    );

    const bindingData = this.valueToBindingData(value, expectedType, paramName, edgeMappings);

    return {
      var: paramName,
      binding: bindingData,
    };
  }

  /**
   * Validate bindings against task interface
   */
  static validateBindings(
    bindings: flyteidl.core.IBinding[],
    taskInterface: TaskInterface
  ): { valid: boolean; errors: BindingError[] } {
    const errors: BindingError[] = [];

    // Check each binding
    bindings.forEach((binding) => {
      const paramName = binding.var!;
      const variable = taskInterface.inputs.get(paramName);

      if (!variable) {
        errors.push({
          field: paramName,
          code: BindingErrorCode.UNKNOWN_PARAMETER,
          message: `Parameter '${paramName}' not found in task interface`,
        });
      }

      // Type validation is now done during binding creation (above)
      // No need to duplicate validation here
    });

    // Check for missing required parameters
    Array.from(taskInterface.inputs.entries()).forEach(([paramName, variable]) => {
      if (!variable.optional) {
        const hasBinding = bindings.some((b) => b.var === paramName);
        if (!hasBinding) {
          errors.push({
            field: paramName,
            code: BindingErrorCode.MISSING_REQUIRED,
            message: `Required parameter '${paramName}' has no binding`,
            expectedType: variable.type,
          });
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================================
  // PRIVATE METHODS - Type Conversion
  // ============================================================================

  /**
   * Convert JavaScript value to Flyte BindingData
   * Type-aware conversion based on expected Flyte type
   */
  private valueToBindingData(
    value: any,
    expectedType: FlyteType,
    fieldName: string,
    edgeMappings?: Map<string, any[]>
  ): flyteidl.core.IBindingData {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return { scalar: { primitive: { stringValue: '' } } };
    }

    // Check for workflow input reference (special syntax: "$workflow.param_name")
    if (typeof value === 'string' && value.startsWith('$workflow.')) {
      const workflowParam = value.substring('$workflow.'.length);
      logger.info(`[BindingEngine] Detected workflow input reference: ${workflowParam}`);
      return {
        promise: {
          nodeId: '__workflow__',
          var: workflowParam,
        },
      };
    }

    // Check for node output reference (special syntax: "$node.node_id.output_var")
    // Note: output_var can be nested like "user.email" or "response.data.items"
    if (typeof value === 'string' && value.startsWith('$node.')) {
      const parts = value.substring('$node.'.length).split('.');
      if (parts.length >= 2) {
        const nodeId = parts[0];
        const outputVar = parts.slice(1).join('.'); // Rejoin remaining parts for nested fields

        // Apply field mapping if available
        let sourceField = outputVar;
        if (edgeMappings?.has(nodeId)) {
          const mappings = edgeMappings.get(nodeId);
          // Find mapping where targetField matches the field we're binding to
          const mapping = mappings?.find((m: any) => m.targetField === fieldName);
          if (mapping) {
            const { sourceField: mappedSourceField } = mapping;
            sourceField = mappedSourceField;
            logger.info(
              `[BindingEngine] ✓ Applied field mapping: ${nodeId}.${mapping.sourceField} → ${fieldName} (target was ${outputVar})`
            );
          } else {
            logger.info(
              `[BindingEngine] No field mapping found for target field '${fieldName}' from node ${nodeId}, using direct reference: ${outputVar}`
            );
          }
        }

        logger.info(`[BindingEngine] Detected node output reference: ${nodeId}.${sourceField}`);
        return {
          promise: {
            nodeId,
            var: sourceField,
          },
        };
      }
    }

    // Match against expected type
    switch (expectedType.kind) {
      case 'simple':
        return this.valueToSimpleBinding(value, expectedType.simple!, fieldName);

      case 'collection':
        return this.valueToCollectionBinding(
          value,
          expectedType.collectionType!,
          fieldName,
          edgeMappings
        );

      case 'map':
        return this.valueToMapBinding(value, expectedType.mapValueType!, fieldName, edgeMappings);

      case 'struct':
        return this.valueToStructBinding(value, fieldName);

      case 'union': {
        // Try each union type in order
        const unionTypes = expectedType.unionTypes || [];
        const result = unionTypes.reduce<flyteidl.core.IBindingData | null>((acc, unionType) => {
          if (acc) return acc;
          try {
            return this.valueToBindingData(value, unionType, fieldName, edgeMappings);
          } catch {
            return null;
          }
        }, null);

        if (result) return result;

        throw new Error(
          `Value for '${fieldName}' doesn't match any union type: ${expectedType.unionTypes
            ?.map(prettyPrintType)
            .join(' | ')}`
        );
      }

      case 'blob':
        return BindingEngine.valueToBlobBinding(value, fieldName);

      default:
        throw new Error(`Unsupported type kind: ${expectedType.kind}`);
    }
  }

  /**
   * Convert value to simple type binding
   */
  private valueToSimpleBinding(
    value: any,
    simpleType: SimpleType,
    fieldName: string
  ): flyteidl.core.IBindingData {
    switch (simpleType) {
      case 0: // NONE - Type information not available (e.g., complex Python dataclass)
        // Treat as generic structure and infer types from the value
        logger.info(
          `[BindingEngine] Type NONE for '${fieldName}', inferring type from value (${getValueTypeName(
            value
          )})`
        );
        return this.inferBindingData(value, fieldName);

      case 1: // INTEGER
        if (typeof value === 'number' && Number.isInteger(value)) {
          return { scalar: { primitive: { integer: value as any } } };
        }
        if (this.options.mode === 'lenient' && typeof value === 'string') {
          const parsed = parseInt(value, 10);
          if (!Number.isNaN(parsed)) {
            return { scalar: { primitive: { integer: parsed as any } } };
          }
        }
        throw new Error(`Expected INTEGER for '${fieldName}', got ${typeof value}`);

      case 2: // FLOAT
        if (typeof value === 'number') {
          return { scalar: { primitive: { floatValue: value } } };
        }
        if (this.options.mode === 'lenient' && typeof value === 'string') {
          const parsed = parseFloat(value);
          if (!Number.isNaN(parsed)) {
            return { scalar: { primitive: { floatValue: parsed } } };
          }
        }
        throw new Error(`Expected FLOAT for '${fieldName}', got ${typeof value}`);

      case 3: // STRING
        if (typeof value === 'string') {
          return { scalar: { primitive: { stringValue: value } } };
        }
        if (this.options.mode === 'lenient') {
          return { scalar: { primitive: { stringValue: String(value) } } };
        }
        throw new Error(`Expected STRING for '${fieldName}', got ${typeof value}`);

      case 4: // BOOLEAN
        if (typeof value === 'boolean') {
          return { scalar: { primitive: { boolean: value } } };
        }
        if (this.options.mode === 'lenient' && typeof value === 'string') {
          if (value.toLowerCase() === 'true') {
            return { scalar: { primitive: { boolean: true } } };
          }
          if (value.toLowerCase() === 'false') {
            return { scalar: { primitive: { boolean: false } } };
          }
        }
        throw new Error(`Expected BOOLEAN for '${fieldName}', got ${typeof value}`);

      case 5: // DATETIME
        if (value instanceof Date) {
          return { scalar: { primitive: { datetime: value.toISOString() as any } } };
        }
        if (typeof value === 'string') {
          return { scalar: { primitive: { datetime: value as any } } };
        }
        throw new Error(`Expected DATETIME for '${fieldName}', got ${typeof value}`);

      case 6: // DURATION
        if (typeof value === 'string') {
          return { scalar: { primitive: { duration: value as any } } };
        }
        throw new Error(`Expected DURATION for '${fieldName}', got ${typeof value}`);

      case 9: // STRUCT
        return this.valueToStructBinding(value, fieldName);

      default:
        throw new Error(`Unsupported simple type: ${simpleType}`);
    }
  }

  /**
   * Convert value to collection binding
   */
  private valueToCollectionBinding(
    value: any,
    elementType: FlyteType,
    fieldName: string,
    edgeMappings?: Map<string, any[]>
  ): flyteidl.core.IBindingData {
    if (!Array.isArray(value)) {
      throw new Error(
        `Expected array for '${fieldName}' (collection type), got ${getValueTypeName(value)}`
      );
    }

    const bindings = value.map((item, index) =>
      this.valueToBindingData(item, elementType, `${fieldName}[${index}]`, edgeMappings)
    );

    return {
      collection: {
        bindings,
      },
    };
  }

  /**
   * Convert value to map binding
   */
  private valueToMapBinding(
    value: any,
    valueType: FlyteType,
    fieldName: string,
    edgeMappings?: Map<string, any[]>
  ): flyteidl.core.IBindingData {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(
        `Expected object for '${fieldName}' (map type), got ${getValueTypeName(value)}`
      );
    }

    const bindings: { [key: string]: flyteidl.core.IBindingData } = {};

    Object.entries(value).forEach(([key, val]) => {
      bindings[key] = this.valueToBindingData(val, valueType, `${fieldName}.${key}`, edgeMappings);
    });

    return {
      map: {
        bindings,
      },
    };
  }

  /**
   * Convert value to struct binding
   *
   * IMPORTANT: Flyte uses Google Protobuf Struct format for structured types
   * This means we create { scalar: { generic: { fields: {...} } } }
   * NOT { map: { bindings: {...} } }
   */
  private valueToStructBinding(value: any, fieldName: string): flyteidl.core.IBindingData {
    if (typeof value !== 'object' || value === null) {
      throw new Error(
        `Expected object for '${fieldName}' (struct type), got ${getValueTypeName(value)}`
      );
    }

    if (Array.isArray(value)) {
      throw new Error(
        `Expected object for '${fieldName}' (struct type), got array. ` +
          `If you want to pass multiple items, the task parameter should be a collection type.`
      );
    }

    // Convert object to Google Protobuf Struct format
    const fields: { [key: string]: any } = {};

    Object.entries(value).forEach(([key, val]) => {
      // Convert each value to google.protobuf.Value format
      fields[key] = this.valueToProtobufValue(val, `${fieldName}.${key}`);
    });

    return {
      scalar: {
        generic: {
          fields,
        },
      },
    };
  }

  /**
   * Convert JavaScript value to google.protobuf.Value format
   * Used for struct field values
   */
  private valueToProtobufValue(value: any, fieldName: string): any {
    if (value === null || value === undefined) {
      return { nullValue: 0 }; // google.protobuf.NullValue.NULL_VALUE
    }

    if (typeof value === 'string') {
      return { stringValue: value };
    }

    if (typeof value === 'number') {
      return { numberValue: value };
    }

    if (typeof value === 'boolean') {
      return { boolValue: value };
    }

    if (Array.isArray(value)) {
      return {
        listValue: {
          values: value.map((item, index) =>
            this.valueToProtobufValue(item, `${fieldName}[${index}]`)
          ),
        },
      };
    }

    if (typeof value === 'object') {
      const structFields: { [key: string]: any } = {};
      Object.entries(value).forEach(([key, val]) => {
        structFields[key] = this.valueToProtobufValue(val, `${fieldName}.${key}`);
      });
      return {
        structValue: {
          fields: structFields,
        },
      };
    }

    // Fallback to string
    logger.warn(`[BindingEngine] Unsupported value type for '${fieldName}', converting to string`);
    return { stringValue: String(value) };
  }

  /**
   * Convert value to blob binding
   */
  private static valueToBlobBinding(value: any, fieldName: string): flyteidl.core.IBindingData {
    // Blobs are typically URIs or file paths
    if (typeof value === 'string') {
      return { scalar: { blob: { uri: value } } };
    }

    if (typeof value === 'object' && value.uri) {
      return { scalar: { blob: { uri: value.uri } } };
    }

    throw new Error(
      `Expected blob (string URI) for '${fieldName}', got ${getValueTypeName(value)}`
    );
  }

  /**
   * Infer binding data from value (when type is unknown)
   * Used for struct fields where we don't have type information
   */
  private inferBindingData(value: any, fieldName: string): flyteidl.core.IBindingData {
    if (value === null || value === undefined) {
      return { scalar: { primitive: { stringValue: '' } } };
    }

    if (typeof value === 'string') {
      return { scalar: { primitive: { stringValue: value } } };
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return { scalar: { primitive: { integer: value as any } } };
      }
      return { scalar: { primitive: { floatValue: value } } };
    }

    if (typeof value === 'boolean') {
      return { scalar: { primitive: { boolean: value } } };
    }

    if (Array.isArray(value)) {
      const bindings = value.map((item, index) =>
        this.inferBindingData(item, `${fieldName}[${index}]`)
      );
      return { collection: { bindings } };
    }

    if (typeof value === 'object') {
      const bindings: { [key: string]: flyteidl.core.IBindingData } = {};
      Object.entries(value).forEach(([key, val]) => {
        bindings[key] = this.inferBindingData(val, `${fieldName}.${key}`);
      });
      return { map: { bindings } };
    }

    // Fallback
    return { scalar: { primitive: { stringValue: String(value) } } };
  }
}
