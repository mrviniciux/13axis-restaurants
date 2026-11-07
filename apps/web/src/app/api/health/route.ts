export const runtime = 'nodejs';

/**
 * Health check leve para o proxy/orquestrador.
 *
 * Sem autenticação e sem expor detalhes internos (versão, banco, segredos);
 * apenas confirma que o processo está vivo e respondendo.
 */
export async function GET(): Promise<Response> {
  return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
}
