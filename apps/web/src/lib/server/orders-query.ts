import { UuidV7Schema } from '@mudra/shared';
import { z } from 'zod';
import { ApiProblemError } from './problem';

const OrdersQuerySchema = z
  .object({
    status: z.literal('OPEN').optional(),
    tableId: UuidV7Schema.optional(),
  })
  .strict();

export function parseOrdersQuery(url: URL): { tableId?: string } {
  const raw: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (Object.hasOwn(raw, key)) {
      throw ApiProblemError.validation([
        { path: key, code: 'duplicate_parameter', message: 'Parâmetro duplicado.' },
      ]);
    }
    raw[key] = value;
  }
  const parsed = OrdersQuerySchema.safeParse(raw);
  if (!parsed.success) {
    throw ApiProblemError.validation(
      parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        code: issue.code === 'unrecognized_keys' ? 'unrecognized_field' : issue.code,
        message: issue.path.includes('tableId')
          ? 'Identificador inválido.'
          : 'Parâmetro de consulta inválido.',
      })),
    );
  }
  return parsed.data.tableId === undefined ? {} : { tableId: parsed.data.tableId };
}
