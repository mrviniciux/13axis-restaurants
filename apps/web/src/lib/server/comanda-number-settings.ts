import 'server-only';

import type { PrismaClient } from '@mudra/database';
import { parseComandaNumbers } from '../comanda-numbers';
import { requireOperationalReadAccess, type AuthenticatedServerContext } from './access-control';
import { ApiProblemError } from './problem';
import { prisma } from './prisma';

export async function getRestaurantComandaNumbers(
  context: AuthenticatedServerContext,
  client: PrismaClient = prisma,
): Promise<string> {
  const principal = requireOperationalReadAccess(context);
  const restaurant = await client.restaurant.findFirst({
    where: { id: principal.restaurantId, deletedAt: null },
    select: { comandaNumbers: true },
  });
  if (!restaurant) throw new Error('Authenticated restaurant settings are unavailable.');
  parseComandaNumbers(restaurant.comandaNumbers);
  return restaurant.comandaNumbers;
}

export async function updateRestaurantComandaNumbers(
  context: AuthenticatedServerContext,
  value: unknown,
  client: PrismaClient = prisma,
): Promise<string> {
  const principal = requireOperationalReadAccess(context);
  if (typeof value !== 'string') {
    throw ApiProblemError.validation([
      {
        path: 'comandaNumbers',
        code: 'invalid_type',
        message: 'Informe os números de comanda como texto.',
      },
    ]);
  }
  try {
    parseComandaNumbers(value);
  } catch (error) {
    throw ApiProblemError.validation([
      {
        path: 'comandaNumbers',
        code: 'invalid_format',
        message:
          error instanceof Error ? error.message : 'Confira o formato da lista de comandas.',
      },
    ]);
  }

  const comandaNumbers = value.trim();
  const result = await client.restaurant.updateMany({
    where: { id: principal.restaurantId, deletedAt: null },
    data: { comandaNumbers },
  });
  if (result.count !== 1) {
    throw new ApiProblemError(
      401,
      'UNAUTHENTICATED',
      'Autenticação necessária',
      'É necessária uma sessão autenticada válida.',
    );
  }
  return comandaNumbers;
}
