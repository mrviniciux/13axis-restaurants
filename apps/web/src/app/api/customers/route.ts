import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { createCustomer, listCustomers } from '@/lib/server/operations';
import { ApiProblemError, problemResponse } from '@/lib/server/problem';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    const context = await getAuthenticatedServerContext();
    const url = new URL(request.url);
    const search = url.searchParams.get('search') ?? undefined;
    const customers = await listCustomers(context, { search });
    return Response.json({ customers }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}

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
    const customer = await createCustomer(context, body);
    return Response.json(customer, { status: 201, headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}
