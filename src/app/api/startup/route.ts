// API startup validation endpoint
import { rateLimitConfigs } from '../lib/middleware/rate-limit';
import { createSingleMethodHandler } from '../lib/handlers/base';
import { createErrorResponse, createSuccessResponse } from '../lib/utils/response';
import {
  performHealthCheck,
  validateApiConfiguration,
  validateEndpointConfiguration,
} from '../lib/utils/api-validator';

const startupHandler = createSingleMethodHandler(
  'GET',
  {
    auth: { required: true, permissions: ['admin'] },
    rateLimit: rateLimitConfigs.standard,
  },
  async ({ context }) => {
    try {
      // Perform comprehensive startup validation
      const [configValidation, healthCheck, endpointValidation] = await Promise.all([
        validateApiConfiguration(),
        performHealthCheck(),
        Promise.resolve(validateEndpointConfiguration()),
      ]);

      const startupReport = {
        timestamp: new Date().toISOString(),
        configuration: configValidation,
        health: healthCheck,
        endpoints: endpointValidation,
        summary: {
          ready:
            configValidation.valid &&
            healthCheck.status !== 'unhealthy' &&
            endpointValidation.valid,
          issues: [...configValidation.issues, ...endpointValidation.issues],
          warnings: configValidation.warnings,
        },
      };

      if (startupReport.summary.ready) {
        return createSuccessResponse(startupReport, 200, context.requestId);
      }
      return createErrorResponse(
        'BUSINESS_RULE_VIOLATION',
        {
          message: 'API not ready for production',
          details: startupReport,
        },
        context.requestId
      );
    } catch (error) {
      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        {
          message: 'Startup validation failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        context.requestId
      );
    }
  }
);

export const GET = startupHandler;
