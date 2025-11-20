/**
 * Engine Debug Endpoint
 * Check engine manager status
 */

import { NextResponse } from 'next/server';

import { getEngineManager } from 'src/app/api/lib/services/engine-initializer';

export async function GET() {
  const engineManager = getEngineManager();

  const debug = {
    engineManagerExists: engineManager !== null,
    services: engineManager
      ? {
          admin: engineManager.services.admin !== null,
          tasks: engineManager.services.tasks !== null,
          workflows: engineManager.services.workflows !== null,
          authMetadata: engineManager.services.authMetadata !== null,
          dataProxy: engineManager.services.dataProxy !== null,
          externalPlugin: engineManager.services.externalPlugin !== null,
          identity: engineManager.services.identity !== null,
          signal: engineManager.services.signal !== null,
        }
      : null,
    serviceDetails: engineManager
      ? {
          admin: engineManager.services.admin
            ? {
                initialized: (engineManager.services.admin as any).initialized,
                isReady: engineManager.services.admin.isReady(),
              }
            : null,
        }
      : null,
    env: {
      FLYTE_ADMIN_HOST: process.env.FLYTE_ADMIN_HOST,
      FLYTE_ADMIN_PORT: process.env.FLYTE_ADMIN_PORT,
      ENGINE_GRPC_HOST: process.env.ENGINE_GRPC_HOST,
      GRPC_SECURE: process.env.GRPC_SECURE,
    },
  };

  return NextResponse.json(debug);
}
