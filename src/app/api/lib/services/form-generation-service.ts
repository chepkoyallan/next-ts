/**
 * Form Generation Service
 * Dynamic form creation, validation, assignment, and submission tracking
 * Based on JSON Schema standards with AJV validation
 * Uses Prisma for persistent storage
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

import { prisma } from '@app/database';

import { recordMetric } from './metrics-service';
import { triggerWebhookEvent } from './webhook-service';
import { SchemaEnrichmentService } from './schema-enrichment-service';
import { endSpan, startSpan, recordException } from './tracing-service';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface FormSchema {
  id: string;
  name: string;
  description?: string;
  version: string;
  schema: any; // JSON Schema object
  uischema?: any; // UI Schema for layout customization
  dataSources?: Record<string, any>; // Connector data source configurations
  dependencies?: any; // Field dependencies for dynamic behavior
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    tags: string[];
    category: string;
  };
  usage: {
    assignmentCount: number;
    lastUsed?: Date;
    popularity: number;
  };
}

export interface FormAssignment {
  id: string;
  schemaId: string;
  targetType: 'workflow' | 'task' | 'node' | 'execution';
  // Flyte resource identification (matches database schema)
  targetProject: string;
  targetDomain: string;
  targetName: string;
  targetVersion: string;
  assignmentType: 'input' | 'output' | 'config';
  status: 'active' | 'inactive' | 'draft';
  configuration?: {
    readonly?: boolean;
    validationMode?: 'ValidateAndShow' | 'ValidateAndHide' | 'NoValidation';
    customRenderers?: string[];
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    name?: string;
    description?: string;
  };
}

export interface FormSubmission {
  id: string;
  assignmentId: string;
  data: Record<string, any>;
  isValid: boolean;
  errors: any[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    submittedAt?: Date;
    submittedBy?: string;
  };
}

export interface CreateSchemaInput {
  name: string;
  description?: string;
  version?: string;
  schema: any;
  uischema?: any;
  tags?: string[];
  category?: string;
  dataSources?: Record<string, any>; // Connector data source configurations
  dependencies?: any; // Field dependencies for dynamic behavior
}

export interface CreateAssignmentInput {
  schemaId: string;
  targetType: 'workflow' | 'task' | 'node' | 'execution';
  // Flyte resource identification (required for proper version matching)
  targetProject: string;
  targetDomain: string;
  targetName: string;
  targetVersion: string;
  assignmentType: 'input' | 'output' | 'config';
  name?: string;
  description?: string;
  configuration?: {
    readonly?: boolean;
    validationMode?: 'ValidateAndShow' | 'ValidateAndHide' | 'NoValidation';
    customRenderers?: string[];
  };
}

export interface CreateSubmissionInput {
  assignmentId: string;
  data: Record<string, any>;
  // Analytics fields
  completionTime?: number; // seconds to complete form
  status?: 'success' | 'failed' | 'abandoned';
  schemaId?: string; // for analytics denormalization
  taskId?: string; // for analytics denormalization
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// AJV Validator Setup
// ============================================================================

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// ============================================================================
// Schema Management
// ============================================================================

/**
 * Validate JSON Schema structure
 */
