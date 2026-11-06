import 'server-only';

import { RoleSchema } from '@mudra/shared';
import { auth } from '../../auth';
import { prisma } from './prisma';
import { ApiProblemError } from './problem';
import { requireAuthenticatedContext, type AuthenticatedServerContext } from './access-control';

export {
  requireAuthenticatedContext,
  requirePermission,
  requireOperationalReadAccess,
} from './access-control';
export type { AuthenticatedServerContext } from './access-control';

/**
 * Resolve the principal only from the signed server session and current
 * database record. This rejects missing/invalid sessions, stale role/tenant
 * claims, soft-deleted users, and soft-deleted restaurants.
 */
export async function getAuthenticatedServerContext(): Promise<AuthenticatedServerContext> {
  const session = await auth();
  const claim = requireAuthenticatedContext({
    userId: session?.user?.id,
    restaurantId: session?.user?.restaurantId,
    role: session?.user?.role,
  });

  const user = await prisma.user.findFirst({
    where: {
      id: claim.userId,
      restaurantId: claim.restaurantId,
      deletedAt: null,
      restaurant: { deletedAt: null },
    },
    select: { id: true, restaurantId: true, role: true },
  });
  if (!user) {
    throw new ApiProblemError(
      401,
      'UNAUTHENTICATED',
      'Autenticação necessária',
      'É necessária uma sessão autenticada válida.',
    );
  }

  return {
    userId: user.id,
    restaurantId: user.restaurantId,
    role: RoleSchema.parse(user.role),
  };
}
