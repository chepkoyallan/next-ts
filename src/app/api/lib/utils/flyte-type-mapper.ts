/**
 * Maps Flyte types to JSON Schema types
 * Reference: https://docs.flyte.org/en/latest/api/flyteidl/docs/core.html#flyteidl.core.LiteralType
 */

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
 * Simple Flyte types mapping
 */
const SIMPLE_TYPE_MAP: Record<string, any> = {
  // Integer types
  INTEGER: { type: 'integer', format: 'int64' },

  // Float types
  FLOAT: { type: 'number', format: 'double' },

  // String types
  STRING: { type: 'string' },

  // Boolean types
  BOOLEAN: { type: 'boolean' },

  // Date/Time types
  DATETIME: { type: 'string', format: 'date-time' },
  DURATION: { type: 'string', format: 'duration' },

  // Binary types
  BINARY: { type: 'string', format: 'binary', contentEncoding: 'base64' },

  // Special types
  ERROR: { type: 'object', description: 'Error type' },
  STRUCT: { type: 'object', additionalProperties: true },
  NONE: { type: 'null' },
};

/**
 * Map Flyte type to JSON Schema type
 */
export function mapFlyteTypeToJsonSchema(flyteType: FlyteType): any {
  // Handle simple types
  if (flyteType.simple) {
    const simpleType = flyteType.simple.toUpperCase();
    return SIMPLE_TYPE_MAP[simpleType] || { type: 'string' };
  }

  // Handle collection types (arrays)
  if (flyteType.collectionType) {
    return {
      type: 'array',
      items: mapFlyteTypeToJsonSchema(flyteType.collectionType),
    };
  }

  // Handle map types (objects with specific value type)
  if (flyteType.mapValueType) {
    return {
      type: 'object',
      additionalProperties: mapFlyteTypeToJsonSchema(flyteType.mapValueType),
    };
  }

  // Handle schema types (structured data)
  if (flyteType.schema) {
    return {
      type: 'object',
      description: 'Structured dataset schema',
      properties: flyteType.schema.columns
        ? flyteType.schema.columns.reduce((acc: any, col: any) => {
            acc[col.name] = mapFlyteTypeToJsonSchema({ simple: col.type });
            return acc;
          }, {})
        : {},
    };
  }

  // Handle structured dataset types
  if (flyteType.structuredDatasetType) {
    return {
      type: 'object',
      description: 'Structured dataset',
      properties: {
        uri: { type: 'string', format: 'uri' },
        format: { type: 'string' },
      },
    };
  }

  // Handle blob types (files)
  if (flyteType.blob) {
    return {
      type: 'string',
      format: 'uri',
      description: 'Blob/File reference',
      contentMediaType: flyteType.blob.format || 'application/octet-stream',
    };
  }

  // Handle enum types
  if (flyteType.enumType) {
    return {
      type: 'string',
      enum: flyteType.enumType.values || [],
    };
  }

  // Default fallback
  return { type: 'string' };
}

/**
 * Map JSON Schema type to Flyte type (reverse mapping)
 */
