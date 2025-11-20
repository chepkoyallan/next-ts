/**
 * Webhook Service
 * Manage and deliver webhooks with retry logic
 */

import crypto from 'crypto';

export interface Webhook {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  maxAttempts: number;
  response?: {
    statusCode: number;
    body: string;
  };
  error?: string;
  createdAt: Date;
  deliveredAt?: Date;
}

const webhooks = new Map<string, Webhook>();
const deliveries = new Map<string, WebhookDelivery>();

/**
 * Register a new webhook
 */
export async function registerWebhook(
  userId: string,
  url: string,
  events: string[],
  metadata?: Record<string, any>
): Promise<Webhook> {
  const webhook: Webhook = {
    id: generateWebhookId(),
    userId,
    url,
    events,
    secret: generateWebhookSecret(),
    active: true,
    createdAt: new Date(),
    metadata,
  };

  webhooks.set(webhook.id, webhook);

  console.log(`✅ Webhook registered: ${webhook.url} for events: ${events.join(', ')}`);

  return webhook;
}

/**
 * Get webhooks for user
 */
export function getUserWebhooks(userId: string): Webhook[] {
  return Array.from(webhooks.values()).filter((w) => w.userId === userId);
}

/**
 * Get webhook by ID
 */
export function getWebhook(webhookId: string): Webhook | undefined {
  return webhooks.get(webhookId);
}

/**
 * Update webhook
 */
export async function updateWebhook(
  webhookId: string,
  updates: Partial<Pick<Webhook, 'url' | 'events' | 'active'>>
): Promise<Webhook | null> {
  const webhook = webhooks.get(webhookId);
  if (!webhook) return null;

  Object.assign(webhook, updates);
  webhooks.set(webhookId, webhook);

  return webhook;
}

/**
 * Delete webhook
 */
export async function deleteWebhook(webhookId: string): Promise<boolean> {
  return webhooks.delete(webhookId);
}

/**
 * Trigger webhook event
 */
export async function triggerWebhookEvent(
  event: string,
  payload: any,
  userId?: string
): Promise<void> {
  const matchingWebhooks = Array.from(webhooks.values()).filter(
    (w) => w.active && w.events.includes(event) && (!userId || w.userId === userId)
  );

  console.log(`🔔 Triggering webhook event: ${event} (${matchingWebhooks.length} webhooks)`);

  // Deliver webhooks in parallel instead of sequential loop
  await Promise.all(matchingWebhooks.map((webhook) => deliverWebhook(webhook, event, payload)));
}

/**
 * Deliver webhook
 */
async function deliverWebhook(webhook: Webhook, event: string, payload: any): Promise<void> {
  const delivery: WebhookDelivery = {
    id: generateDeliveryId(),
    webhookId: webhook.id,
    event,
    payload,
    status: 'pending',
    attempts: 0,
    maxAttempts: 5,
    createdAt: new Date(),
  };

  deliveries.set(delivery.id, delivery);

  attemptDelivery(delivery, webhook);
}

/**
 * Attempt webhook delivery
 */
async function attemptDelivery(delivery: WebhookDelivery, webhook: Webhook): Promise<void> {
  delivery.attempts += 1;

  try {
    const signature = generateSignature(webhook.secret, delivery.payload);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': delivery.event,
        'X-Webhook-Delivery': delivery.id,
        'User-Agent': 'Webhook-Service/1.0',
      },
      body: JSON.stringify({
        event: delivery.event,
        payload: delivery.payload,
        timestamp: new Date().toISOString(),
      }),
    });

    delivery.response = {
      statusCode: response.status,
      body: await response.text(),
    };

    if (response.ok) {
      delivery.status = 'success';
      delivery.deliveredAt = new Date();
      console.log(`✅ Webhook delivered: ${webhook.url} (${delivery.event})`);
    } else {
      throw new Error(`HTTP ${response.status}: ${delivery.response.body}`);
    }
  } catch (error: any) {
    delivery.error = error.message;
    console.error(`❌ Webhook delivery failed: ${webhook.url} - ${error.message}`);

    if (delivery.attempts < delivery.maxAttempts) {
      // Retry with exponential backoff
      const delay = Math.min(1000 * 2 ** (delivery.attempts - 1), 60000);
      setTimeout(() => attemptDelivery(delivery, webhook), delay);
    } else {
      delivery.status = 'failed';
    }
  }
}

/**
 * Generate webhook signature for verification
 */
export function generateSignature(secret: string, payload: any): string {
  const payloadString = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

/**
 * Verify webhook signature
 */
export function verifySignature(secret: string, payload: any, signature: string): boolean {
  const expectedSignature = generateSignature(secret, payload);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

/**
 * Get webhook deliveries
 */
export function getWebhookDeliveries(webhookId: string, limit: number = 50): WebhookDelivery[] {
  return Array.from(deliveries.values())
    .filter((d) => d.webhookId === webhookId)
    .slice(-limit)
    .reverse();
}

/**
 * Get delivery statistics
 */
export function getDeliveryStatistics(webhookId?: string): {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  successRate: number;
} {
  let relevantDeliveries = Array.from(deliveries.values());

  if (webhookId) {
    relevantDeliveries = relevantDeliveries.filter((d) => d.webhookId === webhookId);
  }

  const successful = relevantDeliveries.filter((d) => d.status === 'success').length;
  const failed = relevantDeliveries.filter((d) => d.status === 'failed').length;
  const pending = relevantDeliveries.filter((d) => d.status === 'pending').length;

  return {
    total: relevantDeliveries.length,
    successful,
    failed,
    pending,
    successRate: relevantDeliveries.length > 0 ? successful / relevantDeliveries.length : 0,
  };
}

/**
 * Generate unique webhook ID
 */
function generateWebhookId(): string {
  return `whk_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generate unique delivery ID
 */
function generateDeliveryId(): string {
  return `del_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generate webhook secret
 */
function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Clean up old deliveries
 */
export function cleanupOldDeliveries(olderThan?: Date): void {
  const cutoff = olderThan || new Date(Date.now() - 7 * 24 * 3600000); // 7 days ago

  // Use array iteration instead of for...of
  Array.from(deliveries.entries()).forEach(([id, delivery]) => {
    if (delivery.createdAt < cutoff) {
      deliveries.delete(id);
    }
  });
}

// Start periodic cleanup
setInterval(() => {
  cleanupOldDeliveries();
}, 3600000); // Clean up every hour
