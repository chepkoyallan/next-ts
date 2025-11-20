/**
 * Field Analysis Utilities
 * Analyzes API responses to extract fields and suggest mappings
 */

import { FieldMapping } from '../types';

export interface DiscoveredField {
  name: string;
  type: string;
  path: string;
  sample?: any;
  isArray?: boolean;
  isNested?: boolean;
  children?: DiscoveredField[];
}

export interface FieldSuggestion {
  sourceField: string;
  targetField: string;
  transformExpression?: string;
  confidence: number; // 0-100
  reason: string;
}

export interface DiscoveryResult {
  fields: DiscoveredField[];
  rootPath: string;
  suggestions: FieldSuggestion[];
  valueField?: string;
  displayField?: string;
  searchFields?: string[];
  sampleData: any[];
}

/**
 * Analyze response data and discover fields
 */
export function analyzeResponseData(data: any): DiscoveryResult {
  // Find root path if response is nested
  const rootPath = findRootPath(data);

  // Extract array data
  let arrayData = extractArrayData(data, rootPath);

  if (!arrayData || arrayData.length === 0) {
    arrayData = Array.isArray(data) ? data : [data];
  }

  // Take sample of first 5 records
  const sampleData = arrayData.slice(0, 5);

  // Discover fields from sample
  const fields = discoverFields(sampleData);

  // Generate smart suggestions
  const suggestions = generateFieldSuggestions(fields);

  // Detect value and display fields
  const valueField = detectValueField(fields);
  const displayField = detectDisplayField(fields);
  const searchFields = detectSearchableFields(fields);

  return {
    fields,
    rootPath,
    suggestions,
    valueField,
    displayField,
    searchFields,
    sampleData,
  };
}

/**
 * Find root path to array data in response
 */
function findRootPath(data: any): string {
  if (Array.isArray(data)) {
    return '$';
  }

  // Common patterns
  const commonPaths = ['data', 'results', 'items', 'records', 'entries', 'rows', 'list', 'content'];

  const commonPath = commonPaths.find((path) => data[path] && Array.isArray(data[path]));
  if (commonPath) {
    return `$.${commonPath}`;
  }

  // Check nested one level deeper
  const nestedPath = Object.keys(data).find((key) => {
    if (typeof data[key] === 'object' && data[key] !== null) {
      return Object.keys(data[key]).some((nestedKey) => Array.isArray(data[key][nestedKey]));
    }
    return false;
  });

  if (nestedPath && typeof data[nestedPath] === 'object' && data[nestedPath] !== null) {
    const nestedKey = Object.keys(data[nestedPath]).find((key) =>
      Array.isArray(data[nestedPath][key])
    );
    if (nestedKey) {
      return `$.${nestedPath}.${nestedKey}`;
    }
  }

  return '$';
}

/**
 * Extract array data from response
 */
function extractArrayData(data: any, rootPath: string): any[] {
  if (rootPath === '$') {
    return Array.isArray(data) ? data : [data];
  }

  const path = rootPath.replace(/^\$\./, '').split('.');

  const current = path.reduce((acc, segment) => {
    if (!acc) return null;
    return acc[segment];
  }, data);

  return Array.isArray(current) ? current : [];
}

/**
 * Discover fields from sample data
 */
function discoverFields(sampleData: any[]): DiscoveredField[] {
  if (sampleData.length === 0) return [];

  const fieldMap = new Map<string, DiscoveredField>();

  // Analyze each record
  sampleData.forEach((record) => {
    if (typeof record === 'object' && record !== null) {
      discoverFieldsRecursive(record, '', fieldMap);
    }
  });

  return Array.from(fieldMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Recursively discover fields
 */
function discoverFieldsRecursive(
  obj: any,
  prefix: string,
  fieldMap: Map<string, DiscoveredField>,
  depth = 0
): void {
  if (depth > 3) return; // Limit nesting depth

  Object.entries(obj).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const type = getFieldType(value);

    if (!fieldMap.has(path)) {
      fieldMap.set(path, {
        name: key,
        type,
        path,
        sample: getSampleValue(value),
        isArray: Array.isArray(value),
        isNested: type === 'object' && !Array.isArray(value),
      });
    }

    // Recurse into nested objects (but not arrays)
    if (type === 'object' && !Array.isArray(value) && value !== null) {
      discoverFieldsRecursive(value, path, fieldMap, depth + 1);
    }
  });
}

/**
 * Get field type
 */
function getFieldType(value: any): string {
  if (value === null || value === undefined) return 'unknown';
  if (Array.isArray(value)) return 'array';

  const type = typeof value;

  if (type === 'object') {
    // Check for date
    if (value instanceof Date || isDateString(value)) return 'date';
    return 'object';
  }

  if (type === 'string') {
    if (isEmailString(value)) return 'email';
    if (isUrlString(value)) return 'url';
    if (isDateString(value)) return 'date';
  }

  return type;
}

/**
 * Get sample value (limit size)
 */
function getSampleValue(value: any): any {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    return value.length > 50 ? `${value.substring(0, 50)}...` : value;
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (typeof value === 'object') {
    return `Object(${Object.keys(value).length} keys)`;
  }

  return value;
}

/**
 * Generate smart field mapping suggestions
 */
