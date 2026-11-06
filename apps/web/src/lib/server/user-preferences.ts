import 'server-only';

import type { TablesComandasView } from './tables-comandas-view';
import { prisma } from './prisma';
import type { AuthenticatedServerContext } from './access-control';

export async function getTablesComandasViewPreference(
  context: AuthenticatedServerContext,
): Promise<TablesComandasView> {
  const user = await prisma.user.findFirst({
    where: {
      id: context.userId,
      restaurantId: context.restaurantId,
      deletedAt: null,
    },
    select: { tablesComandasView: true },
  });

  if (!user) {
    throw new Error('Authenticated user preferences are unavailable.');
  }

  return user.tablesComandasView;
}