export function mapJsonSchemaToFlyteType(jsonSchema: any): FlyteType {
  if (!jsonSchema || !jsonSchema.type) {
    return { simple: 'STRING' };
  }

  const schemaType = jsonSchema.type;

  // Handle simple types
  if (schemaType === 'integer') {
    return { simple: 'INTEGER' };
  }

  if (schemaType === 'number') {
    return { simple: 'FLOAT' };
  }

  if (schemaType === 'string') {
    // Check for special formats
    if (jsonSchema.format === 'date-time') {
      return { simple: 'DATETIME' };
    }
    if (jsonSchema.format === 'duration') {
      return { simple: 'DURATION' };
    }
    if (jsonSchema.format === 'binary' || jsonSchema.format === 'uri') {
      return { blob: { format: jsonSchema.contentMediaType || 'application/octet-stream' } };
    }
    if (jsonSchema.enum) {
      return { enumType: { values: jsonSchema.enum } };
    }
    return { simple: 'STRING' };
  }

  if (schemaType === 'boolean') {
    return { simple: 'BOOLEAN' };
  }

  if (schemaType === 'null') {
    return { simple: 'NONE' };
  }

  // Handle array types
  if (schemaType === 'array') {
    const itemsType = jsonSchema.items
      ? mapJsonSchemaToFlyteType(jsonSchema.items)
      : { simple: 'STRING' };

    return { collectionType: itemsType };
  }

  // Handle object types
  if (schemaType === 'object') {
    // If it has additionalProperties with a type, it's a map
    if (jsonSchema.additionalProperties && typeof jsonSchema.additionalProperties === 'object') {
      return { mapValueType: mapJsonSchemaToFlyteType(jsonSchema.additionalProperties) };
    }

    // Otherwise it's a struct
    return { simple: 'STRUCT' };
  }

  // Default fallback
  return { simple: 'STRING' };
}

/**
 * Check if two Flyte types are compatible
 */
export function areFlyteTypesCompatible(source: FlyteType, target: FlyteType): boolean {
  // Same simple type
  if (source.simple && target.simple) {
    return source.simple === target.simple;
  }

  // Both collections
  if (source.collectionType && target.collectionType) {
    return areFlyteTypesCompatible(source.collectionType, target.collectionType);
  }

  // Both maps
  if (source.mapValueType && target.mapValueType) {
    return areFlyteTypesCompatible(source.mapValueType, target.mapValueType);
  }

  // Both structs/objects
  if (
    (source.simple === 'STRUCT' || source.schema) &&
    (target.simple === 'STRUCT' || target.schema)
  ) {
    return true;
  }

  // Both blobs
  if (source.blob && target.blob) {
    return true;
  }

  // Not compatible
  return false;
}

/**
 * Get a human-readable type name
 */
export function getFlyteTypeDisplayName(flyteType: FlyteType): string {
  if (flyteType.simple) {
    return flyteType.simple.toLowerCase();
  }

  if (flyteType.collectionType) {
    const itemType = getFlyteTypeDisplayName(flyteType.collectionType);
    return `list[${itemType}]`;
  }

  if (flyteType.mapValueType) {
    const valueType = getFlyteTypeDisplayName(flyteType.mapValueType);
    return `dict[str, ${valueType}]`;
  }

  if (flyteType.schema) {
    return 'schema';
  }

  if (flyteType.structuredDatasetType) {
    return 'structured_dataset';
  }

  if (flyteType.blob) {
    return 'file';
  }

  if (flyteType.enumType) {
    return 'enum';
  }

  return 'unknown';
}

/**
 * Validate if a value matches a Flyte type
 */
export function validateValueAgainstFlyteType(value: any, flyteType: FlyteType): boolean {
  if (flyteType.simple) {
    const simpleType = flyteType.simple.toUpperCase();

    switch (simpleType) {
      case 'INTEGER':
        return Number.isInteger(value);
      case 'FLOAT':
        return typeof value === 'number';
      case 'STRING':
        return typeof value === 'string';
      case 'BOOLEAN':
        return typeof value === 'boolean';
      case 'DATETIME':
        return typeof value === 'string' && !Number.isNaN(Date.parse(value));
      case 'NONE':
        return value === null;
      default:
        return true;
    }
  }

  if (flyteType.collectionType) {
    if (!Array.isArray(value)) {
      return false;
    }
    return value.every((item) => validateValueAgainstFlyteType(item, flyteType.collectionType!));
  }

  if (flyteType.mapValueType) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }
    return Object.values(value).every((v) =>
      validateValueAgainstFlyteType(v, flyteType.mapValueType!)
    );
  }

  if (flyteType.enumType) {
    return flyteType.enumType.values?.includes(value) || false;
  }

  // For complex types (schema, blob, etc.), just check if value exists
  return value !== undefined && value !== null;
}
