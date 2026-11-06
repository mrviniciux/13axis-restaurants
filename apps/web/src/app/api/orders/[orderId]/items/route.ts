import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { addItemToOpenOrder } from '@/lib/server/operations';
import { ApiProblemError, problemResponse } from '@/lib/server/problem';
import { publishOrderChanged } from '@/lib/server/realtime';

export const runtime = 'nodejs';

type RouteContext = Readonly<{ params: Promise<{ orderId: string }> }>;

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getAuthenticatedServerContext();
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

    const { orderId } = await params;
    const result = await addItemToOpenOrder(context, orderId, body);
    await publishOrderChanged(context.restaurantId, result.order, result.item.id);
    return Response.json(result, {
      status: result.replayed ? 200 : 201,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}
