import addFormats from 'ajv-formats';
import Ajv, { ErrorObject, ValidateFunction } from 'ajv';

import { compareSchemas, type JsonSchema } from './schema-extraction';
import { type FlyteType, areFlyteTypesCompatible } from './flyte-type-mapper';

/**
 * Schema Type Checker - Validates type compatibility between task connections
 */
export class SchemaTypeChecker {
  private ajv: Ajv;

  private validators: Map<string, ValidateFunction>;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });

    // Add format validators (date-time, uri, email, etc.)
    addFormats(this.ajv);

    this.validators = new Map();
  }

  /**
   * Resolve $ref in a field schema to get actual type and title
   */
  private static resolveFieldType(
    fieldSchema: any,
    parentSchema: any
  ): { type: string; title?: string } {
    // Check if field has $ref
    if (fieldSchema.$ref) {
      const refPath = fieldSchema.$ref.split('/').pop();
      if (refPath) {
        // Check $defs (modern JSON Schema)
        if (parentSchema.$defs && parentSchema.$defs[refPath]) {
          const refDef = parentSchema.$defs[refPath];
          return {
            type: refDef.type || 'object',
            title: refDef.title || refPath,
          };
        }
        // Check definitions (legacy JSON Schema)
        if (parentSchema.definitions && parentSchema.definitions[refPath]) {
          const refDef = parentSchema.definitions[refPath];
          return {
            type: refDef.type || 'object',
            title: refDef.title || refPath,
          };
        }
        // Fallback: use ref name as title
        return { type: 'object', title: refPath };
      }
    }

    // No $ref, return direct type info
    return {
      type: fieldSchema.type || 'any',
      title: fieldSchema.title,
    };
  }

  /**
   * Check if source schema is compatible with target schema
   */
  public checkCompatibility(
    sourceSchema: JsonSchema,
    targetSchema: JsonSchema,
    fieldMappings?: Array<{ sourceField: string; targetField: string }>
  ): {
    compatible: boolean;
    errors: string[];
    warnings: string[];
    compatibilityScore: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Use schema comparison utility
    const comparisonResult = compareSchemas(sourceSchema, targetSchema);

    // Check if types match
    if (sourceSchema.type !== targetSchema.type) {
      errors.push(
        `Type mismatch: source is ${sourceSchema.type}, target expects ${targetSchema.type}`
      );
    }

    // Build a map of target fields that are satisfied by field mappings
    const mappedTargetFields = new Set<string>();
    if (fieldMappings) {
      fieldMappings.forEach((mapping) => {
        mappedTargetFields.add(mapping.targetField);
      });
    }

    // Check if source provides all required fields of target
    const targetRequired = targetSchema.required || [];
    const sourceProps = Object.keys(sourceSchema.properties || {});

    // Filter out required fields that are satisfied by field mappings
    const missingRequired = targetRequired.filter(
      (field) => !sourceProps.includes(field) && !mappedTargetFields.has(field)
    );
    if (missingRequired.length > 0) {
      errors.push(`Missing required fields: ${missingRequired.join(', ')}`);
    }

    // Build a mapping from target field to source field for mapped fields
    const fieldMappingMap = new Map<string, string>();
    if (fieldMappings) {
      fieldMappings.forEach((mapping) => {
        fieldMappingMap.set(mapping.targetField, mapping.sourceField);
      });
    }

    // Check property type compatibility
    const targetProps = targetSchema.properties || {};
    const sourcePropsObj = sourceSchema.properties || {};

    Object.entries(targetProps).forEach(([propName, targetProp]) => {
      // Check if this target property has a field mapping
      const mappedSourceField = fieldMappingMap.get(propName);
      const sourcePropToCheck = mappedSourceField
        ? sourcePropsObj[mappedSourceField]
        : sourcePropsObj[propName];

      if (sourcePropToCheck) {
        // Resolve $ref for both source and target
        const sourceResolved = SchemaTypeChecker.resolveFieldType(sourcePropToCheck, sourceSchema);
        const targetResolved = SchemaTypeChecker.resolveFieldType(targetProp, targetSchema);

        const sourceType = sourceResolved.type;
        const targetType = targetResolved.type;
        const sourceTitle = sourceResolved.title || sourceType;
        const targetTitle = targetResolved.title || targetType;

        // Skip type checking for 'any' types
        if (sourceType === 'any' || targetType === 'any') {
          return;
        }

        // Check if types match (either exact type or same schema title)
        const typesMatch = sourceType === targetType || sourceTitle === targetTitle;

        if (!typesMatch) {
          errors.push(
            `Property "${propName}" type mismatch: source is ${sourceTitle}, target expects ${targetTitle}`
          );
        }

        // For arrays, check if item types match
        if (sourceType === 'array' && targetType === 'array') {
          if (sourcePropToCheck.items?.type !== targetProp.items?.type) {
            warnings.push(
              `Property "${propName}" array item type may not match: source is ${sourcePropToCheck.items?.type}, target expects ${targetProp.items?.type}`
            );
          }
        }

        // For objects, recursively check
        if (sourceType === 'object' && targetType === 'object') {
          if (sourcePropToCheck.properties && targetProp.properties) {
            const nestedResult = this.checkCompatibility(
              sourcePropToCheck as JsonSchema,
              targetProp as JsonSchema
            );
            errors.push(...nestedResult.errors.map((e) => `${propName}.${e}`));
            warnings.push(...nestedResult.warnings.map((w) => `${propName}.${w}`));
          }
        }
      } else if (targetRequired.includes(propName) && !mappedTargetFields.has(propName)) {
        // Already caught above in missing required check, skip duplicate
      } else if (!mappedTargetFields.has(propName)) {
        warnings.push(`Property "${propName}" exists in target but not in source`);
      }
    });

    // Calculate compatibility score
    const { compatibilityScore } = comparisonResult;

    return {
      compatible: errors.length === 0 && compatibilityScore >= 70,
      errors,
      warnings,
      compatibilityScore,
    };
  }

  /**
   * Check if two Flyte types are compatible
   */
  public static checkFlyteTypeCompatibility(
    sourceType: FlyteType,
    targetType: FlyteType
  ): {
    compatible: boolean;
    reason?: string;
  } {
    const compatible = areFlyteTypesCompatible(sourceType, targetType);

    if (!compatible) {
      return {
        compatible: false,
        reason: `Incompatible Flyte types: ${JSON.stringify(sourceType)} vs ${JSON.stringify(
          targetType
        )}`,
      };
    }

    return { compatible: true };
  }

  /**
   * Validate data against a JSON schema
   */
  public validateData(
    data: any,
    schema: JsonSchema
  ): {
    valid: boolean;
    errors: ErrorObject[];
  } {
    try {
      // Get or create validator for this schema
      const schemaKey = JSON.stringify(schema);
      let validator = this.validators.get(schemaKey);

      if (!validator) {
        validator = this.ajv.compile(schema);
        this.validators.set(schemaKey, validator);
      }

      const valid = validator(data);

      return {
        valid: !!valid,
        errors: validator.errors || [],
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [
          {
            instancePath: '',
            schemaPath: '',
            keyword: 'error',
            params: {},
            message: error.message,
          } as ErrorObject,
        ],
      };
    }
  }

  /**
   * Check if a connection between two nodes is valid
   */
  public checkConnection(
    sourceNodeSchema: JsonSchema,
    targetNodeSchema: JsonSchema,
    sourceOutputName?: string,
    targetInputName?: string,
    fieldMappings?: Array<{ sourceField: string; targetField: string }>
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // If specific output/input names are provided, check those properties
    if (sourceOutputName && targetInputName) {
      const sourceOutput = sourceNodeSchema.properties?.[sourceOutputName];
      const targetInput = targetNodeSchema.properties?.[targetInputName];

      if (!sourceOutput) {
        errors.push(`Source node does not have output "${sourceOutputName}"`);
      }

      if (!targetInput) {
        errors.push(`Target node does not have input "${targetInputName}"`);
      }

      if (sourceOutput && targetInput) {
        // Check type compatibility
        if (sourceOutput.type !== targetInput.type) {
          errors.push(
            `Type mismatch: "${sourceOutputName}" is ${sourceOutput.type}, but "${targetInputName}" expects ${targetInput.type}`
          );
        }
      }
    } else {
      // Check overall schema compatibility
      const compatibility = this.checkCompatibility(
        sourceNodeSchema,
        targetNodeSchema,
        fieldMappings
      );
      errors.push(...compatibility.errors);
      warnings.push(...compatibility.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if a branch condition is valid
   */
  public static checkBranchCondition(
    condition: any,
    inputSchema: JsonSchema
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate that condition references valid fields from input
    if (condition.field) {
      const { field } = condition;
      const inputProps = inputSchema.properties || {};

      if (!inputProps[field]) {
        errors.push(`Condition field "${field}" does not exist in input schema`);
      } else {
        const fieldType = inputProps[field].type;

        // Check if operator is valid for field type
        if (condition.operator) {
          const validOperators = SchemaTypeChecker.getValidOperatorsForType(fieldType);

          if (!validOperators.includes(condition.operator)) {
            errors.push(
              `Operator "${condition.operator}" is not valid for field type "${fieldType}"`
            );
          }
        }

        // Check if condition value matches field type
        if (condition.value !== undefined) {
          const valueType = typeof condition.value;
          const expectedType = fieldType;

          if (!SchemaTypeChecker.isValueTypeCompatible(valueType, expectedType)) {
            errors.push(
              `Condition value type "${valueType}" does not match field type "${expectedType}"`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get valid operators for a given JSON Schema type
   */
  private static getValidOperatorsForType(type: string): string[] {
    const operatorMap: Record<string, string[]> = {
      string: ['equals', 'not_equals', 'contains', 'starts_with', 'ends_with', 'regex'],
      number: [
        'equals',
        'not_equals',
        'greater_than',
        'less_than',
        'greater_or_equal',
        'less_or_equal',
      ],
      integer: [
        'equals',
        'not_equals',
        'greater_than',
        'less_than',
        'greater_or_equal',
        'less_or_equal',
      ],
      boolean: ['equals', 'not_equals'],
      array: ['contains', 'length_equals', 'length_greater', 'length_less', 'is_empty'],
      object: ['has_property', 'property_equals', 'is_empty'],
    };

    return operatorMap[type] || ['equals', 'not_equals'];
  }

  /**
   * Check if a JavaScript value type is compatible with a JSON Schema type
   */
  private static isValueTypeCompatible(valueType: string, schemaType: string): boolean {
    const compatibilityMap: Record<string, string[]> = {
      string: ['string'],
      number: ['number', 'integer'],
      integer: ['number'],
      boolean: ['boolean'],
      array: ['object'], // typeof [] === 'object'
      object: ['object'],
    };

    return compatibilityMap[schemaType]?.includes(valueType) || false;
  }

  /**
   * Clear cached validators
   */
  public clearCache(): void {
    this.validators.clear();
  }
}

// Export singleton instance
export const schemaTypeChecker = new SchemaTypeChecker();
