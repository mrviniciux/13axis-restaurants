import { getAuthenticatedServerContext } from '@/lib/server/auth';
import {
  deletePendingOrderItem,
  updatePendingOrderItem,
} from '@/lib/server/operations';
import { ApiProblemError, problemResponse } from '@/lib/server/problem';
import { publishOrderChanged } from '@/lib/server/realtime';

export const runtime = 'nodejs';

type RouteContext = Readonly<{
  params: Promise<{ orderId: string; itemId: string }>;
}>;

async function readJsonBody(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !==
    'application/json'
  ) {
    throw new ApiProblemError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Tipo de conteúdo não aceito',
      'Envie o corpo como application/json.',
    );
  }
  try {
    return await request.json();
  } catch {
    throw new ApiProblemError(
      400,
      'INVALID_JSON',
      'JSON inválido',
      'O corpo da solicitação não contém JSON válido.',
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getAuthenticatedServerContext();
    const body = await readJsonBody(request);
    const { orderId, itemId } = await params;
    const result = await updatePendingOrderItem(context, orderId, itemId, body);
    await publishOrderChanged(context.restaurantId, result.order, itemId);
    return Response.json(result, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}

export async function DELETE(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getAuthenticatedServerContext();
    const body = await readJsonBody(request);
    const { orderId, itemId } = await params;
    const result = await deletePendingOrderItem(context, orderId, itemId, body);
    await publishOrderChanged(context.restaurantId, result.order, itemId);
    return Response.json(result, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}
