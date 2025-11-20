/**
 * Pydantic Code Generator Service
 * Converts JSON Schema (from FormSchema) into Python Pydantic models
 * Enforces type-safe task development with automatic code generation
 */

import { JSONSchema7 } from 'json-schema';

// ============================================================================
// Types
// ============================================================================

export interface PydanticGenerationOptions {
  className: string;
  includeImports?: boolean;
  includeDocstring?: boolean;
  connectorAnnotations?: boolean; // Include x-connector-* annotations
}

export interface PydanticGenerationResult {
  code: string;
  imports: string[];
  className: string;
}

// ============================================================================
// Pydantic Code Generator Service
// ============================================================================

export class PydanticGeneratorService {
  /**
   * Generate Pydantic model from JSON Schema
   */
  static generatePydanticModel(
    schema: JSONSchema7,
    options: PydanticGenerationOptions
  ): PydanticGenerationResult {
    const { className, includeImports = true, includeDocstring = true } = options;

    const imports = this.collectRequiredImports(schema);
    const fields = this.generateFields(schema);
    const docstring = includeDocstring ? this.generateDocstring(schema) : '';

    let code = '';

    // Add imports
    if (includeImports) {
      code += `${this.generateImports(imports)}\n\n`;
    }

    // Add class definition
    code += `class ${className}(BaseModel):\n`;

    // Add docstring
    if (docstring) {
      code += `    """${docstring}"""\n\n`;
    }

    // Add fields
    if (fields.length > 0) {
      code += fields.map((f) => `    ${f}`).join('\n');
    } else {
      // Empty model
      code += '    pass';
    }

    return {
      code,
      imports,
      className,
    };
  }

  /**
   * Generate fields from schema properties
   */
  private static generateFields(schema: JSONSchema7): string[] {
    const fields: string[] = [];

    if (!schema.properties) {
      return fields;
    }

    const required = schema.required || [];

    Object.entries(schema.properties).forEach(([fieldName, fieldSchema]) => {
      if (typeof fieldSchema === 'boolean') return;

      const isRequired = required.includes(fieldName);
      const field = this.generateField(fieldName, fieldSchema, isRequired);
      fields.push(field);
    });

    return fields;
  }

  /**
   * Generate a single field definition
   */
  private static generateField(
    fieldName: string,
    fieldSchema: JSONSchema7,
    isRequired: boolean
  ): string {
    const pythonType = this.jsonSchemaTypeToPython(fieldSchema);
    const defaultValue = this.generateDefaultValue(fieldSchema, isRequired);
    const fieldArgs = this.generateFieldArgs(fieldSchema, isRequired);

    // Build field definition
    let fieldDef = `${fieldName}: ${pythonType}`;

    // Add Field(...) if has validation or metadata
    if (fieldArgs) {
      fieldDef += ` = Field(${fieldArgs})`;
    } else if (defaultValue !== null) {
      fieldDef += ` = ${defaultValue}`;
    }

    // Add inline comment for description
    if (fieldSchema.description) {
      fieldDef += `  # ${fieldSchema.description}`;
    }

    return fieldDef;
  }

  /**
   * Convert JSON Schema type to Python type annotation
   */
  private static jsonSchemaTypeToPython(schema: JSONSchema7): string {
    // Handle $ref
    if (schema.$ref) {
      return this.extractRefClassName(schema.$ref);
    }

    // Handle enum
    if (schema.enum && schema.enum.length > 0) {
      const enumValues = schema.enum.map((v) => JSON.stringify(v)).join(', ');
      return `Literal[${enumValues}]`;
    }

    // Handle array
    if (schema.type === 'array') {
      const itemsSchema = schema.items as JSONSchema7;
      if (itemsSchema) {
        const itemType = this.jsonSchemaTypeToPython(itemsSchema);
        return `List[${itemType}]`;
      }
      return 'List[Any]';
    }

    // Handle object
    if (schema.type === 'object') {
      return 'Dict[str, Any]';
    }

    // Handle oneOf/anyOf
    if (schema.oneOf) {
      const types = schema.oneOf
        .map((s) => (typeof s === 'boolean' ? 'Any' : this.jsonSchemaTypeToPython(s)))
        .join(' | ');
      return `Union[${types}]`;
    }

    if (schema.anyOf) {
      const types = schema.anyOf
        .map((s) => (typeof s === 'boolean' ? 'Any' : this.jsonSchemaTypeToPython(s)))
        .join(' | ');
      return `Union[${types}]`;
    }

    // Handle basic types
    switch (schema.type) {
      case 'string':
        if (schema.format === 'date-time') return 'datetime';
        if (schema.format === 'date') return 'date';
        if (schema.format === 'time') return 'time';
        if (schema.format === 'email') return 'EmailStr';
        if (schema.format === 'uri') return 'AnyUrl';
        if (schema.format === 'uuid') return 'UUID';
        return 'str';

      case 'number':
        return 'float';

      case 'integer':
        return 'int';

      case 'boolean':
        return 'bool';

      case 'null':
        return 'None';

      default:
        return 'Any';
    }
  }

