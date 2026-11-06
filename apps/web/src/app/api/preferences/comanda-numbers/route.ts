import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { updateRestaurantComandaNumbers } from '@/lib/server/comanda-number-settings';
import { ApiProblemError, problemResponse } from '@/lib/server/problem';

export const runtime = 'nodejs';

export async function PATCH(request: Request): Promise<Response> {
  try {
    const context = await getAuthenticatedServerContext();
    if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
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

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      throw ApiProblemError.validation([
        {
          path: '',
          code: 'invalid_type',
          message: 'O corpo deve ser um objeto JSON.',
        },
      ]);
    }
    if (Object.keys(body).some((key) => key !== 'comandaNumbers')) {
      throw ApiProblemError.validation([
        {
          path: '',
          code: 'unrecognized_field',
          message: 'A solicitação contém campos não permitidos.',
        },
      ]);
    }
    const result = await updateRestaurantComandaNumbers(
      context,
      (body as Record<string, unknown>).comandaNumbers,
    );
    return Response.json(
      { comandaNumbers: result },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}
