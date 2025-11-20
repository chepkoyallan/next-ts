import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { flyteidl } from '@app/dsl/gen/pb-js/flyteidl';
import { recordMetric } from 'src/app/api/lib/services/metrics-service';
import { getOrInitializeEngine } from 'src/app/api/lib/services/engine-helper';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

/**
 * Workflow execution request schema
 */
const WorkflowExecutionSchema = z.object({
  workflowId: z.object({
    project: z.string(),
    domain: z.string(),
    name: z.string(),
    version: z.string(),
  }),
  inputs: z.record(z.string(), z.any()).optional(),
  launchPlanId: z
    .object({
      project: z.string(),
      domain: z.string(),
      name: z.string(),
      version: z.string(),
    })
    .optional(),
  labels: z.record(z.string(), z.string()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
});

/**
 * POST /api/v1/workflows/execute
 * Execute a deployed workflow
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'system';

  try {
    const body = await request.json();
    const validatedData = WorkflowExecutionSchema.parse(body);

    // Build execution request
    // Use launch plan name if available, otherwise use workflow name
    const baseName = validatedData.launchPlanId
      ? validatedData.launchPlanId.name
      : validatedData.workflowId.name;

    // Sanitize the name to match Flyte's regex: ^[a-z][a-z\-0-9]*$
    // 1. Remove leading dots
    // 2. Replace dots with hyphens
    // 3. Convert to lowercase
    // 4. Ensure it starts with a letter
    let sanitizedName = baseName.startsWith('.') ? baseName.substring(1) : baseName;
    sanitizedName = sanitizedName.replace(/\./g, '-').toLowerCase();

    // Ensure it starts with a letter (if it starts with number or hyphen, prefix with 'exec')
    if (!/^[a-z]/.test(sanitizedName)) {
      sanitizedName = `exec-${sanitizedName}`;
    }

    const executionName = `${sanitizedName}-${Date.now()}`;

    const executionRequest = {
      project: validatedData.workflowId.project,
      domain: validatedData.workflowId.domain,
      name: executionName,
      spec: {
        // Use launch plan if provided, otherwise this will fail
        // Flyte only accepts TASK (1) or LAUNCH_PLAN (3) as reference types
        launchPlan: validatedData.launchPlanId
          ? {
              resourceType: 3, // LAUNCH_PLAN
              project: validatedData.launchPlanId.project,
              domain: validatedData.launchPlanId.domain,
              name: validatedData.launchPlanId.name,
              version: validatedData.launchPlanId.version,
            }
          : undefined,
        metadata: {
          mode: 0, // MANUAL
          principal: userId,
          nesting: 0,
        },
        inputs: validatedData.inputs
          ? {
              literals: Object.entries(validatedData.inputs).reduce(
                (acc, [key, value]) => {
                  acc[key] = convertToLiteral(value);
                  return acc;
                },
                {} as Record<string, any>
              ),
            }
          : undefined,
        labels: validatedData.labels
          ? {
              values: validatedData.labels,
            }
          : undefined,
        annotations: validatedData.annotations
          ? {
              values: validatedData.annotations,
            }
          : undefined,
      },
    };

    // Get engine manager and create execution
    const engineManager = await getOrInitializeEngine();

    let executionId = {
      project: validatedData.workflowId.project,
      domain: validatedData.workflowId.domain,
      name: executionRequest.name,
    };

    console.log('Creating execution with request:', {
      project: executionRequest.project,
      domain: executionRequest.domain,
      name: executionRequest.name,
      launchPlan: executionRequest.spec.launchPlan,
    });

    if (engineManager && engineManager.services.workflows) {
      try {
        // Create execution via gRPC
        const createExecutionRequest: flyteidl.admin.ExecutionCreateRequest = {
          project: executionRequest.project,
          domain: executionRequest.domain,
          name: executionRequest.name,
          spec: executionRequest.spec as flyteidl.admin.IExecutionSpec,
        } as flyteidl.admin.ExecutionCreateRequest;

        const response =
          await engineManager.services.workflows.createExecution(createExecutionRequest);

        executionId = response.id as any;
        console.log('Execution created successfully:', executionId);
      } catch (error) {
        console.error('Error creating execution via gRPC:', error);
        throw error; // Don't fall back, throw the error so we can see what went wrong
      }
    } else {
      const errorMsg = 'Workflow service not available';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    recordMetric({
      endpoint: '/api/v1/workflows/execute',
      method: 'POST',
      statusCode: 201,
      responseTime: Date.now() - startTime,
      userId,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          executionId,
          message: 'Workflow execution started',
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error executing workflow:', error);

    const statusCode = error instanceof z.ZodError ? 400 : 500;

    recordMetric({
      endpoint: '/api/v1/workflows/execute',
      method: 'POST',
      statusCode,
      responseTime: Date.now() - startTime,
      userId,
      error: error.message,
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        createErrorEnvelope('VALIDATION_ERROR', 'Invalid execution request', requestId, {
          details: error.issues,
        }),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to execute workflow', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}

/**
 * Convert JavaScript value to Flyte Literal
 */
function convertToLiteral(value: any): any {
  if (typeof value === 'string') {
    return {
      scalar: {
        primitive: {
          stringValue: value,
        },
      },
    };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return {
        scalar: {
          primitive: {
            integer: value,
          },
        },
      };
    }
    return {
      scalar: {
        primitive: {
          floatValue: value,
        },
      },
    };
  }
  if (typeof value === 'boolean') {
    return {
      scalar: {
        primitive: {
          boolean: value,
        },
      },
    };
  }
  if (value === null) {
    return {
      scalar: {
        noneType: {},
      },
    };
  }
  if (Array.isArray(value)) {
    return {
      collection: {
        literals: value.map(convertToLiteral),
      },
    };
  }
  if (typeof value === 'object') {
    return {
      map: {
        literals: Object.entries(value).reduce(
          (acc, [key, val]) => {
            acc[key] = convertToLiteral(val);
            return acc;
          },
          {} as Record<string, any>
        ),
      },
    };
  }

  return {
    scalar: {
      generic: JSON.parse(JSON.stringify(value)),
    },
  };
}