export function validateJsonSchema(schema: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic structure validation
  if (!schema || typeof schema !== 'object') {
    errors.push('Schema must be a valid JSON object');
    return { isValid: false, errors, warnings };
  }

  // Check for required JSON Schema properties
  if (!schema.type && !schema.properties && !schema.$ref) {
    warnings.push('Schema should have a "type" or "properties" field');
  }

  // Validate against JSON Schema meta-schema
  try {
    const isValidSchema = ajv.validateSchema(schema);
    if (!isValidSchema && ajv.errors) {
      errors.push(...ajv.errors.map((err) => `Schema validation: ${err.message}`));
    }
  } catch {
    errors.push('Failed to validate schema structure');
  }

  // Check for common issues
  if (schema.type === 'object' && !schema.properties) {
    warnings.push('Object type schema should define properties');
  }

  if (schema.properties && Object.keys(schema.properties).length === 0) {
    warnings.push('Schema has no properties defined');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get all schemas with optional filtering
 */
export async function getAllSchemas(filters?: {
  search?: string;
  category?: string;
  tags?: string[];
  createdBy?: string;
  organizationId?: string;
}): Promise<FormSchema[]> {
  const where: any = {};

  // CRITICAL: Filter by organizationId for multi-tenancy
  if (filters?.organizationId) {
    where.organizationId = filters.organizationId;
  }

  if (filters?.category) {
    where.category = filters.category;
  }

  if (filters?.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }

  if (filters?.createdBy) {
    where.createdBy = filters.createdBy;
  }

  if (filters?.search) {
    const searchTerm = filters.search.toLowerCase();
    where.OR = [
      { name: { contains: searchTerm, mode: 'insensitive' } },
      { description: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  const records = await prisma.formSchema.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return records.map(mapPrismaToFormSchema);
}

/**
 * Get schema by ID
 */
export async function getSchema(id: string): Promise<FormSchema | null> {
  const record = await prisma.formSchema.findUnique({
    where: { id },
  });

  return record ? mapPrismaToFormSchema(record) : null;
}

/**
 * Get schema by ID with automatic connector enrichment
 * Returns EnhancedFormSchema with dataSources automatically populated
 */
export async function getEnrichedSchema(
  id: string,
  organizationId: string,
  options?: {
    autoEnrich?: boolean;
    matchThreshold?: number;
    excludeFields?: string[];
  }
): Promise<
  import('../../../../sections/form-generator-bk/types/data-source-types').EnhancedFormSchema | null
> {
  const schema = await getSchema(id);
  if (!schema) {
    return null;
  }

  // Extract field annotations from schema
  const fieldAnnotations = SchemaEnrichmentService.extractFieldAnnotations(schema.schema);

  // Enrich schema with connectors
  const enrichedSchema = await SchemaEnrichmentService.enrichSchema(
    schema.schema,
    schema.uischema,
    {
      organizationId,
      autoEnrich: options?.autoEnrich ?? true,
      matchThreshold: options?.matchThreshold ?? 0.6,
      fieldAnnotations,
      excludeFields: options?.excludeFields,
    }
  );

  return enrichedSchema;
}

/**
 * Create new schema
 */
export async function createSchema(
  input: CreateSchemaInput,
  createdBy: string,
  organizationId: string,
  traceId?: string
): Promise<FormSchema> {
  const span = traceId
    ? startSpan(traceId, 'createSchema', 'INTERNAL', undefined, { schemaName: input.name })
    : null;

  try {
    // Validate schema structure
    const validation = validateJsonSchema(input.schema);
    if (!validation.isValid) {
      throw new Error(`Invalid schema: ${validation.errors.join(', ')}`);
    }

    // Validate dataSources if provided
    if (input.dataSources) {
      // Import validation utilities dynamically to avoid circular dependencies
      const { validateEnhancedFormSchema } = await import(
        '../../../../sections/form-generator-bk/utils/connector-validation'
      );

      const dataSourceValidation = validateEnhancedFormSchema(
        {
          schema: input.schema,
          dataSources: input.dataSources,
          dependencies: input.dependencies,
        },
        {} // Connectors will be validated at runtime when the form is used
      );

      if (!dataSourceValidation.valid) {
        throw new Error(
          `Invalid data sources: ${dataSourceValidation.errors.map((e) => e.message).join(', ')}`
        );
      }
    }

    const record = await prisma.formSchema.create({
      data: {
        name: input.name,
        description: input.description,
        version: input.version || '1.0.0',
        schema: input.schema as any,
        uischema: input.uischema ? (input.uischema as any) : undefined,
        dataSources: input.dataSources ? (input.dataSources as any) : undefined,
        dependencies: input.dependencies ? (input.dependencies as any) : undefined,
        tags: input.tags || [],
        category: input.category || 'general',
        organizationId, // CRITICAL: Set organization for multi-tenancy
        createdBy,
      },
    });

    const newSchema = mapPrismaToFormSchema(record);

    // Record metrics
    recordMetric({
      endpoint: '/forms/schemas',
      method: 'POST',
      statusCode: 201,
      responseTime: 0,
      userId: createdBy,
    });

    // Trigger webhook
    await triggerWebhookEvent('form.schema.created', {
      schemaId: newSchema.id,
      name: newSchema.name,
      createdBy,
    });

    if (span) {
      endSpan(span.spanId, 'OK', { schemaId: newSchema.id });
    }

    console.log(`✅ Form schema created: ${newSchema.name} (${newSchema.id})`);

    return newSchema;
  } catch (error: any) {
    if (span) {
      recordException(span.spanId, error);
      endSpan(span.spanId, 'ERROR');
    }
    throw error;
  }
}

/**
 * Update schema
 */
export async function updateSchema(
  id: string,
  updates: Partial<CreateSchemaInput>,
  traceId?: string
): Promise<FormSchema> {
  const span = traceId
    ? startSpan(traceId, 'updateSchema', 'INTERNAL', undefined, { schemaId: id })
    : null;

  try {
    // Check if schema exists
    const existing = await prisma.formSchema.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Schema not found');
    }

    // Validate schema if being updated
    if (updates.schema) {
      const validation = validateJsonSchema(updates.schema);
      if (!validation.isValid) {
        throw new Error(`Invalid schema: ${validation.errors.join(', ')}`);
      }
    }

    // Validate dataSources if being updated
    if (updates.dataSources !== undefined) {
      // Import validation utilities dynamically to avoid circular dependencies
      const { validateEnhancedFormSchema } = await import(
        '../../../../sections/form-generator-bk/utils/connector-validation'
      );

      const dataSourceValidation = validateEnhancedFormSchema(
        {
          schema: updates.schema || existing.schema,
          dataSources: updates.dataSources,
          dependencies: updates.dependencies || existing.dependencies,
        },
        {} // Connectors will be validated at runtime when the form is used
      );

      if (!dataSourceValidation.valid) {
        throw new Error(
          `Invalid data sources: ${dataSourceValidation.errors.map((e) => e.message).join(', ')}`
        );
      }
    }

    const data: any = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.version !== undefined) data.version = updates.version;
    if (updates.schema !== undefined) data.schema = updates.schema as any;
    if (updates.uischema !== undefined) data.uischema = updates.uischema as any;
    if (updates.dataSources !== undefined) data.dataSources = updates.dataSources as any;
    if (updates.dependencies !== undefined) data.dependencies = updates.dependencies as any;
    if (updates.tags !== undefined) data.tags = updates.tags;
    if (updates.category !== undefined) data.category = updates.category;

    const record = await prisma.formSchema.update({
      where: { id },
      data,
    });

    const updatedSchema = mapPrismaToFormSchema(record);

    // Trigger webhook
    await triggerWebhookEvent('form.schema.updated', {
      schemaId: id,
      name: updatedSchema.name,
    });

    if (span) {
      endSpan(span.spanId, 'OK');
    }

    console.log(`✅ Form schema updated: ${updatedSchema.name} (${id})`);

    return updatedSchema;
  } catch (error: any) {
    if (span) {
      recordException(span.spanId, error);
      endSpan(span.spanId, 'ERROR');
    }
    throw error;
  }
}

/**
 * Delete schema
 */
export async function deleteSchema(id: string, traceId?: string): Promise<boolean> {
  const span = traceId
    ? startSpan(traceId, 'deleteSchema', 'INTERNAL', undefined, { schemaId: id })
    : null;

  try {
    // Check if schema exists
    const schema = await prisma.formSchema.findUnique({
      where: { id },
      include: { assignments: true },
    });

    if (!schema) {
      throw new Error('Schema not found');
    }

    // Check if schema is in use
    if (schema.assignments.length > 0) {
      throw new Error('Cannot delete schema that is currently assigned');
    }

    await prisma.formSchema.delete({ where: { id } });

    // Trigger webhook
    await triggerWebhookEvent('form.schema.deleted', {
      schemaId: id,
      name: schema.name,
    });

    if (span) {
      endSpan(span.spanId, 'OK');
    }

    console.log(`✅ Form schema deleted: ${schema.name} (${id})`);

    return true;
  } catch (error: any) {
    if (span) {
      recordException(span.spanId, error);
      endSpan(span.spanId, 'ERROR');
    }
    throw error;
  }
}

// ============================================================================
// Assignment Management
// ============================================================================

/**
 * Get all assignments with optional filtering
 */
export async function getAllAssignments(filters?: {
  targetType?: string;
  targetId?: string;
  schemaId?: string;
  status?: string;
  assignmentType?: string;
  organizationId?: string;
}): Promise<FormAssignment[]> {
  const where: any = {};

  // CRITICAL: Filter by organizationId for multi-tenancy
  if (filters?.organizationId) {
    where.organizationId = filters.organizationId;
  }

  if (filters?.schemaId) {
    where.schemaId = filters.schemaId;
  }

  if (filters?.targetType) {
    where.targetType = filters.targetType;
  }

  // Note: targetId filter not supported - use targetProject/targetDomain/targetName/targetVersion instead

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.assignmentType) {
    where.assignmentType = filters.assignmentType;
  }

  const records = await prisma.formAssignment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return records.map(mapPrismaToFormAssignment);
}

/**
 * Get assignment by ID
 */
export async function getAssignment(id: string): Promise<FormAssignment | null> {
  const record = await prisma.formAssignment.findUnique({
    where: { id },
  });

  return record ? mapPrismaToFormAssignment(record) : null;
}

/**
 * Create assignment
 */
export async function createAssignment(
  input: CreateAssignmentInput,
  createdBy: string,
  organizationId: string,
  traceId?: string
): Promise<FormAssignment> {
  const span = traceId
    ? startSpan(traceId, 'createAssignment', 'INTERNAL', undefined, {
        schemaId: input.schemaId,
        targetType: input.targetType,
      })
    : null;

  try {
    // Validate schema exists and belongs to same organization
    const schema = await prisma.formSchema.findUnique({
      where: { id: input.schemaId },
    });

    if (!schema) {
      throw new Error('Schema not found');
    }

    // CRITICAL: Validate schema belongs to same organization
    if (schema.organizationId && schema.organizationId !== organizationId) {
      throw new Error('Schema does not belong to your organization');
    }

    // CRITICAL: Validate version matching - forms must match task version exactly
    if (schema.version !== input.targetVersion) {
      throw new Error(
        `Version mismatch: Schema version "${schema.version}" does not match task version "${input.targetVersion}". ` +
          `Forms can only be assigned to tasks with the same version for data integrity.`
      );
    }

    const record = await prisma.formAssignment.create({
      data: {
        schemaId: input.schemaId,
        organizationId, // CRITICAL: Set organization for multi-tenancy
        targetType: input.targetType,
        targetProject: input.targetProject,
        targetDomain: input.targetDomain,
        targetName: input.targetName,
        targetVersion: input.targetVersion,
        assignmentType: input.assignmentType,
        status: 'active',
        configuration: input.configuration ? (input.configuration as any) : undefined,
        name: input.name,
        description: input.description,
        createdBy,
      },
    });

    // Update schema usage count
    await prisma.formSchema.update({
      where: { id: input.schemaId },
      data: {
        assignmentCount: { increment: 1 },
        lastUsed: new Date(),
        popularity: { increment: 1 },
      },
    });

    const newAssignment = mapPrismaToFormAssignment(record);

    // Trigger webhook
    await triggerWebhookEvent('form.assignment.created', {
      assignmentId: newAssignment.id,
      schemaId: input.schemaId,
      targetType: input.targetType,
      target: `${input.targetProject}:${input.targetDomain}:${input.targetName}:${input.targetVersion}`,
    });

    if (span) {
      endSpan(span.spanId, 'OK', { assignmentId: newAssignment.id });
    }

    console.log(`✅ Form assignment created: ${newAssignment.id}`);

    return newAssignment;
  } catch (error: any) {
    if (span) {
      recordException(span.spanId, error);
      endSpan(span.spanId, 'ERROR');
    }
    throw error;
  }
}

/**
 * Update assignment
 */
export async function updateAssignment(
  id: string,
  updates: Partial<CreateAssignmentInput & { status?: FormAssignment['status'] }>,
  traceId?: string
): Promise<FormAssignment> {
  const span = traceId
    ? startSpan(traceId, 'updateAssignment', 'INTERNAL', undefined, { assignmentId: id })
    : null;

  try {
    // Check if assignment exists
    const existing = await prisma.formAssignment.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Assignment not found');
    }

    const data: any = {};
    if (updates.targetType !== undefined) data.targetType = updates.targetType;
    if (updates.targetProject !== undefined) data.targetProject = updates.targetProject;
    if (updates.targetDomain !== undefined) data.targetDomain = updates.targetDomain;
    if (updates.targetName !== undefined) data.targetName = updates.targetName;
    if (updates.targetVersion !== undefined) data.targetVersion = updates.targetVersion;
    if (updates.assignmentType !== undefined) data.assignmentType = updates.assignmentType;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.configuration !== undefined) data.configuration = updates.configuration as any;
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined) data.description = updates.description;

    const record = await prisma.formAssignment.update({
      where: { id },
      data,
    });

    const updatedAssignment = mapPrismaToFormAssignment(record);

    if (span) {
      endSpan(span.spanId, 'OK');
    }

    console.log(`✅ Form assignment updated: ${id}`);

    return updatedAssignment;
  } catch (error: any) {
    if (span) {
      recordException(span.spanId, error);
      endSpan(span.spanId, 'ERROR');
    }
    throw error;
  }
}

