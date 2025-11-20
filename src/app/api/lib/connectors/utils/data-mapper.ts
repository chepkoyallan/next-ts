/**
 * Data Mapping Utilities
 * Utilities for extracting and transforming data from connector responses
 */

import { DataMapping } from '../types';

/**
 * Extract data from response using JSONPath
 */
export function extractDataFromResponse(response: any, rootPath?: string): any {
  if (!rootPath) {
    return response;
  }

  try {
    return jsonPath(response, rootPath);
  } catch (error) {
    console.error('Failed to extract data from response', { rootPath, error });
    return response;
  }
}

/**
 * Apply field mappings to data
 */
export function applyDataMapping(data: any[], mapping: DataMapping): any[] {
  if (!mapping.mappings || mapping.mappings.length === 0) {
    return data;
  }

  return data.map((item) => {
    const mappedItem: any = { ...item };

    mapping.mappings.forEach((fieldMapping) => {
      const sourceValue = getNestedValue(item, fieldMapping.sourceField);

      let transformedValue = sourceValue;

      // Apply transform function if provided
      if (fieldMapping.transform && sourceValue !== undefined) {
        transformedValue = fieldMapping.transform(sourceValue);
      }

      // Apply transform expression if provided
      if (fieldMapping.transformExpression && sourceValue !== undefined) {
        transformedValue = applyTransformExpression(sourceValue, fieldMapping.transformExpression);
      }

      setNestedValue(mappedItem, fieldMapping.targetField, transformedValue);
    });

    return mappedItem;
  });
}

/**
 * Simple JSONPath implementation
 * Supports: $.field, $.field.nested, $.array[*], $.array[0]
 */
function jsonPath(obj: any, path: string): any {
  // Remove leading $. if present
  const cleanPath = path.replace(/^\$\.?/, '');

  if (!cleanPath) {
    return obj;
  }

  const segments = cleanPath.split('.');
  let current = obj;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment.includes('[')) {
      // Handle array access: field[*] or field[0]
      const [field, index] = segment.split('[');
      const indexValue = index.replace(']', '');

      current = current[field];

      if (!current) {
        return undefined;
      }

      if (indexValue === '*') {
        // Return all array elements
        return current;
      }

      // Return specific index
      current = current[parseInt(indexValue, 10)];
    } else {
      current = current[segment];
    }

    if (current === undefined) {
      return undefined;
    }
  }

  return current;
}

/**
 * Get nested value from object using dot notation
 */
export function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Handle array access
    if (key.includes('[')) {
      const [field, index] = key.split('[');
      const indexValue = parseInt(index.replace(']', ''), 10);
      return current[field]?.[indexValue];
    }

    return current[key];
  }, obj);
}

/**
 * Set nested value in object using dot notation
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;

  let current = obj;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}

/**
 * Apply transform expression to a value
 */
export function applyTransformExpression(value: any, expression: string): any {
  switch (expression.toLowerCase()) {
    case 'uppercase':
      return String(value).toUpperCase();

    case 'lowercase':
      return String(value).toLowerCase();

    case 'trim':
      return String(value).trim();

    case 'number':
      return Number(value);

    case 'string':
      return String(value);

    case 'boolean':
      return Boolean(value);

    case 'date':
      return new Date(value);

    case 'json':
      return JSON.parse(value);

    case 'json_stringify':
      return JSON.stringify(value);

    default:
      // Check for function expressions like "eq('active')" or "gt(100)"
      if (expression.includes('(')) {
        return applyFunctionExpression(value, expression);
      }

      return value;
  }
}

/**
 * Apply function expression to a value
 * Examples: eq('active'), ne('inactive'), gt(100), lt(50)
 */
function applyFunctionExpression(value: any, expression: string): any {
  const match = expression.match(/^(\w+)\((.*)\)$/);

  if (!match) {
    return value;
  }

  const [, func, argStr] = match;
  const arg = parseArgument(argStr);

  switch (func) {
    case 'eq':
      return value === arg;

    case 'ne':
      return value !== arg;

    case 'gt':
      return value > arg;

    case 'gte':
      return value >= arg;

    case 'lt':
      return value < arg;

    case 'lte':
      return value <= arg;

    case 'contains':
      return String(value).includes(String(arg));

    case 'startswith':
      return String(value).startsWith(String(arg));

    case 'endswith':
      return String(value).endsWith(String(arg));

    case 'replace': {
      const [search, replace] = argStr.split(',').map((s) => s.trim().replace(/['"]/g, ''));
      return String(value).replace(new RegExp(search, 'g'), replace);
    }

    case 'slice': {
      const [start, end] = argStr.split(',').map((s) => parseInt(s.trim(), 10));
      return String(value).slice(start, end);
    }

    case 'concat':
      return String(value) + String(arg);

    case 'prepend':
      return String(arg) + String(value);

    case 'default':
      return value !== undefined && value !== null && value !== '' ? value : arg;

    default:
      return value;
  }
}

/**
 * Parse argument from function expression
 */
function parseArgument(argStr: string): any {
  argStr = argStr.trim();

  // Remove quotes
  if (
    (argStr.startsWith('"') && argStr.endsWith('"')) ||
    (argStr.startsWith("'") && argStr.endsWith("'"))
  ) {
    return argStr.slice(1, -1);
  }

  // Parse number
  if (!Number.isNaN(Number(argStr))) {
    return Number(argStr);
  }

  // Parse boolean
  if (argStr === 'true') return true;
  if (argStr === 'false') return false;

  // Parse null
  if (argStr === 'null') return null;

  return argStr;
}

/**
 * Validate data against mapping schema
 */
export function validateDataMapping(
  data: any[],
  mapping: DataMapping
): {
  valid: boolean;
  errors: Array<{ index: number; field: string; error: string }>;
} {
  const errors: Array<{ index: number; field: string; error: string }> = [];

  data.forEach((item, index) => {
    // Check if required fields exist
    if (!item[mapping.valueField]) {
      errors.push({
        index,
        field: mapping.valueField,
        error: 'Value field is missing',
      });
    }

    if (!item[mapping.displayField]) {
      errors.push({
        index,
        field: mapping.displayField,
        error: 'Display field is missing',
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
