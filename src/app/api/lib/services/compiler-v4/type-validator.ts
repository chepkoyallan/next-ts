/**
 * Type Validator
 *
 * Deep validation of binding data against expected Flyte types
 * Implements TODO from binding-engine.ts:229
 */

import { logger } from 'src/app/api/lib/utils/logger';

import type { FlyteType, BindingError } from './types-v4';
import { prettyPrintType, BindingErrorCode, getValueTypeName } from './types-v4';

export interface TypeValidationResult {
  valid: boolean;
  errors: BindingError[];
}

export class TypeValidator {
  /**
   * Validate a value against an expected Flyte type
   */
  static validate(
    value: any,
    expectedType: FlyteType,
    fieldName: string,
    path: string = fieldName
  ): TypeValidationResult {
    const errors: BindingError[] = [];

    try {
      this.validateRecursive(value, expectedType, fieldName, path, errors);
    } catch (error) {
      errors.push({
        field: fieldName,
        code: BindingErrorCode.CONVERSION_FAILED,
        message: `Validation failed: ${(error as Error).message}`,
        expectedType,
        actualValue: value,
        actualType: getValueTypeName(value),
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Recursive validation logic
   */
  private static validateRecursive(
    value: any,
    expectedType: FlyteType,
    fieldName: string,
    path: string,
    errors: BindingError[]
  ): void {
    // Handle null/undefined
    if (value === null || value === undefined) {
      errors.push({
        field: fieldName,
        code: BindingErrorCode.MISSING_REQUIRED,
        message: `Value at '${path}' is null or undefined`,
        expectedType,
        actualValue: value,
      });
      return;
    }

    switch (expectedType.kind) {
      case 'simple':
        this.validateSimpleType(value, expectedType.simple!, fieldName, path, errors);
        break;

      case 'collection':
        this.validateCollectionType(value, expectedType.collectionType!, fieldName, path, errors);
        break;

      case 'map':
        this.validateMapType(value, expectedType.mapValueType!, fieldName, path, errors);
        break;

      case 'struct':
        this.validateStructType(value, expectedType, fieldName, path, errors);
        break;

      case 'union':
        this.validateUnionType(value, expectedType.unionTypes!, fieldName, path, errors);
        break;

      case 'blob':
        this.validateBlobType(value, fieldName, path, errors);
        break;

      default:
        errors.push({
          field: fieldName,
          code: BindingErrorCode.TYPE_MISMATCH,
          message: `Unsupported type kind: ${expectedType.kind}`,
          expectedType,
          actualValue: value,
        });
    }
  }

  /**
   * Validate simple types
   */
  private static validateSimpleType(
    value: any,
    simpleType: number,
    fieldName: string,
    path: string,
    errors: BindingError[]
  ): void {
    switch (simpleType) {
      case 0: // NONE - any type allowed
        break;

      case 1: // INTEGER
        if (!Number.isInteger(value)) {
          errors.push({
            field: fieldName,
            code: BindingErrorCode.TYPE_MISMATCH,
            message: `Expected integer at '${path}', got ${typeof value}`,
            actualValue: value,
            actualType: getValueTypeName(value),
            suggestion: 'Provide a whole number (e.g., 42, -10)',
          });
        }
        break;

      case 2: // FLOAT
        if (typeof value !== 'number') {
          errors.push({
            field: fieldName,
            code: BindingErrorCode.TYPE_MISMATCH,
            message: `Expected float at '${path}', got ${typeof value}`,
            actualValue: value,
            actualType: getValueTypeName(value),
            suggestion: 'Provide a number (e.g., 3.14, 42.0)',
          });
        }
        break;

      case 3: // STRING
        if (typeof value !== 'string') {
          errors.push({
            field: fieldName,
            code: BindingErrorCode.TYPE_MISMATCH,
            message: `Expected string at '${path}', got ${typeof value}`,
            actualValue: value,
            actualType: getValueTypeName(value),
            suggestion: 'Provide text in quotes (e.g., "hello")',
          });
        }
        break;

      case 4: // BOOLEAN
        if (typeof value !== 'boolean') {
          errors.push({
            field: fieldName,
            code: BindingErrorCode.TYPE_MISMATCH,
            message: `Expected boolean at '${path}', got ${typeof value}`,
            actualValue: value,
            actualType: getValueTypeName(value),
            suggestion: 'Provide true or false',
          });
        }
        break;

      case 5: // DATETIME
        // Accept Date objects or ISO strings
        if (!(value instanceof Date) && typeof value !== 'string') {
          errors.push({
            field: fieldName,
            code: BindingErrorCode.TYPE_MISMATCH,
            message: `Expected datetime at '${path}', got ${typeof value}`,
            actualValue: value,
            actualType: getValueTypeName(value),
            suggestion: 'Provide ISO datetime string (e.g., "2023-10-19T12:00:00Z")',
          });
        }
        // Validate ISO string format
        if (typeof value === 'string') {
          const date = new Date(value);
          if (Number.isNaN(date.getTime())) {
            errors.push({
              field: fieldName,
              code: BindingErrorCode.TYPE_MISMATCH,
              message: `Invalid datetime format at '${path}': ${value}`,
              actualValue: value,
              suggestion: 'Use ISO 8601 format: YYYY-MM-DDTHH:mm:ssZ',
            });
          }
        }
        break;

      case 6: // DURATION
        if (typeof value !== 'string') {
          errors.push({
            field: fieldName,
            code: BindingErrorCode.TYPE_MISMATCH,
            message: `Expected duration string at '${path}', got ${typeof value}`,
            actualValue: value,
            actualType: getValueTypeName(value),
            suggestion: 'Provide duration (e.g., "1h30m", "45s")',
          });
        }
        break;

      case 9: // STRUCT
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push({
            field: fieldName,
            code: BindingErrorCode.TYPE_MISMATCH,
            message: `Expected object at '${path}', got ${getValueTypeName(value)}`,
            actualValue: value,
            actualType: getValueTypeName(value),
            suggestion: 'Provide an object with key-value pairs',
          });
        }
        break;

      default:
        logger.warn(`[TypeValidator] Unknown simple type: ${simpleType}`);
    }
  }

  /**
   * Validate collection (array) types
   */
  private static validateCollectionType(
    value: any,
    elementType: FlyteType,
    fieldName: string,
    path: string,
    errors: BindingError[]
  ): void {
    if (!Array.isArray(value)) {
      errors.push({
        field: fieldName,
        code: BindingErrorCode.TYPE_MISMATCH,
        message: `Expected array at '${path}', got ${getValueTypeName(value)}`,
        expectedType: { kind: 'collection', collectionType: elementType },
        actualValue: value,
        actualType: getValueTypeName(value),
        suggestion: 'Provide an array (e.g., [1, 2, 3])',
      });
      return;
    }

    // Validate each element
    value.forEach((item, index) => {
      this.validateRecursive(item, elementType, fieldName, `${path}[${index}]`, errors);
    });
  }

  /**
   * Validate map types
   */
  private static validateMapType(
    value: any,
    valueType: FlyteType,
    fieldName: string,
    path: string,
    errors: BindingError[]
  ): void {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push({
        field: fieldName,
        code: BindingErrorCode.TYPE_MISMATCH,
        message: `Expected object (map) at '${path}', got ${getValueTypeName(value)}`,
        expectedType: { kind: 'map', mapValueType: valueType },
        actualValue: value,
        actualType: getValueTypeName(value),
        suggestion: 'Provide an object with string keys (e.g., {"key": "value"})',
      });
      return;
    }

    // Validate each value
    Object.entries(value).forEach(([key, val]) => {
      this.validateRecursive(val, valueType, fieldName, `${path}.${key}`, errors);
    });
  }

  /**
   * Validate struct types
   */
  private static validateStructType(
    value: any,
    structType: FlyteType,
    fieldName: string,
    path: string,
    errors: BindingError[]
  ): void {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push({
        field: fieldName,
        code: BindingErrorCode.TYPE_MISMATCH,
        message: `Expected object at '${path}', got ${getValueTypeName(value)}`,
        expectedType: structType,
        actualValue: value,
        actualType: getValueTypeName(value),
      });
      return;
    }

    // If struct has field definitions, validate them
    if (structType.structFields) {
      Object.entries(structType.structFields).forEach(([key, fieldType]) => {
        if (value[key] !== undefined) {
          this.validateRecursive(value[key], fieldType, key, `${path}.${key}`, errors);
        }
      });
    }
  }

  /**
   * Validate union types (value must match at least one variant)
   */
  private static validateUnionType(
    value: any,
    unionTypes: FlyteType[],
    fieldName: string,
    path: string,
    errors: BindingError[]
  ): void {
    // Try each union variant
    const variantErrors: BindingError[][] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const variantType of unionTypes) {
      const variantResult: BindingError[] = [];
      this.validateRecursive(value, variantType, fieldName, path, variantResult);

      if (variantResult.length === 0) {
        // Valid for this variant
        return;
      }

      variantErrors.push(variantResult);
    }

    // None of the variants matched
    errors.push({
      field: fieldName,
      code: BindingErrorCode.TYPE_MISMATCH,
      message: `Value at '${path}' doesn't match any union variant`,
      expectedType: { kind: 'union', unionTypes },
      actualValue: value,
      actualType: getValueTypeName(value),
      suggestion: `Expected one of: ${unionTypes.map(prettyPrintType).join(' | ')}`,
    });
  }

  /**
   * Validate blob types (file URIs)
   */
  private static validateBlobType(
    value: any,
    fieldName: string,
    path: string,
    errors: BindingError[]
  ): void {
    // Blobs should be strings (URIs) or objects with uri property
    if (typeof value === 'string') {
      // Valid URI string
      return;
    }

    if (typeof value === 'object' && value !== null && typeof value.uri === 'string') {
      // Valid blob object
      return;
    }

    errors.push({
      field: fieldName,
      code: BindingErrorCode.TYPE_MISMATCH,
      message: `Expected blob (URI string) at '${path}', got ${getValueTypeName(value)}`,
      actualValue: value,
      actualType: getValueTypeName(value),
      suggestion: 'Provide a file path or URI (e.g., "s3://bucket/file.txt")',
    });
  }
}
