import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@app/database';

import { recordMetric } from '../../../../lib/services/metrics-service';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from '../../../../lib/middleware/transformation';

interface TaskInterface {
  project: string;
  domain: string;
  name: string;
  version: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  metadata?: {
    tags?: string[];
    description?: string;
  };
}

interface SchemaMatch {
  schemaId: string;
  schemaName: string;
  confidence: number;
  reasons: string[];
  schema: any;
}

interface TaskDiscoveryResult {
  task: TaskInterface;
  suggestions: SchemaMatch[];
}

interface DiscoveryInput {
  tasks: TaskInterface[];
  assignmentType?: string; // 'input' | 'output' | 'config'
  maxSuggestions?: number;
}

/**
 * Calculate confidence score for schema matching
 * REQUIREMENT: Exact version match is mandatory - forms can only be linked to tasks with the same version
 */
function calculateConfidence(
  task: TaskInterface,
  schema: any,
  assignmentType: string
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Exact version match (MANDATORY - return 0 if versions don't match)
  if (schema.version !== task.version) {
    return { score: 0, reasons: ['Version mismatch - forms must match task version exactly'] };
  }

  score += 40;
  reasons.push('Exact version match');

  // 2. Name similarity
  const taskNameLower = task.name.toLowerCase();
  const schemaNameLower = (schema.name || '').toLowerCase();

  if (schemaNameLower.includes(taskNameLower) || taskNameLower.includes(schemaNameLower)) {
    score += 25;
    reasons.push('Name similarity');
  }

  // 3. Tag matching
  const taskTags = task.metadata?.tags || [];
  const schemaTags = schema.tags || [];
  const commonTags = taskTags.filter((tag: string) => schemaTags.includes(tag));

  if (commonTags.length > 0) {
    score += Math.min(15, commonTags.length * 5);
    reasons.push(`Matching tags: ${commonTags.join(', ')}`);
  }

  // 4. Type compatibility (check if schema properties match task interface)
  try {
    const schemaProps = schema.schema?.properties || {};
    const taskInterface = assignmentType === 'output' ? task.outputs : task.inputs;

    if (taskInterface && Object.keys(taskInterface).length > 0) {
      const taskProps = Object.keys(taskInterface);
      const schemaPropsKeys = Object.keys(schemaProps);
      const matchingProps = taskProps.filter((prop) => schemaPropsKeys.includes(prop));

      if (matchingProps.length > 0) {
        const matchRatio = matchingProps.length / taskProps.length;
        score += Math.floor(matchRatio * 15);
        reasons.push(`${matchingProps.length}/${taskProps.length} properties match`);
      }
    }
  } catch {
    // Skip type compatibility scoring on error
  }

  // 5. Popularity boost
  if (schema.popularity && schema.popularity > 10) {
    score += Math.min(5, Math.floor(schema.popularity / 10));
    reasons.push('Popular schema');
  }

  return { score, reasons };
}

/**
 * POST /api/v1/forms/assignments/discover
 * Discover compatible schemas for tasks using AI-powered matching
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = request.headers.get('x-request-id') || 'unknown';

  try {
    const body: DiscoveryInput = await request.json();

    // Validate input
    if (!body.tasks || !Array.isArray(body.tasks) || body.tasks.length === 0) {
      recordMetric({
        endpoint: '/api/v1/forms/assignments/discover',
        method: 'POST',
        statusCode: 400,
        responseTime: Date.now() - startTime,
      });

      return NextResponse.json(
        createErrorEnvelope(
          'VALIDATION_ERROR',
          'Tasks array is required and must not be empty',
          requestId
        ),
        { status: 400 }
      );
    }

    const assignmentType = body.assignmentType || 'input';
    const maxSuggestions = body.maxSuggestions || 3;

    // Validate each task
    const validationError = body.tasks.find((task, index) => {
      if (!task.project || !task.domain || !task.name || !task.version) {
        return {
          index,
          message: `Task at index ${index}: project, domain, name, and version are required`,
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

    // Fetch all schemas
    const schemas = await prisma.formSchema.findMany({
      orderBy: [{ popularity: 'desc' }, { updatedAt: 'desc' }],
    });

    // Discover schemas for each task
    const results: TaskDiscoveryResult[] = body.tasks.map((task) => {
      const matches: SchemaMatch[] = schemas
        .map((schema) => {
          const { score, reasons } = calculateConfidence(task, schema, assignmentType);

          // Only include schemas with confidence > 0
          if (score > 0) {
            return {
              schemaId: schema.id,
              schemaName: schema.name,
              confidence: score,
              reasons,
              schema: {
                id: schema.id,
                name: schema.name,
                version: schema.version,
                description: schema.description,
                tags: schema.tags,
                schema: schema.schema,
                popularity: schema.popularity,
                assignmentCount: schema.assignmentCount,
              },
            };
          }
          return null;
        })
        .filter((match): match is SchemaMatch => match !== null);

      // Sort by confidence (descending) and take top N
      matches.sort((a, b) => b.confidence - a.confidence);
      const topMatches = matches.slice(0, maxSuggestions);

      return {
        task: {
          project: task.project,
          domain: task.domain,
          name: task.name,
          version: task.version,
        },
        suggestions: topMatches,
      };
    });

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/discover',
      method: 'POST',
      statusCode: 200,
      responseTime: Date.now() - startTime,
    });

    return NextResponse.json(
      createSuccessEnvelope(
        {
          results,
          summary: {
            totalTasks: body.tasks.length,
            totalSchemas: schemas.length,
            tasksWithSuggestions: results.filter((r) => r.suggestions.length > 0).length,
          },
        },
        requestId
      ),
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error discovering schemas:', error);

    // Record metrics
    recordMetric({
      endpoint: '/api/v1/forms/assignments/discover',
      method: 'POST',
      statusCode: 500,
      responseTime: Date.now() - startTime,
      error: error.message,
    });

    return NextResponse.json(
      createErrorEnvelope('INTERNAL_ERROR', 'Failed to discover schemas', requestId, {
        message: error.message,
      }),
      { status: 500 }
    );
  }
}
