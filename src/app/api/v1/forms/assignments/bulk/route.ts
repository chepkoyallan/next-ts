import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

interface BulkAssignmentInput {
  assignments: Array<{
    schemaId: string;
    targetType: string;
    targetProject: string;
    targetDomain: string;
    targetName: string;
    targetVersion: string;
    assignmentType: string;
    name?: string;
    description?: string;
    configuration?: any;
  }>;
}

/**
 * POST /api/v1/forms/assignments/bulk
 * Create multiple form assignments in one request
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const body: BulkAssignmentInput = await request.json();

    // Validate input
    if (!body.assignments || !Array.isArray(body.assignments) || body.assignments.length === 0) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments/bulk',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'Assignments array is required and must not be empty',
          requestId
        ),
        { status: 400 }
      );
    }

    // Validate each assignment
    const validTargetTypes = ['task', 'workflow', 'launchplan'];
    const validAssignmentTypes = ['input', 'output', 'config'];

    // Validation step - check for any errors first
    const validationError = body.assignments.find((assignment, index) => {
      if (!assignment.schemaId) {
        return { index, message: `Assignment at index ${index}: schemaId is required` };
      }

      if (!assignment.targetType || !validTargetTypes.includes(assignment.targetType)) {
        return {
          index,
          message: `Assignment at index ${index}: targetType must be one of: ${validTargetTypes.join(
            ', '
          )}`,
        };
      }

      if (
        !assignment.targetProject ||
        !assignment.targetDomain ||
        !assignment.targetName ||
        !assignment.targetVersion
      ) {
        return {
          index,
          message: `Assignment at index ${index}: targetProject, targetDomain, targetName, targetVersion are required`,
        };
      }

      if (!assignment.assignmentType || !validAssignmentTypes.includes(assignment.assignmentType)) {
        return {
          index,
          message: `Assignment at index ${index}: assignmentType must be one of: ${validAssignmentTypes.join(
            ', '
          )}`,
        };
      }

      return null;
    });

    if (validationError) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', (validationError as any).message, requestId),
        { status: 400 }
      );
    }

    // Get user from headers (in production, from JWT)
    const createdBy = request.headers.get('x-user-id') || 'system';

    // Create assignments in transaction
    const results = await prisma.$transaction(async (tx) => {
      const created: any[] = [];
      const errors: any[] = [];

      await Promise.all(
        body.assignments.map(async (assignment, index) => {
          try {
            // Check if schema exists
            const schema = await tx.formSchema.findUnique({
              where: { id: assignment.schemaId },
            });

            if (!schema) {
              errors.push({
                index,
                error: `Schema ${assignment.schemaId} not found`,
                assignment,
              });
              return;
            }

            // Check for existing assignment
            const existing = await tx.formAssignment.findFirst({
              where: {
                targetProject: assignment.targetProject,
                targetDomain: assignment.targetDomain,
                targetName: assignment.targetName,
                targetVersion: assignment.targetVersion,
                assignmentType: assignment.assignmentType,
              },
            });

            if (existing) {
              // Update existing
              const updated = await tx.formAssignment.update({
                where: { id: existing.id },
                data: {
                  schemaId: assignment.schemaId,
                  targetType: assignment.targetType,
                  status: 'active',
                  configuration: assignment.configuration
                    ? (assignment.configuration as any)
                    : undefined,
                  name: assignment.name,
                  description: assignment.description,
                },
              });

              created.push({ ...updated, operation: 'updated' });
            } else {
              // Create new
              const newAssignment = await tx.formAssignment.create({
                data: {
                  schemaId: assignment.schemaId,
                  targetType: assignment.targetType,
                  targetProject: assignment.targetProject,
                  targetDomain: assignment.targetDomain,
                  targetName: assignment.targetName,
                  targetVersion: assignment.targetVersion,
                  assignmentType: assignment.assignmentType,
                  status: 'active',
                  configuration: assignment.configuration
                    ? (assignment.configuration as any)
                    : undefined,
                  name: assignment.name,
                  description: assignment.description,
                  createdBy,
                },
              });

              created.push({ ...newAssignment, operation: 'created' });

              // Update schema usage count
              await tx.formSchema.update({
                where: { id: assignment.schemaId },
                data: {
                  assignmentCount: { increment: 1 },
                  lastUsed: new Date(),
                  popularity: { increment: 1 },
                },
              });
            }
          } catch (error: any) {
            errors.push({
              index,
              error: error.message,
              assignment,
            });
          }
        })
      );

      return { created, errors };
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/bulk',
      method: 'POST',
      statusCode: results.errors.length > 0 ? 207 : 201,
      responseTime: Date.now() - startTime,
      userId: createdBy,
    });

    const statusCode = results.errors.length > 0 ? 207 : 201; // 207 Multi-Status

    return NextResponse.json(
      createSuccessEnvelope(
        {
          created: results.created,
          errors: results.errors,
          summary: {
            total: body.assignments.length,
            succeeded: results.created.length,
            failed: results.errors.length,
          },
        },
        requestId
      ),
      { status: statusCode }
    );
  } catch (error: any) {
    console.error('Error creating bulk assignments:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/bulk',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to create bulk assignments', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
