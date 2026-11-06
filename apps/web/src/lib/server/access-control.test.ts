import { describe, expect, it } from 'vitest';
import {
  requireAuthenticatedContext,
  requireOperationalReadAccess,
  requirePermission,
} from './access-control';
import { ApiProblemError } from './problem';

const principal = {
  userId: '0192f4a8-2c3d-7abc-8def-0123456789ab',
  restaurantId: '0192f4a8-2c3d-7abc-8def-0123456789ac',
};

describe('server access control', () => {
  it('denies missing and malformed authentication contexts', () => {
    expect(() => requireAuthenticatedContext(null)).toThrow(ApiProblemError);
    try {
      requireAuthenticatedContext(null);
    } catch (error) {
      expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    }
    expect(() =>
      requireAuthenticatedContext({ ...principal, role: 'WAITER', userId: 'not-an-id' }),
    ).toThrow(ApiProblemError);
  });

  it('accepts only ADMIN and WAITER for operational reads', () => {
    expect(requireOperationalReadAccess({ ...principal, role: 'WAITER' }).role).toBe('WAITER');
    expect(() => requireOperationalReadAccess({ ...principal, role: 'KITCHEN' })).toThrow(
      ApiProblemError,
    );
    expect(() => requireOperationalReadAccess({ ...principal, role: 'SCALE' })).toThrow(
      ApiProblemError,
    );
  });

  it('grants create permission only to roles allowed by shared RBAC', () => {
    expect(requirePermission({ ...principal, role: 'ADMIN' }, 'ORDERS_CREATE').role).toBe('ADMIN');
    expect(requirePermission({ ...principal, role: 'WAITER' }, 'ORDERS_CREATE').role).toBe(
      'WAITER',
    );
    expect(() => requirePermission({ ...principal, role: 'CASHIER' }, 'ORDERS_CREATE')).toThrow(
      ApiProblemError,
    );
    try {
      requirePermission({ ...principal, role: 'CASHIER' }, 'ORDERS_CREATE');
    } catch (error) {
      expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' });
    }
  });
});
