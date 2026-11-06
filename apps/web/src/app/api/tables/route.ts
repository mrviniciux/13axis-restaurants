import { getAuthenticatedServerContext } from '@/lib/server/auth';
import { listTables } from '@/lib/server/operations';
import { parseTablesQuery } from '@/lib/server/tables-query';
import { problemResponse } from '@/lib/server/problem';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const context = await getAuthenticatedServerContext();
    const tables = await listTables(context, parseTablesQuery(url));
    return Response.json({ tables }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return problemResponse(error, new URL(request.url).pathname);
  }
}
