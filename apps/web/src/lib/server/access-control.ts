import { hasPermission, RoleSchema, UuidV7Schema, type Permission, type Role } from '@mudra/shared';
import { ApiProblemError } from './problem';

/** Server-trusted principal; callers must derive it from a verified session. */
export type AuthenticatedServerContext = Readonly<{
  userId: string;
  restaurantId: string;
  role: Role;
}>;

export function requireAuthenticatedContext(context: unknown): AuthenticatedServerContext {
  if (context === null || typeof context !== 'object' || Array.isArray(context)) {
    throw new ApiProblemError(
      401,
      'UNAUTHENTICATED',
      'Autenticação necessária',
      'É necessária uma sessão autenticada válida.',
    );
  }

  const candidate = context as Record<string, unknown>;
  const userId = UuidV7Schema.safeParse(candidate.userId);
  const restaurantId = UuidV7Schema.safeParse(candidate.restaurantId);
  const role = RoleSchema.safeParse(candidate.role);
  if (!userId.success || !restaurantId.success || !role.success) {
    throw new ApiProblemError(
      401,
      'UNAUTHENTICATED',
      'Autenticação necessária',
      'É necessária uma sessão autenticada válida.',
    );
  }

  return { userId: userId.data, restaurantId: restaurantId.data, role: role.data };
}

export function requirePermission(
  context: unknown,
  permission: Permission,
): AuthenticatedServerContext {
  const authenticated = requireAuthenticatedContext(context);
  if (!hasPermission(authenticated.role, permission)) {
    throw new ApiProblemError(
      403,
      'FORBIDDEN',
      'Acesso negado',
      'O perfil autenticado não tem permissão para esta ação.',
    );
  }
  return authenticated;
}

/** Operational table/order list access remains ADMIN/WAITER only. */
export function requireOperationalReadAccess(context: unknown): AuthenticatedServerContext {
  const authenticated = requireAuthenticatedContext(context);
  if (authenticated.role !== 'ADMIN' && authenticated.role !== 'WAITER') {
    throw new ApiProblemError(
      403,
      'FORBIDDEN',
      'Acesso negado',
      'O perfil autenticado não tem permissão para esta consulta.',
    );
  }
  return authenticated;
}
