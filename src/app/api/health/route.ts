/**
 * Enhanced Health Check Endpoint
 * GET /api/health - Basic health check
 */

import { createSuccessResponse } from '../lib/utils/response';
import { createSingleMethodHandler } from '../lib/handlers/base';
import { detailedHealthCheck } from '../lib/services/health-check-service';

const healthHandler = createSingleMethodHandler(
  'GET',
  {
    auth: { required: false }, // Public endpoint
    rateLimit: { windowMs: 60000, maxRequests: 100 }, // 100 requests per minute
  },
  async ({ context }) => {
    const healthData = await detailedHealthCheck();

    let statusCode = 503;
    if (healthData.status === 'healthy' || healthData.status === 'degraded') {
      statusCode = 200;
    }

    return createSuccessResponse(healthData, statusCode, context.requestId);
  }
);

export const GET = healthHandler;
