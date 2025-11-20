/**
 * Task Validation Service
 * Validates that Python task code follows Pydantic-enforced structure
 * Ensures type safety and proper task signatures before Flyte registration
 */

// ============================================================================
// Types
// ============================================================================

export interface ValidationError {
  line?: number;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface TaskCodeStructure {
  hasInputModel: boolean;
  hasOutputModel: boolean;
  hasTaskDecorator: boolean;
  hasTaskFunction: boolean;
  inputModelName?: string;
  outputModelName?: string;
  taskFunctionName?: string;
  imports: string[];
}

// ============================================================================
// Task Validation Service
// ============================================================================

export interface TaskValidationOptions {
  code: string;
  expectedInputModel: string;
  expectedOutputModel: string;
  expectedFunctionName?: string; // Default: "process_data"
  expectedParameterName?: string; // Default: "input_data"
}

export class TaskValidationService {
  /**
   * Validate task code structure and Pydantic usage
   * Supports dynamic function names and parameters (not hardcoded)
   */
  static validateTaskCode(options: TaskValidationOptions): ValidationResult {
    const {
      code,
      expectedInputModel,
      expectedOutputModel,
      expectedFunctionName = 'process_data',
      expectedParameterName = 'input_data',
    } = options;

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Parse code structure
    const structure = this.analyzeCodeStructure(code);

    // Rule 1: Must have required imports
    this.validateImports(structure, errors);

    // Rule 2: Must have input Pydantic model
    this.validateInputModel(structure, expectedInputModel, errors);

    // Rule 3: Must have output Pydantic model
    this.validateOutputModel(structure, expectedOutputModel, errors);

    // Rule 4: Must have @task decorator
    this.validateTaskDecorator(structure, errors);

    // Rule 5: Must have task function with correct signature (dynamic)
    this.validateTaskFunction(
      code,
      structure,
      expectedInputModel,
      expectedOutputModel,
      expectedFunctionName,
      expectedParameterName,
      errors
    );

    // Rule 6: No primitive types in task signature
    this.validateNoPrimitiveTypes(code, warnings);

    // Rule 7: Models must inherit from BaseModel
    this.validateBaseModelInheritance(code, expectedInputModel, expectedOutputModel, errors);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Analyze code structure using regex patterns
   */
  private static analyzeCodeStructure(code: string): TaskCodeStructure {
    const structure: TaskCodeStructure = {
      hasInputModel: false,
      hasOutputModel: false,
      hasTaskDecorator: false,
      hasTaskFunction: false,
      imports: [],
    };

    // Extract imports
    const importMatches = code.matchAll(/^(?:from|import)\s+[\w.]+.*$/gm);
    structure.imports = Array.from(importMatches, (m) => m[0]);

    // Find class definitions
    const classPattern = /class\s+(\w+)\s*\([^)]*BaseModel[^)]*\)/g;
    const classMatches = Array.from(code.matchAll(classPattern));

    if (classMatches.length >= 1) {
      structure.hasInputModel = true;
      structure.inputModelName = classMatches[0][1];
    }

    if (classMatches.length >= 2) {
      structure.hasOutputModel = true;
      structure.outputModelName = classMatches[1][1];
    }

    // Find @task decorator
    structure.hasTaskDecorator = /@task/.test(code);

    // Find task function
    const funcPattern = /def\s+(\w+)\s*\([^)]*\)/;
    const funcMatch = code.match(funcPattern);
    if (funcMatch) {
      structure.hasTaskFunction = true;
      structure.taskFunctionName = funcMatch[1];
    }

