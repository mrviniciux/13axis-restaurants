import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { listOrders, createOpenOrder } from '@/lib/server/operations';
import { parseCreateOrderInput } from '@/lib/server/order-input';
import { parseOrdersQuery } from '@/lib/server/orders-query';
import { ApiProblemError, problemResponse } from '@/lib/server/problem';
import { publishOrderChanged } from '@/lib/server/realtime';

export const runtime = 'nodejs';

function isJsonRequest(request: Request): boolean {
  return (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'application/json'
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await getAuthenticatedServerContext();
    const query = parseOrdersQuery(new URL(request.url));
    const orders = await listOrders(context, query);
    return Response.json({ orders }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const context = await getAuthenticatedServerContext();
    if (!isJsonRequest(request)) {
      throw new ApiProblemError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Tipo de conteúdo não aceito',
        'Envie o corpo como application/json.',
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiProblemError(
        400,
        'INVALID_JSON',
        'JSON inválido',
        'O corpo da solicitação não contém JSON válido.',
      );
    }

    // Validate before entering the domain service so malformed input is
    // reported consistently; the service validates again at its boundary.
    parseCreateOrderInput(body);
    const result = await createOpenOrder(context, body);
    await publishOrderChanged(context.restaurantId, result.order, result.order.id);
    return Response.json(result.order, {
      status: result.replayed ? 200 : 201,
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}
