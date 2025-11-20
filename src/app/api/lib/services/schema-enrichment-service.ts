/**
 * Schema Enrichment Service
 * Automatically enriches Pydantic JSON Schemas with connector data sources
 * Eliminates manual connector configuration by using intelligent field matching
 */

import { JSONSchema7 } from 'json-schema';

import { ConnectorModel } from '../connectors/types';
import { connectorService } from '../connectors/connector-service';
import {
  FormDataSource,
  EnhancedFormSchema,
  ConnectorDataSource,
} from '../../../../sections/form-generator-bk/types/data-source-types';

// ============================================================================
// Extended JSON Schema Type with Pydantic Custom Properties
// ============================================================================

interface ExtendedJSONSchema7 extends JSONSchema7 {
  'x-connector-id'?: string;
  'x-connector-tag'?: string;
  'x-connector-disabled'?: boolean;
  'x-value-field'?: string;
  'x-display-field'?: string;
  'x-search-fields'?: string[];
  [key: string]: any; // Allow other custom properties
}

// ============================================================================
// Types & Interfaces
// ============================================================================

interface FieldMatchRule {
  fieldName: string;
  connector: ConnectorModel;
  confidence: number; // 0-1 score
  reason: string;
}

interface EnrichmentOptions {
  organizationId: string;
  autoEnrich?: boolean; // Default: true
  matchThreshold?: number; // Minimum confidence score (default: 0.6)
  fieldAnnotations?: Record<string, FieldAnnotation>; // Manual overrides
  excludeFields?: string[]; // Fields to skip
}

interface FieldAnnotation {
  connectorId?: string; // Explicit connector ID
  connectorTag?: string; // Match by connector tag
  valueField?: string; // Override default value field
  displayField?: string; // Override default display field
  searchFields?: string[]; // Override default search fields
  disabled?: boolean; // Explicitly disable connector for this field
}

// ============================================================================
// Schema Enrichment Service
// ============================================================================

export class SchemaEnrichmentService {
  /**
   * Main entry point: Enrich a Pydantic schema with connector data sources
   */
  static async enrichSchema(
    schema: JSONSchema7,
    uischema: any | undefined,
    options: EnrichmentOptions
  ): Promise<EnhancedFormSchema> {
    const { organizationId, autoEnrich = true, matchThreshold = 0.6 } = options;

    if (!autoEnrich) {
      return { schema, uischema, dataSources: {} };
    }

    // Get all available connectors for this organization
    const connectors = await connectorService.listConnectors(organizationId, {
      status: 'active',
    });

    if (connectors.length === 0) {
      return { schema, uischema, dataSources: {} };
    }

    // Extract field definitions from schema
    const fields = this.extractFields(schema);

    // Match each field to connectors
    const dataSources: Record<string, FormDataSource> = {};

    Object.entries(fields).forEach(([fieldPath, fieldDef]) => {
      // Skip if explicitly excluded
      if (options.excludeFields?.includes(fieldPath)) {
        return;
      }

      // Check for manual annotation first
      const annotation = options.fieldAnnotations?.[fieldPath];
      if (annotation?.disabled) {
        return;
      }

      // Match field to connector
      let match: FieldMatchRule | null = null;
      if (annotation?.connectorId) {
        match = this.matchByExplicitId(annotation.connectorId, connectors);
      } else if (annotation?.connectorTag) {
        match = this.matchByTag(annotation.connectorTag, connectors);
      } else {
        match = this.matchField(fieldPath, fieldDef, connectors);
      }

      if (match && match.confidence >= matchThreshold) {
        // Generate data source configuration
        const dataSource = this.createDataSource(fieldPath, match.connector, annotation, fieldDef);
        dataSources[fieldPath] = dataSource;
      }
    });

    return {
      schema,
      uischema,
      dataSources,
      metadata: {
        enrichedAt: new Date().toISOString(),
        connectorCount: Object.keys(dataSources).length,
        totalFields: Object.keys(fields).length,
      },
    };
  }

