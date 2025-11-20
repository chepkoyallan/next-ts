import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';

import { getOpenStackClient } from 'src/app/api/lib/services/bmaas/openstack-client';
import {
  createErrorEnvelope,
  createSuccessEnvelope,
} from 'src/app/api/lib/middleware/transformation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/bmaas/instances/:id/console
 * Get console output and VNC URL for an instance
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const requestId = uuidv4();

  try {
    // Get OpenStack ID from query parameter (passed from frontend)
    const { searchParams } = new URL(request.url);
    const openstackId = searchParams.get('openstackId');

    if (!openstackId) {
      return NextResponse.json(
        createErrorEnvelope('OpenStack ID is required', requestId, 'MISSING_PARAMETER'),
        { status: 400 }
      );
    }

    const client = getOpenStackClient();
    await client.authenticate();
    const computeEndpoint = await client.getEndpoint('compute');

    // Get console output (last 100 lines)
    let consoleOutput = null;
    try {
      const consoleResponse = await client.request({
        method: 'POST',
        url: `${computeEndpoint}/servers/${openstackId}/action`,
        data: {
          'os-getConsoleOutput': {
            length: 100,
          },
        },
      });

      consoleOutput = consoleResponse.output || null;
    } catch (err: any) {
      console.error('Failed to get console output:', err.message);
      // Don't fail the whole request if console output fails
    }

    // Get VNC console URL
    let vncUrl = null;
    try {
      const vncResponse = await client.request({
        method: 'POST',
        url: `${computeEndpoint}/servers/${openstackId}/action`,
        data: {
          'os-getVNCConsole': {
            type: 'novnc',
          },
        },
      });

      vncUrl = vncResponse.console?.url || null;
    } catch (err: any) {
      console.error('Failed to get VNC console:', err.message);
      // VNC might not be available, that's okay
    }

    // Try serial console as alternative
    let serialUrl = null;
    if (!vncUrl) {
      try {
        const serialResponse = await client.request({
          method: 'POST',
          url: `${computeEndpoint}/servers/${openstackId}/action`,
          data: {
            'os-getSerialConsole': {
              type: 'serial',
            },
          },
        });

        serialUrl = serialResponse.console?.url || null;
      } catch (err: any) {
        console.error('Failed to get serial console:', err.message);
      }
    }

    // Determine console type
    let consoleType = 'none';
    if (vncUrl) {
      consoleType = 'vnc';
    } else if (serialUrl) {
      consoleType = 'serial';
    }

    return NextResponse.json(
      createSuccessEnvelope(
        {
          consoleOutput,
          vncUrl,
          serialUrl,
          consoleType,
        },
        requestId
      )
    );
  } catch (error: any) {
    console.error('Error getting console:', error);

    return NextResponse.json(
      createErrorEnvelope(error.message || 'Failed to get console', requestId, 'CONSOLE_ERROR'),
      { status: error.response?.status || 500 }
    );
  }
}
