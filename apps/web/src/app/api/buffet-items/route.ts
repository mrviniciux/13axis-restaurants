import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { createBuffetItem } from '@/lib/server/operations';
import { ApiProblemError, problemResponse } from '@/lib/server/problem';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
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

    const item = await createBuffetItem(context, body);
    return Response.json(item, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}