  /**
   * Extract all fields from JSON Schema (handles nested properties)
   */
  private static extractFields(schema: JSONSchema7): Record<string, ExtendedJSONSchema7> {
    const fields: Record<string, ExtendedJSONSchema7> = {};

    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, value]) => {
        if (typeof value === 'object') {
          fields[key] = value as ExtendedJSONSchema7;

          // Handle nested objects
          if (value.type === 'object' && value.properties) {
            const nested = this.extractFields(value as JSONSchema7);
            Object.entries(nested).forEach(([nestedKey, nestedValue]) => {
              fields[`${key}.${nestedKey}`] = nestedValue;
            });
          }
        }
      });
    }

    return fields;
  }

  /**
   * Match a field to connectors using intelligent strategies
   */
  private static matchField(
    fieldPath: string,
    fieldDef: ExtendedJSONSchema7,
    connectors: ConnectorModel[]
  ): FieldMatchRule | null {
    const matches: FieldMatchRule[] = [];

    connectors.forEach((connector) => {
      // Strategy 1: Check x-connector-id annotation in field
      if (fieldDef['x-connector-id'] === connector.id) {
        matches.push({
          fieldName: fieldPath,
          connector,
          confidence: 1.0,
          reason: 'Explicit x-connector-id annotation',
        });
        return;
      }

      // Strategy 2: Check x-connector-tag annotation
      if (fieldDef['x-connector-tag']) {
        const fieldTag = fieldDef['x-connector-tag'] as string;
        const connectorTags = (connector as any).tags || [];
        if (connectorTags.includes(fieldTag)) {
          matches.push({
            fieldName: fieldPath,
            connector,
            confidence: 0.95,
            reason: `Tag match: ${fieldTag}`,
          });
          return;
        }
      }

      // Strategy 3: Field name pattern matching
      const nameMatch = this.matchFieldName(fieldPath, connector);
      if (nameMatch.confidence > 0) {
        matches.push({
          fieldName: fieldPath,
          connector,
          confidence: nameMatch.confidence,
          reason: nameMatch.reason,
        });
      }

      // Strategy 4: Field type + connector type correlation
      const typeMatch = this.matchFieldType(fieldDef, connector);
      if (typeMatch.confidence > 0) {
        matches.push({
          fieldName: fieldPath,
          connector,
          confidence: typeMatch.confidence,
          reason: typeMatch.reason,
        });
      }
    });

    // Return best match
    if (matches.length === 0) {
      return null;
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    return matches[0];
  }

  /**
   * Match field name to connector using patterns
   */
  private static matchFieldName(
    fieldPath: string,
    connector: ConnectorModel
  ): { confidence: number; reason: string } {
    const fieldName = fieldPath.toLowerCase();
    const connectorName = connector.name.toLowerCase();

    // Remove common suffixes
    const normalizedField = fieldName.replace(/_id$/, '').replace(/_ref$/, '').replace(/_key$/, '');

    // Extract potential entity name from connector name
    const connectorWords = connectorName.split(/[\s_-]+/).map((w) => w.toLowerCase());

    // Check for direct match
    if (connectorWords.some((word) => normalizedField === word)) {
      return { confidence: 0.9, reason: `Direct name match: ${normalizedField}` };
    }

    // Check for partial match
    if (connectorWords.some((word) => normalizedField.includes(word))) {
      return { confidence: 0.75, reason: `Partial name match: ${normalizedField}` };
    }

    // Check for plural/singular variations
    const singularField = normalizedField.replace(/s$/, '');
    const pluralField = `${normalizedField}s`;

    if (connectorWords.some((word) => word === singularField || word === pluralField)) {
      return {
        confidence: 0.85,
        reason: `Singular/plural match: ${normalizedField}`,
      };
    }

    return { confidence: 0, reason: 'No name match' };
  }

  /**
   * Match field type to connector type
   */
  private static matchFieldType(
    fieldDef: ExtendedJSONSchema7,
    connector: ConnectorModel
  ): { confidence: number; reason: string } {
    // String fields with enums might benefit from connectors
    if (fieldDef.type === 'string' && fieldDef.enum) {
      return {
        confidence: 0.3,
        reason: 'String field with enum could use connector',
      };
    }

    // Array fields with item enums
    if (fieldDef.type === 'array' && (fieldDef.items as any)?.enum) {
      return {
        confidence: 0.3,
        reason: 'Array field with enum could use connector',
      };
    }

    // Check field format hints
    if (fieldDef.format === 'uuid' || fieldDef.format === 'uri') {
      return { confidence: 0.2, reason: 'ID/reference field type' };
    }

    return { confidence: 0, reason: 'No type match' };
  }

  /**
   * Match by explicit connector ID
   */
  private static matchByExplicitId(
    connectorId: string,
    connectors: ConnectorModel[]
  ): FieldMatchRule | null {
    const connector = connectors.find((c) => c.id === connectorId);
    if (!connector) {
      return null;
    }

    return {
      fieldName: '',
      connector,
      confidence: 1.0,
      reason: 'Explicit connector ID',
    };
  }

  /**
   * Match by connector tag
   */
  private static matchByTag(tag: string, connectors: ConnectorModel[]): FieldMatchRule | null {
    const connector = connectors.find((c) => {
      const tags = (c as any).tags || [];
      return tags.includes(tag);
    });

    if (!connector) {
      return null;
    }

    return {
      fieldName: '',
      connector,
      confidence: 0.95,
      reason: `Tag match: ${tag}`,
    };
  }

  /**
   * Create FormDataSource configuration from connector
   */
  private static createDataSource(
    fieldPath: string,
    connector: ConnectorModel,
    annotation: FieldAnnotation | undefined,
    fieldDef: ExtendedJSONSchema7
  ): FormDataSource {
    // Get data mapping from connector or use defaults
    const dataMapping = connector.dataMapping as any;
    const valueField = annotation?.valueField || dataMapping?.valueField || 'id';
    const displayField = annotation?.displayField || dataMapping?.displayField || 'name';
    const searchFields = annotation?.searchFields ||
      dataMapping?.searchFields || [displayField, 'email', 'description'];

    const source: ConnectorDataSource = {
      connectorId: connector.id,
      valueField,
      displayField,
      searchFields,
      filterFields: searchFields,
      parameters: {},
    };

    return {
      id: `${fieldPath}-connector-source`,
      name: `${fieldPath} from ${connector.name}`,
      description: `Auto-generated data source from ${connector.name} connector`,
      type: 'connector',
      source,
      caching: connector.caching
        ? {
            enabled: connector.caching.enabled,
            ttl: connector.caching.ttl,
          }
        : undefined,
      refreshInterval: connector.caching?.ttl,
    };
  }

  /**
   * Helper: Parse field annotations from Pydantic schema
   * Pydantic can add custom properties like x-connector-id to fields
   */
  static extractFieldAnnotations(schema: JSONSchema7): Record<string, FieldAnnotation> {
    const annotations: Record<string, FieldAnnotation> = {};

    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, value]) => {
        if (typeof value === 'object') {
          const fieldDef = value as ExtendedJSONSchema7;

          const annotation: FieldAnnotation = {};

          if (fieldDef['x-connector-id']) {
            annotation.connectorId = fieldDef['x-connector-id'];
          }

          if (fieldDef['x-connector-tag']) {
            annotation.connectorTag = fieldDef['x-connector-tag'];
          }

          if (fieldDef['x-connector-disabled']) {
            annotation.disabled = fieldDef['x-connector-disabled'];
          }

          if (fieldDef['x-value-field']) {
            annotation.valueField = fieldDef['x-value-field'];
          }

          if (fieldDef['x-display-field']) {
            annotation.displayField = fieldDef['x-display-field'];
          }

          if (fieldDef['x-search-fields']) {
            annotation.searchFields = fieldDef['x-search-fields'];
          }

          if (Object.keys(annotation).length > 0) {
            annotations[key] = annotation;
          }
        }
      });
    }

    return annotations;
  }

  /**
   * Validate enriched schema
   */
  static validateEnrichedSchema(enrichedSchema: EnhancedFormSchema): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate base schema
    if (!enrichedSchema.schema || typeof enrichedSchema.schema !== 'object') {
      errors.push('Invalid or missing schema');
      return { valid: false, errors, warnings };
    }

    // Validate data sources
    if (enrichedSchema.dataSources) {
      Object.entries(enrichedSchema.dataSources).forEach(([fieldPath, dataSource]) => {
        // Check if field exists in schema
        const fieldExists = this.fieldExistsInSchema(fieldPath, enrichedSchema.schema);
        if (!fieldExists) {
          warnings.push(`Data source defined for non-existent field: ${fieldPath}`);
        }

        // Validate connector data source
        if (dataSource.type === 'connector') {
          const source = dataSource.source as ConnectorDataSource;
          if (!source.connectorId) {
            errors.push(`Missing connectorId for field: ${fieldPath}`);
          }
          if (!source.valueField) {
            errors.push(`Missing valueField for field: ${fieldPath}`);
          }
          if (!source.displayField) {
            errors.push(`Missing displayField for field: ${fieldPath}`);
          }
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if field path exists in schema
   */
  private static fieldExistsInSchema(fieldPath: string, schema: JSONSchema7): boolean {
    const parts = fieldPath.split('.');
    let current: any = schema.properties;

    const exists = parts.every((part) => {
      if (!current || !current[part]) {
        return false;
      }
      current = current[part].properties;
      return true;
    });

    return exists;
  }
}

export default SchemaEnrichmentService;
