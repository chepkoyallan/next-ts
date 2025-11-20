import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';
import {
  isValidJsonSchema,
  generateSchemaName,
  generateSchemaTags,
  extractSchemasFromTask,
  type FlyteTaskInterface,
} from 'src/app/api/lib/utils/schema-extraction';

/**
 * Task registration schema validator
 */
const TaskRegistrationSchema = z.object({
  id: z.object({
    project: z.string().min(1),
    domain: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
  }),
  interface: z.object({
    inputs: z
      .object({
        variables: z.record(z.string(), z.any()),
      })
      .optional(),
    outputs: z
      .object({
        variables: z.record(z.string(), z.any()),
      })
      .optional(),
  }),
  metadata: z
    .object({
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      runtime: z.any().optional(),
    })
    .optional(),
  autoCreateSchemas: z.boolean().optional().default(true),
});

/**
 * POST /api/v1/tasks/register
 * Register a task and auto-create form schemas from its interface
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    const body = await request.json();

    // Validate request
    const validatedData = TaskRegistrationSchema.parse(body);

    const { id, interface: taskInterface, metadata, autoCreateSchemas } = validatedData;

    // Store task interface for later reference
    const taskData = {
      project: id.project,
      domain: id.domain,
      name: id.name,
      version: id.version,
      interface: taskInterface,
      metadata: metadata || {},
    };

    const results = {
      task: taskData,
      schemas: [] as any[],
      assignments: [] as any[],
      errors: [] as string[],
    };

    // Auto-create schemas if enabled
    if (autoCreateSchemas && taskInterface) {
      try {
        // Extract schemas from task interface
        const { inputSchema, outputSchema } = extractSchemasFromTask(
          taskInterface as FlyteTaskInterface
        );

        // Create input schema if it has properties
        if (inputSchema.properties && Object.keys(inputSchema.properties).length > 0) {
          if (isValidJsonSchema(inputSchema)) {
            const inputSchemaName = generateSchemaName(id.name, 'input', id.version);
            const inputSchemaTags = generateSchemaTags(id.name, id.domain, 'input', metadata?.tags);

            // Check if schema already exists
            let existingInputSchema = await prisma.formSchema.findFirst({
              where: {
                name: inputSchemaName,
                version: id.version,
              },
            });

            if (existingInputSchema) {
              // Update existing schema
              existingInputSchema = await prisma.formSchema.update({
                where: { id: existingInputSchema.id },
                data: {
                  schema: inputSchema as any,
                  description: metadata?.description
                    ? `Input schema for ${id.name} task - ${metadata.description}`
                    : `Input schema for ${id.name} task`,
                  tags: inputSchemaTags,
                  lastUsed: new Date(),
                },
              });
              results.schemas.push({ ...existingInputSchema, operation: 'updated' });
            } else {
              // Create new schema
              const newInputSchema = await prisma.formSchema.create({
                data: {
                  name: inputSchemaName,
                  version: id.version,
                  schema: inputSchema as any,
                  description: metadata?.description
                    ? `Input schema for ${id.name} task - ${metadata.description}`
                    : `Input schema for ${id.name} task`,
                  tags: inputSchemaTags,
                  createdBy: userId,
                },
              });
              results.schemas.push({ ...newInputSchema, operation: 'created' });
            }

            // Create form assignment for input
            const inputSchemaId = existingInputSchema
              ? existingInputSchema.id
              : results.schemas[results.schemas.length - 1].id;

            const existingInputAssignment = await prisma.formAssignment.findFirst({
              where: {
                targetProject: id.project,
                targetDomain: id.domain,
                targetName: id.name,
                targetVersion: id.version,
                assignmentType: 'input',
              },
            });

            if (existingInputAssignment) {
              // Update existing assignment
              const updatedAssignment = await prisma.formAssignment.update({
                where: { id: existingInputAssignment.id },
                data: {
                  schemaId: inputSchemaId,
                  targetType: 'task',
                  status: 'active',
                },
              });
              results.assignments.push({ ...updatedAssignment, operation: 'updated' });
            } else {
              // Create new assignment
              const newAssignment = await prisma.formAssignment.create({
                data: {
                  schemaId: inputSchemaId,
                  targetType: 'task',
                  targetProject: id.project,
                  targetDomain: id.domain,
                  targetName: id.name,
                  targetVersion: id.version,
                  assignmentType: 'input',
                  status: 'active',
                  name: `${id.name} Input Form`,
                  description: `Dynamic form for ${id.name} task inputs`,
                  createdBy: userId,
                },
              });
              results.assignments.push({ ...newAssignment, operation: 'created' });

              // Update schema usage count
              await prisma.formSchema.update({
                where: { id: inputSchemaId },
                data: {
                  assignmentCount: { increment: 1 },
                  lastUsed: new Date(),
                  popularity: { increment: 1 },
                },
              });
            }
          } else {
            results.errors.push('Generated input schema is invalid');
          }
        }

        // Create output schema if it has properties
        if (outputSchema.properties && Object.keys(outputSchema.properties).length > 0) {
          if (isValidJsonSchema(outputSchema)) {
            const outputSchemaName = generateSchemaName(id.name, 'output', id.version);
            const outputSchemaTags = generateSchemaTags(
              id.name,
              id.domain,
              'output',
              metadata?.tags
            );

            // Check if schema already exists
            let existingOutputSchema = await prisma.formSchema.findFirst({
              where: {
                name: outputSchemaName,
                version: id.version,
              },
            });

            if (existingOutputSchema) {
              // Update existing schema
              existingOutputSchema = await prisma.formSchema.update({
                where: { id: existingOutputSchema.id },
                data: {
                  schema: outputSchema as any,
                  description: metadata?.description
                    ? `Output schema for ${id.name} task - ${metadata.description}`
                    : `Output schema for ${id.name} task`,
                  tags: outputSchemaTags,
                  lastUsed: new Date(),
                },
              });
              results.schemas.push({ ...existingOutputSchema, operation: 'updated' });
            } else {
              // Create new schema
              const newOutputSchema = await prisma.formSchema.create({
                data: {
                  name: outputSchemaName,
                  version: id.version,
                  schema: outputSchema as any,
                  description: metadata?.description
                    ? `Output schema for ${id.name} task - ${metadata.description}`
                    : `Output schema for ${id.name} task`,
                  tags: outputSchemaTags,
                  createdBy: userId,
                },
              });
              results.schemas.push({ ...newOutputSchema, operation: 'created' });
            }

            // Create form assignment for output
            const outputSchemaId = existingOutputSchema
              ? existingOutputSchema.id
              : results.schemas[results.schemas.length - 1].id;

            const existingOutputAssignment = await prisma.formAssignment.findFirst({
              where: {
                targetProject: id.project,
                targetDomain: id.domain,
                targetName: id.name,
                targetVersion: id.version,
                assignmentType: 'output',
              },
            });

            if (existingOutputAssignment) {
              // Update existing assignment
              const updatedAssignment = await prisma.formAssignment.update({
                where: { id: existingOutputAssignment.id },
                data: {
                  schemaId: outputSchemaId,
                  targetType: 'task',
                  status: 'active',
                },
              });
              results.assignments.push({ ...updatedAssignment, operation: 'updated' });
            } else {
              // Create new assignment
              const newAssignment = await prisma.formAssignment.create({
                data: {
                  schemaId: outputSchemaId,
                  targetType: 'task',
                  targetProject: id.project,
                  targetDomain: id.domain,
                  targetName: id.name,
                  targetVersion: id.version,
                  assignmentType: 'output',
                  status: 'active',
                  name: `${id.name} Output Schema`,
                  description: `Schema for ${id.name} task outputs`,
                  createdBy: userId,
                },
              });
              results.assignments.push({ ...newAssignment, operation: 'created' });

              // Update schema usage count
              await prisma.formSchema.update({
                where: { id: outputSchemaId },
                data: {
                  assignmentCount: { increment: 1 },
                  lastUsed: new Date(),
                  popularity: { increment: 1 },
                },
              });
            }
          } else {
            results.errors.push('Generated output schema is invalid');
          }
        }
      } catch (error: any) {
        results.errors.push(`Schema generation failed: ${error.message}`);
      }
    }

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/tasks/register',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          ...results,
          summary: {
            schemasCreated: results.schemas.filter((s) => s.operation === 'created').length,
            schemasUpdated: results.schemas.filter((s) => s.operation === 'updated').length,
            assignmentsCreated: results.assignments.filter((a) => a.operation === 'created').length,
            assignmentsUpdated: results.assignments.filter((a) => a.operation === 'updated').length,
            errors: results.errors.length,
          },
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error registering task:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/tasks/register',
      method: 'POST',
      statusCode: error instanceof z.ZodError ? 400 : 500,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Invalid task registration data', requestId, {
          details: error.issues,
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to register task', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
