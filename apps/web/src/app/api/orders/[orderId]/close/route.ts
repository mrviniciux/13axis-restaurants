import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { closeOrder } from '@/lib/server/operations';
import { ApiProblemError, problemResponse } from '@/lib/server/problem';
import { publishOrderChanged } from '@/lib/server/realtime';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }): Promise<Response> {
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

    const { orderId } = await params;
    const result = await closeOrder(context, orderId);
    await publishOrderChanged(context.restaurantId, result, orderId);
    return Response.json(result, {
      status: 200,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}