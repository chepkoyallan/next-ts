/**
 * Engine API - Auth Metadata
 * Authentication and OAuth2 metadata endpoints
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import { RBACDecorators } from 'src/app/api/lib/auth/rbac/middleware';
import { requireSecureEngine } from 'src/app/api/lib/services/engine-helper-rbac';

// Force dynamic rendering (uses cookies for auth)
export const dynamic = 'force-dynamic';

// Query parameter schemas
const AuthEndpointQuerySchema = z.object({
  endpoint: z.enum(['oauth2', 'config']).default('oauth2'),
});

// Note: OAuth2MetadataRequest and PublicClientAuthConfigRequest are empty messages

/**
 * GET /api/v1/engine/auth/oauth2
 * Get OAuth2 metadata
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSecureEngine(request, {
      serviceName: 'authMetadata',
      rbac: RBACDecorators.requirePermission('system', 'read'),
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
    const validatedQuery = AuthEndpointQuerySchema.parse(queryParams);

    if (validatedQuery.endpoint === 'oauth2') {
      const oauth2Result = await engineManager.services.authMetadata!.getOAuth2Metadata({});
      return NextResponse.json({
        success: true,
        data: oauth2Result,
      });
    }

    if (validatedQuery.endpoint === 'config') {
      const configResult = await engineManager.services.authMetadata!.getPublicClientConfig({});
      return NextResponse.json({
        success: true,
        data: configResult,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid endpoint. Use ?endpoint=oauth2 or ?endpoint=config',
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
        error: error instanceof Error ? error.message : 'Failed to get auth metadata',
      },
      { status: 500 }
    );
  }
}
