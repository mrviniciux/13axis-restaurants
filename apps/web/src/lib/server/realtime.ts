import 'server-only';

import { createId } from '@mudra/shared';

type OrderChange = Readonly<{
  id: string;
  version: number;
}>;

type PaymentProcessed = Readonly<{
  orderId: string;
  orderVersion: number;
  amount: string;
  method: string;
}>;

async function publishRealtimeEvent(
  name: 'order:changed' | 'payment:processed',
  payload: Readonly<Record<string, unknown>>,
): Promise<void> {
  const secret = process.env.REALTIME_JWT_SECRET;
  if (!secret) {
    console.error('Realtime order event was not published.', {
      reason: 'REALTIME_JWT_SECRET is not configured for the web app.',
    });
    return;
  }

  const realtimeOrigin =
    process.env.REALTIME_INTERNAL_URL?.trim() ||
    `http://127.0.0.1:${process.env.SOCKET_IO_PORT?.trim() || '3001'}`;
  let endpoint: URL;
  try {
    endpoint = new URL('/internal/events', realtimeOrigin);
    if (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') {
      throw new Error('Unsupported realtime protocol');
    }
  } catch {
    console.error('Realtime order event was not published.', {
      reason: 'REALTIME_INTERNAL_URL is invalid.',
    });
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name, payload }),
      signal: AbortSignal.timeout(1_000),
      cache: 'no-store',
    });
    if (!response.ok) {
      console.error('Realtime order event was not published.', {
        reason: `Realtime service returned HTTP ${response.status}.`,
      });
    }
  } catch (error) {
    console.error('Realtime order event was not published.', {
      reason: error instanceof Error ? error.name : 'UnknownError',
    });
  }
}

export async function publishOrderChanged(
  restaurantId: string,
  order: OrderChange,
  mutationId?: string,
): Promise<void> {
  await publishRealtimeEvent('order:changed', {
    eventId: createId(),
    schemaVersion: 1,
    restaurantId,
    occurredAt: new Date().toISOString(),
    aggregate: { type: 'order', id: order.id, version: order.version },
    ...(mutationId ? { mutationId } : {}),
    data: { orderId: order.id },
  });
}

export async function publishPaymentProcessed(
  restaurantId: string,
  payment: PaymentProcessed,
): Promise<void> {
  await publishRealtimeEvent('payment:processed', {
    eventId: createId(),
    schemaVersion: 1,
    restaurantId,
    occurredAt: new Date().toISOString(),
    aggregate: { type: 'order', id: payment.orderId, version: payment.orderVersion },
    data: {
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method,
    },
  });
}
