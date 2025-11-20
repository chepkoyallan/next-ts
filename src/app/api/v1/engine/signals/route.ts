/**
 * Engine API - Signals
 * Signal management endpoints for workflow communication
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import {
  requireSecureEngine,
  auditEngineOperation,
} from 'src/app/api/lib/services/engine-helper-rbac';

import { SignalSetRequestSchema } from '../schemas';

// Query parameter schemas
const SignalListQuerySchema = z.object({
  workflowExecutionId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/v1/engine/signals
 * List signals
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'signal',
      rbac: RBACDecorators.requirePermission('executions', 'read'),
      checkSubscription: false,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager } = result;

    // Validate query parameters
    const { searchParams } = request.nextUrl;
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedQuery = SignalListQuerySchema.parse(queryParams);

    const listResult = await engineManager.services.signal!.listSignals({
      workflowExecutionId: JSON.parse(validatedQuery.workflowExecutionId),
      limit: validatedQuery.limit,
      token: '',
      filters: '',
      sortBy: undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        signals: listResult.signals || [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list signals',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/engine/signals
 * Create or set a signal
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'signal',
      rbac: RBACDecorators.requirePermission('executions', 'update'),
      checkSubscription: true,
      trackUsage: false,
    });

    if (result instanceof NextResponse) {
      return result;
    }

    const { engineManager, userId } = result;

    const { searchParams } = request.nextUrl;
    const action = searchParams.get('action') || 'get-or-create';

    // Validate request body
    const body = await request.json();

    if (action === 'get-or-create') {
      const signalResult = await engineManager.services.signal!.getOrCreateSignal(body);

      // Audit log
      await auditEngineOperation(userId, 'signal_created', 'signals', body.id || 'unknown', {
        action: 'get-or-create',
      });

      return NextResponse.json({
        success: true,
        data: signalResult,
      });
    }

    if (action === 'set') {
      const validatedData = SignalSetRequestSchema.parse(body);
      const signalResult = await engineManager.services.signal!.setSignal(validatedData as any);

      // Audit log
      await auditEngineOperation(
        userId,
        'signal_set',
        'signals',
        typeof validatedData.id === 'string' ? validatedData.id : 'unknown',
        {
          action: 'set',
        }
      );

      return NextResponse.json({
        success: true,
        data: signalResult,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Use ?action=get-or-create or ?action=set',
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to manage signal',
      },
      { status: 500 }
    );
  }
}