  /**
   * Generate Field() arguments for validation and metadata
   */
  private static generateFieldArgs(schema: JSONSchema7, isRequired: boolean): string {
    const args: string[] = [];

    // Required field
    if (isRequired) {
      args.push('...');
    }

    // Default value
    if (schema.default !== undefined && !isRequired) {
      args.push(`default=${JSON.stringify(schema.default)}`);
    }

    // Title
    if (schema.title) {
      args.push(`title=${JSON.stringify(schema.title)}`);
    }

    // Description
    if (schema.description) {
      args.push(`description=${JSON.stringify(schema.description)}`);
    }

    // Validation constraints
    // String validations
    if (schema.minLength !== undefined) {
      args.push(`min_length=${schema.minLength}`);
    }
    if (schema.maxLength !== undefined) {
      args.push(`max_length=${schema.maxLength}`);
    }
    if (schema.pattern) {
      args.push(`pattern=${JSON.stringify(schema.pattern)}`);
    }

    // Number validations
    if (schema.minimum !== undefined) {
      if (schema.exclusiveMinimum) {
        args.push(`gt=${schema.minimum}`);
      } else {
        args.push(`ge=${schema.minimum}`);
      }
    }
    if (schema.maximum !== undefined) {
      if (schema.exclusiveMaximum) {
        args.push(`lt=${schema.maximum}`);
      } else {
        args.push(`le=${schema.maximum}`);
      }
    }
    if (schema.multipleOf !== undefined) {
      args.push(`multiple_of=${schema.multipleOf}`);
    }

    // Array validations
    if (schema.minItems !== undefined) {
      args.push(`min_items=${schema.minItems}`);
    }
    if (schema.maxItems !== undefined) {
      args.push(`max_items=${schema.maxItems}`);
    }

    // Custom x-connector annotations
    const customAnnotations: Record<string, any> = {};
    Object.keys(schema).forEach((key) => {
      if (
        key.startsWith('x-connector-') ||
        key.startsWith('x-value-') ||
        key.startsWith('x-display-') ||
        key.startsWith('x-search-')
      ) {
        customAnnotations[key] = (schema as any)[key];
      }
    });

    if (Object.keys(customAnnotations).length > 0) {
      args.push(`json_schema_extra=${JSON.stringify(customAnnotations)}`);
    }

    return args.join(', ');
  }

  /**
   * Generate default value for field
   */
  private static generateDefaultValue(schema: JSONSchema7, isRequired: boolean): string | null {
    if (isRequired) {
      return null;
    }

    if (schema.default !== undefined) {
      return JSON.stringify(schema.default);
    }

    // Optional fields without default
    return 'None';
  }

  /**
   * Collect all required imports based on schema
   */
  private static collectRequiredImports(schema: JSONSchema7): string[] {
    const imports = new Set<string>(['BaseModel', 'Field']);

    // Check for special types
    this.collectImportsFromSchema(schema, imports);

    return Array.from(imports).sort();
  }

  /**
   * Recursively collect imports from schema
   */
  private static collectImportsFromSchema(schema: JSONSchema7, imports: Set<string>): void {
    if (typeof schema === 'boolean') return;

    // Check for List
    if (schema.type === 'array') {
      imports.add('List');
      const itemsSchema = schema.items as JSONSchema7;
      if (itemsSchema) {
        this.collectImportsFromSchema(itemsSchema, imports);
      }
    }

    // Check for Dict
    if (schema.type === 'object' && !schema.properties) {
      imports.add('Dict');
      imports.add('Any');
    }

    // Check for Union
    if (schema.oneOf || schema.anyOf) {
      imports.add('Union');
    }

    // Check for Literal (enum)
    if (schema.enum) {
      imports.add('Literal');
    }

    // Check for datetime types
    if (schema.format === 'date-time') {
      imports.add('datetime');
    }
    if (schema.format === 'date') {
      imports.add('date');
    }
    if (schema.format === 'time') {
      imports.add('time');
    }

    // Check for email
    if (schema.format === 'email') {
      imports.add('EmailStr');
    }

    // Check for URL
    if (schema.format === 'uri') {
      imports.add('AnyUrl');
    }

    // Check for UUID
    if (schema.format === 'uuid') {
      imports.add('UUID');
    }

    // Check for Any
    if (!schema.type) {
      imports.add('Any');
    }

    // Recursively check nested schemas
    if (schema.properties) {
      Object.values(schema.properties).forEach((prop) => {
        if (typeof prop !== 'boolean') {
          this.collectImportsFromSchema(prop, imports);
        }
      });
    }

    if (schema.items) {
      const items = Array.isArray(schema.items) ? schema.items : [schema.items];
      items.forEach((item) => {
        if (typeof item !== 'boolean') {
          this.collectImportsFromSchema(item, imports);
        }
      });
    }
  }

