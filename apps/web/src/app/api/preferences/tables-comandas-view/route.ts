import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { prisma } from '@/lib/server/prisma';
import { problemResponse, ApiProblemError } from '@/lib/server/problem';
import { parseTablesComandasView } from '@/lib/server/tables-comandas-view';

export const runtime = 'nodejs';

function isJsonRequest(request: Request): boolean {
  return (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() === 'application/json'
  );
}

export async function PATCH(request: Request): Promise<Response> {
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

    const view = parseTablesComandasView(body);
    const result = await prisma.user.updateMany({
      where: {
        id: context.userId,
        restaurantId: context.restaurantId,
        deletedAt: null,
      },
      data: { tablesComandasView: view },
    });

    if (result.count !== 1) {
      throw new ApiProblemError(
        401,
        'UNAUTHENTICATED',
        'Autenticação necessária',
        'É necessária uma sessão autenticada válida.',
      );
    }

    return Response.json({ view }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}