/**
 * Delete assignment
 */
export async function deleteAssignment(id: string, traceId?: string): Promise<boolean> {
  const span = traceId
    ? startSpan(traceId, 'deleteAssignment', 'INTERNAL', undefined, { assignmentId: id })
    : null;

  try {
    // Get assignment to update schema usage
    const assignment = await prisma.formAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    await prisma.formAssignment.delete({ where: { id } });

    // Update schema usage count
    await prisma.formSchema.update({
      where: { id: assignment.schemaId },
      data: {
        assignmentCount: { decrement: 1 },
      },
    });

    if (span) {
      endSpan(span.spanId, 'OK');
    }

    console.log(`✅ Form assignment deleted: ${id}`);

    return true;
  } catch (error: any) {
    if (span) {
      recordException(span.spanId, error);
      endSpan(span.spanId, 'ERROR');
    }
    throw error;
  }
}

// ============================================================================
// Submission Management
// ============================================================================

/**
 * Get all submissions with optional filtering
 */
export async function getAllSubmissions(filters?: {
  assignmentId?: string;
  isValid?: boolean;
  submittedBy?: string;
}): Promise<FormSubmission[]> {
  const where: any = {};

  if (filters?.assignmentId) {
    where.assignmentId = filters.assignmentId;
  }

  if (filters?.isValid !== undefined) {
    where.isValid = filters.isValid;
  }

  if (filters?.submittedBy) {
    where.submittedBy = filters.submittedBy;
  }

  const records = await prisma.formSubmission.findMany({
    where,
    orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
  });

  return records.map(mapPrismaToFormSubmission);
}

