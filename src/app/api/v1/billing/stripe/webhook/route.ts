// Stripe Webhook Handler
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';

import { logger } from '../../../../lib/utils/logger';
import { StripeBillingService } from '../../../../lib/services/stripe-billing-service';
import { createErrorResponse, createSuccessResponse } from '../../../../lib/utils/response';

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}`;

  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      logger.warn('Missing Stripe signature header', { requestId });
      return createErrorResponse(
        'VALIDATION_ERROR',
        { message: 'Missing Stripe signature' },
        requestId
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error('STRIPE_WEBHOOK_SECRET not configured', new Error('Configuration error'));
      return createErrorResponse(
        'INTERNAL_SERVER_ERROR',
        { message: 'Webhook secret not configured' },
        requestId
      );
    }

    // Verify webhook signature
    // eslint-disable-next-line global-require
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      logger.error('Webhook signature verification failed', err, { requestId });
      return createErrorResponse(
        'VALIDATION_ERROR',
        { message: `Webhook signature verification failed: ${err.message}` },
        requestId
      );
    }

    logger.info('Stripe webhook received', {
      type: event.type,
      eventId: event.id,
      requestId,
    });

    // Handle the event
    await StripeBillingService.handleWebhookEvent(event);

    return createSuccessResponse(
      {
        received: true,
        eventId: event.id,
      },
      200,
      requestId
    );
  } catch (error) {
    logger.error('Failed to process Stripe webhook', error as Error, { requestId });

    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      { message: 'Failed to process webhook' },
      requestId
    );
  }
}

// Disable body parsing for webhook
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
