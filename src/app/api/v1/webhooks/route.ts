/**
 * Webhooks Management API
 * Manage user webhooks
 */

import { NextRequest, NextResponse } from 'next/server';

import { requireSecureEngine } from '../../lib/services/engine-helper-rbac';
import {
  updateWebhook,
  deleteWebhook,
  registerWebhook,
  getUserWebhooks,
  getWebhookDeliveries,
  getDeliveryStatistics,
} from '../../lib/services/webhook-service';

/**
 * GET /api/v1/webhooks - Get user's webhooks
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'webhooks', action: 'read' }],
        },
      },
      {}
    );

    if (result instanceof NextResponse) {
      return result;
    }

    const { userId } = result;
    const { searchParams } = new URL(request.url);
    const webhookId = searchParams.get('id');

    if (webhookId) {
      // Get deliveries for specific webhook
      const deliveries = getWebhookDeliveries(webhookId, 100);
      const stats = getDeliveryStatistics(webhookId);

      return NextResponse.json({
        success: true,
        deliveries,
        statistics: stats,
      });
    }

    const webhooks = getUserWebhooks(userId);

    return NextResponse.json({
      success: true,
      webhooks,
      total: webhooks.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch webhooks',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/webhooks - Register a new webhook
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'webhooks', action: 'create' }],
        },
      },
      {}
    );

    if (result instanceof NextResponse) {
      return result;
    }

    const { userId } = result;
    const body = await request.json();

    const { url, events, metadata } = body;

    if (!url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        {
          success: false,
          error: 'url and events array are required',
        },
        { status: 400 }
      );
    }

    const webhook = await registerWebhook(userId, url, events, metadata);

    return NextResponse.json({
      success: true,
      webhook,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to register webhook',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/webhooks - Update a webhook
 */
export async function PATCH(request: NextRequest) {
  try {
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'webhooks', action: 'update' }],
        },
      },
      {}
    );

    if (result instanceof NextResponse) {
      return result;
    }

    const body = await request.json();
    const { id, url, events, active } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook ID is required',
        },
        { status: 400 }
      );
    }

    const webhook = await updateWebhook(id, { url, events, active });

    if (!webhook) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      webhook,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to update webhook',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/webhooks - Delete a webhook
 */
export async function DELETE(request: NextRequest) {
  try {
    const result = await requireSecureEngine(
      request,
      {
        rbac: {
          permissions: [{ resource: 'webhooks', action: 'delete' }],
        },
      },
      {}
    );

    if (result instanceof NextResponse) {
      return result;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook ID is required',
        },
        { status: 400 }
      );
    }

    const deleted = await deleteWebhook(id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Webhook not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted',
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to delete webhook',
      },
      { status: 500 }
    );
  }
}