/**
 * Get submission by ID
 */
export async function getSubmission(id: string): Promise<FormSubmission | null> {
  const record = await prisma.formSubmission.findUnique({
    where: { id },
  });

  return record ? mapPrismaToFormSubmission(record) : null;
}

/**
 * Create submission (submit form data)
 */
export async function createSubmission(
  input: CreateSubmissionInput,
  submittedBy: string,
  traceId?: string
): Promise<FormSubmission> {
  const span = traceId
    ? startSpan(traceId, 'createSubmission', 'INTERNAL', undefined, {
        assignmentId: input.assignmentId,
      })
    : null;

  try {
    // Validate assignment exists and get schema
    const assignment = await prisma.formAssignment.findUnique({
      where: { id: input.assignmentId },
      include: { schema: true },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    // Validate data against schema
    const validate = ajv.compile(assignment.schema.schema as any);
    const isValid = validate(input.data);
    const errors = validate.errors || [];

    const record = await prisma.formSubmission.create({
      data: {
        assignmentId: input.assignmentId,
        data: input.data as any,
        isValid,
        errors: errors as any,
        submittedBy,
        submittedAt: new Date(),
        // Analytics fields
        completionTime: input.completionTime,
        status: input.status || 'success',
        schemaId: input.schemaId || assignment.schemaId,
        taskId: input.taskId,
      },
    });

    const newSubmission = mapPrismaToFormSubmission(record);

    // Record metrics
    recordMetric({
      endpoint: '/forms/submissions',
      method: 'POST',
      statusCode: 201,
      responseTime: 0,
      userId: submittedBy,
    });

    // Trigger webhooks
    await triggerWebhookEvent('form.submission.created', {
      submissionId: newSubmission.id,
      assignmentId: input.assignmentId,
      isValid,
      submittedBy,
    });

    if (!isValid) {
      await triggerWebhookEvent('form.validation.failed', {
        submissionId: newSubmission.id,
        assignmentId: input.assignmentId,
        errors,
      });
    }

    if (span) {
      endSpan(span.spanId, 'OK', { submissionId: newSubmission.id, isValid });
    }

    console.log(`✅ Form submission created: ${newSubmission.id} (valid: ${isValid})`);

    return newSubmission;
  } catch (error: any) {
    if (span) {
      recordException(span.spanId, error);
      endSpan(span.spanId, 'ERROR');
    }
    throw error;
  }
}

/**
 * Update submission
 */
export async function updateSubmission(
  id: string,
  data: Record<string, any>,
  traceId?: string
): Promise<FormSubmission> {
  const span = traceId
    ? startSpan(traceId, 'updateSubmission', 'INTERNAL', undefined, { submissionId: id })
    : null;

  try {
    // Get submission with assignment and schema
    const submission = await prisma.formSubmission.findUnique({
      where: { id },
      include: {
        assignment: {
          include: { schema: true },
        },
      },
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    // Validate data against schema
    const validate = ajv.compile(submission.assignment.schema.schema as any);
    const isValid = validate(data);
    const errors = validate.errors || [];

    const record = await prisma.formSubmission.update({
      where: { id },
      data: {
        data,
        isValid,
        errors: errors as any,
      },
    });

    const updatedSubmission = mapPrismaToFormSubmission(record);

    if (span) {
      endSpan(span.spanId, 'OK', { isValid });
    }

    console.log(`✅ Form submission updated: ${id} (valid: ${isValid})`);

    return updatedSubmission;
  } catch (error: any) {
    if (span) {
      recordException(span.spanId, error);
      endSpan(span.spanId, 'ERROR');
    }
    throw error;
  }
}

/**
 * Delete submission
 */
export async function deleteSubmission(id: string, traceId?: string): Promise<boolean> {
  const span = traceId
    ? startSpan(traceId, 'deleteSubmission', 'INTERNAL', undefined, { submissionId: id })
    : null;

  try {
    await prisma.formSubmission.delete({ where: { id } });

    if (span) {
      endSpan(span.spanId, 'OK');
    }

    console.log(`✅ Form submission deleted: ${id}`);

    return true;
  } catch (error: any) {
    if (span) {
      recordException(span.spanId, error);
      endSpan(span.spanId, 'ERROR');
    }
    throw error;
  }
}

// ============================================================================
// Statistics & Utilities
// ============================================================================

/**
 * Get form generation statistics
 */
export async function getFormStatistics(): Promise<{
  totalSchemas: number;
  totalAssignments: number;
  activeAssignments: number;
  totalSubmissions: number;
  validSubmissions: number;
  invalidSubmissions: number;
  popularSchemas: Array<{ id: string; name: string; popularity: number; assignmentCount: number }>;
  recentActivity: Array<{
    id: string;
    type: 'schema_created' | 'assignment_created' | 'submission_created';
    entityId: string;
    entityName: string;
    userId: string;
    timestamp: Date;
  }>;
}> {
  const [
    totalSchemas,
    totalAssignments,
    activeAssignments,
    totalSubmissions,
    validSubmissions,
    invalidSubmissions,
  ] = await Promise.all([
    prisma.formSchema.count(),
    prisma.formAssignment.count(),
    prisma.formAssignment.count({ where: { status: 'active' } }),
    prisma.formSubmission.count(),
    prisma.formSubmission.count({ where: { isValid: true } }),
    prisma.formSubmission.count({ where: { isValid: false } }),
  ]);

  // Popular schemas
  const popularSchemaRecords = await prisma.formSchema.findMany({
    orderBy: { popularity: 'desc' },
    take: 10,
    select: {
      id: true,
      name: true,
      popularity: true,
      assignmentCount: true,
    },
  });

  const popularSchemas = popularSchemaRecords.map((s) => ({
    id: s.id,
    name: s.name,
    popularity: s.popularity,
    assignmentCount: s.assignmentCount,
  }));

  // Recent activity
  const [recentSchemas, recentAssignments, recentSubmissions] = await Promise.all([
    prisma.formSchema.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        createdBy: true,
        createdAt: true,
      },
    }),
    prisma.formAssignment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        createdBy: true,
        createdAt: true,
      },
    }),
    prisma.formSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        submittedBy: true,
        createdAt: true,
        submittedAt: true,
      },
    }),
  ]);

  const recentActivity = [
    ...recentSchemas.map((s) => ({
      id: `schema_${s.id}`,
      type: 'schema_created' as const,
      entityId: s.id,
      entityName: s.name,
      userId: s.createdBy,
      timestamp: s.createdAt,
    })),
    ...recentAssignments.map((a) => ({
      id: `assignment_${a.id}`,
      type: 'assignment_created' as const,
      entityId: a.id,
      entityName: a.name || 'Form Assignment',
      userId: a.createdBy,
      timestamp: a.createdAt,
    })),
    ...recentSubmissions.map((s) => ({
      id: `submission_${s.id}`,
      type: 'submission_created' as const,
      entityId: s.id,
      entityName: 'Form Submission',
      userId: s.submittedBy || 'unknown',
      timestamp: s.submittedAt || s.createdAt,
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 20);

  return {
    totalSchemas,
    totalAssignments,
    activeAssignments,
    totalSubmissions,
    validSubmissions,
    invalidSubmissions,
    popularSchemas,
    recentActivity,
  };
}

/**
 * Get available categories
 */
export async function getAvailableCategories(): Promise<string[]> {
  const records = await prisma.formSchema.findMany({
    select: { category: true },
    distinct: ['category'],
  });

  return records.map((r) => r.category).sort();
}

/**
 * Get available tags
 */
export async function getAvailableTags(): Promise<string[]> {
  const records = await prisma.formSchema.findMany({
    select: { tags: true },
  });

  const tags = new Set<string>();
  records.forEach((r) => {
    r.tags.forEach((tag: string) => tags.add(tag));
  });

  return Array.from(tags).sort();
}

/**
 * Clean up old submissions
 */
export async function cleanupOldSubmissions(olderThan?: Date): Promise<void> {
  const cutoff = olderThan || new Date(Date.now() - 30 * 24 * 3600000); // 30 days ago

  const result = await prisma.formSubmission.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });

  console.log(
    `✅ Cleaned up ${result.count} old form submissions (before ${cutoff.toISOString()})`
  );
}