function generateFieldSuggestions(fields: DiscoveredField[]): FieldSuggestion[] {
  const suggestions: FieldSuggestion[] = [];

  fields.forEach((field) => {
    const suggestion = suggestMapping(field);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  });

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Suggest mapping for a single field
 */
function suggestMapping(field: DiscoveredField): FieldSuggestion | null {
  const { name, type, path } = field;
  const normalized = normalizeFieldName(name);

  // ID fields
  if (matchesPattern(name, ['id', '_id', 'uid', 'uuid', 'key'])) {
    return {
      sourceField: path,
      targetField: 'id',
      confidence: 95,
      reason: 'Identified as ID field',
    };
  }

  // Name fields
  if (matchesPattern(name, ['name', 'title', 'label', 'display_name', 'full_name'])) {
    return {
      sourceField: path,
      targetField: 'name',
      transformExpression: 'trim',
      confidence: 90,
      reason: 'Identified as name/title field',
    };
  }

  // Email fields
  if (type === 'email' || matchesPattern(name, ['email', 'email_address', 'mail'])) {
    return {
      sourceField: path,
      targetField: 'email',
      transformExpression: 'lowercase',
      confidence: 95,
      reason: 'Identified as email field',
    };
  }

  // Date fields
  if (type === 'date' || matchesPattern(name, ['date', 'created', 'updated', 'timestamp'])) {
    return {
      sourceField: path,
      targetField: normalized,
      transformExpression: 'date',
      confidence: 85,
      reason: 'Identified as date field',
    };
  }

  // Phone fields
  if (matchesPattern(name, ['phone', 'mobile', 'telephone', 'cell'])) {
    return {
      sourceField: path,
      targetField: 'phone',
      transformExpression: 'trim',
      confidence: 85,
      reason: 'Identified as phone field',
    };
  }

  // Status fields
  if (matchesPattern(name, ['status', 'state', 'active', 'enabled'])) {
    return {
      sourceField: path,
      targetField: 'status',
      confidence: 80,
      reason: 'Identified as status field',
    };
  }

  // Generic mapping (lower confidence)
  return {
    sourceField: path,
    targetField: normalized,
    confidence: 60,
    reason: 'Generic field mapping',
  };
}

/**
 * Normalize field name (convert to standard format)
 */
function normalizeFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, '_$1') // camelCase to snake_case
    .toLowerCase()
    .replace(/^(customer|user|contact|account|client)_/, '') // Remove common prefixes
    .replace(/_id$/, '') // Remove _id suffix
    .replace(/^_+|_+$/g, '') // Trim underscores
    .replace(/_+/g, '_'); // Collapse multiple underscores
}

/**
 * Check if field name matches patterns
 */
function matchesPattern(name: string, patterns: string[]): boolean {
  const normalized = name.toLowerCase().replace(/[_-]/g, '');
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.toLowerCase().replace(/[_-]/g, '');
    return normalized.includes(normalizedPattern);
  });
}

/**
 * Detect value field (best field to use as value)
 */
function detectValueField(fields: DiscoveredField[]): string | undefined {
  // Priority: id, _id, uuid, key
  const idField = fields.find((f) => matchesPattern(f.name, ['id', '_id', 'uuid', 'key', 'uid']));
  if (idField) return idField.name;

  // Fallback to first field
  return fields[0]?.name;
}

/**
 * Detect display field (best field to show to users)
 */
function detectDisplayField(fields: DiscoveredField[]): string | undefined {
  // Priority: name, title, label, display_name
  const displayField = fields.find((f) =>
    matchesPattern(f.name, ['name', 'title', 'label', 'display_name', 'full_name'])
  );
  if (displayField) return displayField.name;

  // Fallback to second field or first non-id field
  const nonIdField = fields.find((f) => !matchesPattern(f.name, ['id', '_id', 'uuid']));
  return nonIdField?.name || fields[1]?.name;
}

/**
 * Detect searchable fields (text fields that can be searched)
 */
function detectSearchableFields(fields: DiscoveredField[]): string[] {
  return fields
    .filter(
      (f) =>
        f.type === 'string' &&
        !matchesPattern(f.name, ['id', '_id', 'uuid', 'key', 'password', 'token', 'secret'])
    )
    .map((f) => f.name)
    .slice(0, 5); // Limit to 5 searchable fields
}

/**
 * Helper: Check if string is an email
 */
function isEmailString(value: any): boolean {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Helper: Check if string is a URL
 */
function isUrlString(value: any): boolean {
  if (typeof value !== 'string') return false;
  try {
    const parsedUrl = new URL(value);
    return Boolean(parsedUrl.protocol);
  } catch {
    return false;
  }
}

/**
 * Helper: Check if string is a date
 */
function isDateString(value: any): boolean {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

/**
 * Convert suggestions to field mappings
 */
export function suggestionsToMappings(
  suggestions: FieldSuggestion[],
  minConfidence = 70
): FieldMapping[] {
  return suggestions
    .filter((s) => s.confidence >= minConfidence)
    .map((s) => ({
      sourceField: s.sourceField,
      targetField: s.targetField,
      transformExpression: s.transformExpression,
    }));
}

/**
 * Apply confidence-based filtering
 */
export function filterSuggestionsByConfidence(
  suggestions: FieldSuggestion[],
  minConfidence = 70
): FieldSuggestion[] {
  return suggestions.filter((s) => s.confidence >= minConfidence);
}