    return structure;
  }

  /**
   * Validate required imports
   */
  private static validateImports(structure: TaskCodeStructure, errors: ValidationError[]): void {
    const importsText = structure.imports.join('\n');

    // Check for pydantic import
    if (!importsText.includes('from pydantic import') && !importsText.includes('import pydantic')) {
      errors.push({
        message: 'Missing required import: from pydantic import BaseModel, Field',
        code: 'MISSING_PYDANTIC_IMPORT',
        severity: 'error',
      });
    }

    // Check for flytekit import
    if (!importsText.includes('from flytekit import') && !importsText.includes('import flytekit')) {
      errors.push({
        message: 'Missing required import: from flytekit import task',
        code: 'MISSING_FLYTEKIT_IMPORT',
        severity: 'error',
      });
    }

    // Check for BaseModel
    if (!importsText.includes('BaseModel')) {
      errors.push({
        message: 'Must import BaseModel from pydantic',
        code: 'MISSING_BASEMODEL_IMPORT',
        severity: 'error',
      });
    }

    // Check for @task
    if (!importsText.includes('task')) {
      errors.push({
        message: 'Must import task decorator from flytekit',
        code: 'MISSING_TASK_IMPORT',
        severity: 'error',
      });
    }
  }

  /**
   * Validate input model exists
   */
  private static validateInputModel(
    structure: TaskCodeStructure,
    expectedName: string,
    errors: ValidationError[]
  ): void {
    if (!structure.hasInputModel) {
      errors.push({
        message: `Missing input Pydantic model: ${expectedName}`,
        code: 'MISSING_INPUT_MODEL',
        severity: 'error',
      });
      return;
    }

    if (structure.inputModelName !== expectedName) {
      errors.push({
        message: `Input model name mismatch. Expected: ${expectedName}, Found: ${structure.inputModelName}`,
        code: 'INPUT_MODEL_NAME_MISMATCH',
        severity: 'error',
      });
    }
  }

  /**
   * Validate output model exists
   */
  private static validateOutputModel(
    structure: TaskCodeStructure,
    expectedName: string,
    errors: ValidationError[]
  ): void {
    if (!structure.hasOutputModel) {
      errors.push({
        message: `Missing output Pydantic model: ${expectedName}`,
        code: 'MISSING_OUTPUT_MODEL',
        severity: 'error',
      });
      return;
    }

    if (structure.outputModelName !== expectedName) {
      errors.push({
        message: `Output model name mismatch. Expected: ${expectedName}, Found: ${structure.outputModelName}`,
        code: 'OUTPUT_MODEL_NAME_MISMATCH',
        severity: 'error',
      });
    }
  }

  /**
   * Validate @task decorator exists
   */
  private static validateTaskDecorator(
    structure: TaskCodeStructure,
    errors: ValidationError[]
  ): void {
    if (!structure.hasTaskDecorator) {
      errors.push({
        message: 'Missing @task decorator on function',
        code: 'MISSING_TASK_DECORATOR',
        severity: 'error',
      });
    }
  }

  /**
   * Validate task function signature (supports dynamic function names)
   */
  private static validateTaskFunction(
    code: string,
    structure: TaskCodeStructure,
    expectedInputModel: string,
    expectedOutputModel: string,
    expectedFunctionName: string,
    expectedParameterName: string,
    errors: ValidationError[]
  ): void {
    if (!structure.hasTaskFunction) {
      errors.push({
        message: 'Missing task function definition',
        code: 'MISSING_TASK_FUNCTION',
        severity: 'error',
      });
      return;
    }

    // Build dynamic pattern for function signature
    // Matches: def function_name(param_name: InputType) -> OutputType:
    // We'll be flexible with whitespace and formatting
    const functionPattern = new RegExp(
      `def\\s+${expectedFunctionName}\\s*\\(\\s*${expectedParameterName}\\s*:\\s*${expectedInputModel}\\s*\\)\\s*->\\s*${expectedOutputModel}\\s*:`,
      'gm'
    );

    if (!functionPattern.test(code)) {
      // More lenient check: just look for the types being used
      const hasInputType = new RegExp(`:\\s*${expectedInputModel}`).test(code);
      const hasOutputType = new RegExp(`->\\s*${expectedOutputModel}`).test(code);

      if (!hasInputType || !hasOutputType) {
        errors.push({
          message: `Task function must have signature: def ${expectedFunctionName}(${expectedParameterName}: ${expectedInputModel}) -> ${expectedOutputModel}:`,
          code: 'INVALID_FUNCTION_SIGNATURE',
          severity: 'error',
        });
      }
    }
  }

  /**
   * Warn about primitive types in signature
   */
  private static validateNoPrimitiveTypes(code: string, warnings: ValidationError[]): void {
    const primitivePattern = /def\s+\w+\s*\([^)]*:\s*(str|int|float|bool|dict|list)[^)]*\)/;

    if (primitivePattern.test(code)) {
      warnings.push({
        message: 'Task functions should use Pydantic models instead of primitive types',
        code: 'PRIMITIVE_TYPES_DETECTED',
        severity: 'warning',
      });
    }
  }

  /**
   * Validate models inherit from BaseModel
   */
  private static validateBaseModelInheritance(
    code: string,
    inputModelName: string,
    outputModelName: string,
    errors: ValidationError[]
  ): void {
    // Check input model
    const inputPattern = new RegExp(`class\\s+${inputModelName}\\s*\\([^)]*\\)`);
    const inputMatch = code.match(inputPattern);

    if (inputMatch && !inputMatch[0].includes('BaseModel')) {
      errors.push({
        message: `${inputModelName} must inherit from BaseModel`,
        code: 'INPUT_MODEL_NO_BASEMODEL',
        severity: 'error',
      });
    }

    // Check output model
    const outputPattern = new RegExp(`class\\s+${outputModelName}\\s*\\([^)]*\\)`);
    const outputMatch = code.match(outputPattern);

    if (outputMatch && !outputMatch[0].includes('BaseModel')) {
      errors.push({
        message: `${outputModelName} must inherit from BaseModel`,
        code: 'OUTPUT_MODEL_NO_BASEMODEL',
        severity: 'error',
      });
    }
  }

  /**
   * Quick syntax check (can be expanded with Python linter integration)
   */
  static async checkPythonSyntax(code: string): Promise<ValidationResult> {
    // Basic checks
    const errors: ValidationError[] = [];

    // Check for balanced parentheses/brackets
    const opens = (code.match(/[({[]/g) || []).length;
    const closes = (code.match(/[)}\]]/g) || []).length;

    if (opens !== closes) {
      errors.push({
        message: 'Unbalanced parentheses, brackets, or braces',
        code: 'SYNTAX_UNBALANCED',
        severity: 'error',
      });
    }

    // Check for incomplete function definitions
    if (/def\s+\w+\s*\([^)]*$/.test(code)) {
      errors.push({
        message: 'Incomplete function definition',
        code: 'SYNTAX_INCOMPLETE_FUNCTION',
        severity: 'error',
      });
    }

    // Check for incomplete class definitions
    if (/class\s+\w+\s*\([^)]*$/.test(code)) {
      errors.push({
        message: 'Incomplete class definition',
        code: 'SYNTAX_INCOMPLETE_CLASS',
        severity: 'error',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate against FormSchema (schema compatibility check)
   */
  static validateSchemaCompatibility(
    code: string,
    inputSchemaFields: string[],
    outputSchemaFields: string[]
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Extract field definitions from code
    const codeFields = this.extractFieldsFromCode(code);

    // Check input fields match
    inputSchemaFields.forEach((field) => {
      if (!codeFields.includes(field)) {
        warnings.push({
          message: `Input field '${field}' from schema not found in generated model`,
          code: 'SCHEMA_FIELD_MISMATCH',
          severity: 'warning',
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extract field names from Pydantic class definitions
   */
  private static extractFieldsFromCode(code: string): string[] {
    const fields: string[] = [];
    const fieldPattern = /^\s+(\w+):\s+/gm;
    let match = fieldPattern.exec(code);

    while (match !== null) {
      fields.push(match[1]);
      match = fieldPattern.exec(code);
    }

    return fields;
  }
}

export default TaskValidationService;