// ============================================================================
// Mapper Functions
// ============================================================================

function mapPrismaToFormSchema(record: any): FormSchema {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    version: record.version,
    schema: record.schema,
    uischema: record.uischema,
    dataSources: record.dataSources || undefined,
    dependencies: record.dependencies || undefined,
    metadata: {
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      tags: record.tags,
      category: record.category,
    },
    usage: {
      assignmentCount: record.assignmentCount,
      lastUsed: record.lastUsed,
      popularity: record.popularity,
    },
  };
}

function mapPrismaToFormAssignment(record: any): FormAssignment {
  return {
    id: record.id,
    schemaId: record.schemaId,
    targetType: record.targetType as any,
    targetProject: record.targetProject,
    targetDomain: record.targetDomain,
    targetName: record.targetName,
    targetVersion: record.targetVersion,
    assignmentType: record.assignmentType as any,
    status: record.status as any,
    configuration: record.configuration,
    metadata: {
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdBy: record.createdBy,
      name: record.name,
      description: record.description,
    },
  };
}

function mapPrismaToFormSubmission(record: any): FormSubmission {
  return {
    id: record.id,
    assignmentId: record.assignmentId,
    data: record.data,
    isValid: record.isValid,
    errors: record.errors,
    metadata: {
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      submittedAt: record.submittedAt,
      submittedBy: record.submittedBy,
    },
  };
}
