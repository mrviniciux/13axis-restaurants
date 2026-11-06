import type { PrismaClient } from '@mudra/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getRestaurantComandaNumbers,
  updateRestaurantComandaNumbers,
} from './comanda-number-settings';

const principal = {
  userId: '0192f4a8-2c3d-7abc-8def-0123456789ab',
  restaurantId: '0192f4a8-2c3d-7abc-8def-0123456789ac',
  role: 'ADMIN' as const,
};

describe('restaurant comanda number settings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the shared restaurant number configuration', async () => {
    const client = {
      restaurant: { findFirst: vi.fn().mockResolvedValue({ comandaNumbers: '{20-110}' }) },
    } as unknown as PrismaClient;

    await expect(getRestaurantComandaNumbers(principal, client)).resolves.toBe('{20-110}');
    expect(client.restaurant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: principal.restaurantId, deletedAt: null },
        select: { comandaNumbers: true },
      }),
    );
  });

  it('validates and saves a shared configuration', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const client = { restaurant: { updateMany } } as unknown as PrismaClient;

    await expect(
      updateRestaurantComandaNumbers(principal, '[{1-30}, 50, 60, 90]', client),
    ).resolves.toBe('[{1-30}, 50, 60, 90]');
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: principal.restaurantId, deletedAt: null },
        data: { comandaNumbers: '[{1-30}, 50, 60, 90]' },
      }),
    );
  });

  it('rejects invalid numbers without writing settings', async () => {
    const updateMany = vi.fn();
    const client = { restaurant: { updateMany } } as unknown as PrismaClient;

    await expect(updateRestaurantComandaNumbers(principal, '{5-2}', client)).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_FAILED',
    });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
