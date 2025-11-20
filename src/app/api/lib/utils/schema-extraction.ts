import { mapFlyteTypeToJsonSchema } from './flyte-type-mapper';

/**
 * Flyte task interface structure
 */
export interface FlyteTaskInterface {
  inputs?: {
    variables?: Record<string, FlyteVariable>;
  };
  outputs?: {
    variables?: Record<string, FlyteVariable>;
  };
}

export interface FlyteVariable {
  type?: FlyteType;
  description?: string;
}

export interface FlyteType {
  simple?: string;
  schema?: any;
  structuredDatasetType?: any;
  collectionType?: FlyteType;
  mapValueType?: FlyteType;
  blob?: any;
  enumType?: any;
}

/**
 * JSON Schema structure
 */
export interface JsonSchema {
  type: string;
  title?: string;
  description?: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  definitions?: Record<string, any>;
}

/**
 * Extract JSON Schema from Flyte task interface
 */
export function extractSchemaFromTaskInterface(
  taskInterface: FlyteTaskInterface,
  schemaType: 'input' | 'output' = 'input'
): JsonSchema {
  const variables =
    schemaType === 'input'
      ? taskInterface.inputs?.variables || {}
      : taskInterface.outputs?.variables || {};

  const properties: Record<string, any> = {};
  const required: string[] = [];

  // Convert each Flyte variable to JSON Schema property
  Object.entries(variables).forEach(([name, variable]) => {
    const propertySchema = mapFlyteTypeToJsonSchema(variable.type || {});

    if (variable.description) {
      propertySchema.description = variable.description;
    }

    properties[name] = propertySchema;

    // In Flyte, all inputs are typically required unless marked optional
    // This is a simplified assumption - adjust based on your needs
    required.push(name);
  });

  return {
    type: 'object',
    title: `Task ${schemaType} schema`,
    properties,
    required: required.length > 0 ? required : undefined,
    additionalProperties: false,
  } as JsonSchema;
}

/**
 * Extract both input and output schemas from task interface
 */
export function extractSchemasFromTask(taskInterface: FlyteTaskInterface): {
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
} {
  return {
    inputSchema: extractSchemaFromTaskInterface(taskInterface, 'input'),
    outputSchema: extractSchemaFromTaskInterface(taskInterface, 'output'),
  };
}

/**
 * Validate if a JSON Schema is valid
 */
export function isValidJsonSchema(schema: any): boolean {
  if (!schema || typeof schema !== 'object') {
    return false;
  }

  // Basic validation - should have type
  if (!schema.type) {
    return false;
  }

  // If type is object, should have properties
  if (schema.type === 'object' && !schema.properties) {
    return false;
  }

  // If type is array, should have items
  if (schema.type === 'array' && !schema.items) {
    return false;
  }

  return true;
}

/**
 * Generate a descriptive name for a schema based on task info
 */
export function generateSchemaName(
  taskName: string,
  schemaType: 'input' | 'output',
  version?: string
): string {
  const suffix = schemaType === 'input' ? 'Input' : 'Output';
  const versionPart = version ? `_v${version.replace(/\./g, '_')}` : '';

  // Convert snake_case or kebab-case to PascalCase
  const pascalName = taskName
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

  return `${pascalName}${suffix}${versionPart}`;
}

/**
 * Generate tags for a schema based on task metadata
 */
export function generateSchemaTags(
  taskName: string,
  domain: string,
  schemaType: 'input' | 'output',
  customTags?: string[]
): string[] {
  const tags: string[] = [
    schemaType, // 'input' or 'output'
    domain, // e.g., 'development', 'production'
  ];

  // Add task name as tag
  tags.push(taskName.toLowerCase());

  // Add custom tags if provided
  if (customTags && Array.isArray(customTags)) {
    tags.push(...customTags);
  }

  // Remove duplicates
  return Array.from(new Set(tags));
}

/**
 * Merge two JSON Schemas (for schema evolution)
 */
export function mergeSchemas(baseSchema: JsonSchema, newSchema: JsonSchema): JsonSchema {
  // Simple merge strategy - new schema properties override base
  const merged: JsonSchema = {
    ...baseSchema,
    ...newSchema,
  };

  // Merge properties
  if (baseSchema.properties || newSchema.properties) {
    merged.properties = {
      ...(baseSchema.properties || {}),
      ...(newSchema.properties || {}),
    };
  }

  // Merge required fields
  if (baseSchema.required || newSchema.required) {
    const allRequired = [...(baseSchema.required || []), ...(newSchema.required || [])];
    merged.required = Array.from(new Set(allRequired));
  }

  // Merge definitions
  if (baseSchema.definitions || newSchema.definitions) {
    merged.definitions = {
      ...(baseSchema.definitions || {}),
      ...(newSchema.definitions || {}),
    };
  }

  return merged;
}

/**
 * Compare two schemas and return compatibility info
 */
export function compareSchemas(
  schema1: JsonSchema,
  schema2: JsonSchema
): {
  compatible: boolean;
  differences: string[];
  compatibilityScore: number;
} {
  const differences: string[] = [];
  let compatibilityScore = 100;

  // Compare types
  if (schema1.type !== schema2.type) {
    differences.push(`Type mismatch: ${schema1.type} vs ${schema2.type}`);
    compatibilityScore -= 50;
  }

  // Compare properties
  const props1 = Object.keys(schema1.properties || {});
  const props2 = Object.keys(schema2.properties || {});

  const missingInSchema2 = props1.filter((p) => !props2.includes(p));
  const missingInSchema1 = props2.filter((p) => !props1.includes(p));

  if (missingInSchema2.length > 0) {
    differences.push(`Properties in schema1 missing from schema2: ${missingInSchema2.join(', ')}`);
    compatibilityScore -= missingInSchema2.length * 5;
  }

  if (missingInSchema1.length > 0) {
    differences.push(`Properties in schema2 missing from schema1: ${missingInSchema1.join(', ')}`);
    compatibilityScore -= missingInSchema1.length * 5;
  }

  // Compare required fields
  const required1 = schema1.required || [];
  const required2 = schema2.required || [];

  const extraRequired = required2.filter((r) => !required1.includes(r));
  if (extraRequired.length > 0) {
    differences.push(`Schema2 has additional required fields: ${extraRequired.join(', ')}`);
    compatibilityScore -= extraRequired.length * 10;
  }

  compatibilityScore = Math.max(0, compatibilityScore);

  return {
    compatible: compatibilityScore >= 70,
    differences,
    compatibilityScore,
  };
}