  /**
   * Generate import statements
   */
  private static generateImports(imports: string[]): string {
    const lines: string[] = [];

    // Pydantic imports
    const pydanticImports = imports.filter((i) =>
      ['BaseModel', 'Field', 'EmailStr', 'AnyUrl'].includes(i)
    );
    if (pydanticImports.length > 0) {
      lines.push(`from pydantic import ${pydanticImports.join(', ')}`);
    }

    // Typing imports
    const typingImports = imports.filter((i) =>
      ['List', 'Dict', 'Union', 'Literal', 'Any'].includes(i)
    );
    if (typingImports.length > 0) {
      lines.push(`from typing import ${typingImports.join(', ')}`);
    }

    // Datetime imports
    const datetimeImports = imports.filter((i) => ['datetime', 'date', 'time'].includes(i));
    if (datetimeImports.length > 0) {
      lines.push(`from datetime import ${datetimeImports.join(', ')}`);
    }

    // UUID imports
    if (imports.includes('UUID')) {
      lines.push('from uuid import UUID');
    }

    return lines.join('\n');
  }

  /**
   * Generate docstring from schema
   */
  private static generateDocstring(schema: JSONSchema7): string {
    const parts: string[] = [];

    if (schema.title) {
      parts.push(schema.title);
    }

    if (schema.description) {
      if (parts.length > 0) parts.push('');
      parts.push(schema.description);
    }

    return parts.join('\n    ');
  }

  /**
   * Extract class name from $ref
   */
  private static extractRefClassName(ref: string): string {
    const parts = ref.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Generate complete task template with Pydantic models
   */
  static generateTaskTemplate(
    taskName: string,
    inputSchema: JSONSchema7,
    outputSchema: JSONSchema7
  ): string {
    const inputClassName = `${taskName}Input`;
    const outputClassName = `${taskName}Output`;

    const inputModel = this.generatePydanticModel(inputSchema, {
      className: inputClassName,
      includeImports: true,
      includeDocstring: true,
      connectorAnnotations: true,
    });

    const outputModel = this.generatePydanticModel(outputSchema, {
      className: outputClassName,
      includeImports: false,
      includeDocstring: true,
    });

    // Combine into full task template
    const template = `${inputModel.code}


${outputModel.code}


@task
def ${this.toPythonFunctionName(taskName)}(input_data: ${inputClassName}) -> ${outputClassName}:
    """
    TODO: Implement your task logic here

    Available inputs:
${this.generateInputFieldList(inputSchema, '    - ')}

    Must return: ${outputClassName} instance

    Example:
        result = ${this.toPythonFunctionName(taskName)}(input_data)
        print(result)
    """
    # Your implementation here

    # Example: Access input data
    # value = input_data.field_name

    # Your business logic
    # ...

    # Return output (must be ${outputClassName} instance)
    return ${outputClassName}(
        # TODO: Fill in output fields
    )
`;

    // Add flytekit import
    const finalTemplate = `from flytekit import task

${template}`;

    return finalTemplate;
  }

  /**
   * Convert task name to Python function name (snake_case)
   */
  private static toPythonFunctionName(name: string): string {
    return name
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/[^a-z0-9_]/g, '_');
  }

  /**
   * Generate list of input fields for docstring
   */
  private static generateInputFieldList(schema: JSONSchema7, prefix: string): string {
    if (!schema.properties) {
      return `${prefix}(no fields defined)`;
    }

    return Object.entries(schema.properties)
      .map(([name, field]) => {
        if (typeof field === 'boolean') return '';
        const type = this.jsonSchemaTypeToPython(field);
        const desc = field.description ? ` - ${field.description}` : '';
        return `${prefix}input_data.${name} (${type})${desc}`;
      })
      .filter(Boolean)
      .join('\n');
  }
}

export default PydanticGeneratorService;
