import { Prisma, type PrismaClient } from '@mudra/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createMenuItem,
  createOpenOrder,
  deletePendingOrderItem,
  listTables,
  updatePendingOrderItem,
} from './operations';
import { ApiProblemError } from './problem';

const principal = {
  userId: '0192f4a8-2c3d-7abc-8def-0123456789ab',
  restaurantId: '0192f4a8-2c3d-7abc-8def-0123456789ac',
  role: 'ADMIN' as const,
};
const orderId = '0192f4a8-2c3d-7abc-8def-0123456789ad';
const itemId = '0192f4a8-2c3d-7abc-8def-0123456789ae';

function makeFixture({
  currentQuantity = '2',
  currentVersion = 1,
  currentStatus = null,
  unitPrice = '32.00',
  updatedQuantity = '2.5',
  updatedNotes = 'sem gelo',
  resultTotal = '80.00',
}: {
  currentQuantity?: string;
  currentVersion?: number;
  currentStatus?: 'SENT' | 'PREPARING' | 'READY' | 'SERVED' | null;
  unitPrice?: string;
  updatedQuantity?: string;
  updatedNotes?: string | null;
  resultTotal?: string;
} = {}) {
  const currentItem = {
    id: itemId,
    orderId,
    quantity: new Prisma.Decimal(currentQuantity),
    unitPrice: new Prisma.Decimal(unitPrice),
    notes: null,
    status: currentStatus,
    version: currentVersion,
  };
  const resultingItem = {
    ...currentItem,
    quantity: new Prisma.Decimal(updatedQuantity),
    notes: updatedNotes,
    status: null,
    version: currentVersion + 1,
    menuItem: { name: 'Suco natural' },
  };
  const resultingOrder = {
    id: orderId,
    comandaNumber: null,
    tableId: '0192f4a8-2c3d-7abc-8def-0123456789af',
    waiterId: null,
    total: new Prisma.Decimal(resultTotal),
    createdAt: new Date('2026-11-03T10:00:00.000Z'),
    updatedAt: new Date('2026-11-03T10:01:00.000Z'),
    version: 3,
    items: [resultingItem],
  };
  const tx = {
    user: { findFirst: vi.fn().mockResolvedValue({ role: 'ADMIN' }) },
    restaurant: { findFirst: vi.fn().mockResolvedValue({ id: principal.restaurantId }) },
    orderItem: {
      findFirst: vi.fn().mockResolvedValue(currentItem),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(resultingItem),
    },
    order: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn().mockResolvedValue(resultingOrder),
    },
  };
  const client = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  } as unknown as PrismaClient;
  return { client, tx };
}

describe('pending order item operations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates item quantity and notes using optimistic versioning and recalculates the total', async () => {
    const { client, tx } = makeFixture();
    const result = await updatePendingOrderItem(
      principal,
      orderId,
      itemId,
      { expectedVersion: 1, quantity: '2.5', notes: 'sem gelo' },
      client,
    );

    expect(result.item).toMatchObject({
      quantity: '2.5',
      lineTotal: '80.00',
      notes: 'sem gelo',
      version: 2,
    });

    expect(result.order.total).toBe('80.00');
    expect(tx.orderItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ version: 1, status: null }) }),
    );
    const totalChange = tx.order.updateMany.mock.calls[0][0].data.total;
    expect(totalChange).toEqual({ increment: new Prisma.Decimal('16.00') });
  });

  it('rejects stale versions without applying the mutation', async () => {
    const { client, tx } = makeFixture({ currentVersion: 2 });
    await expect(
      updatePendingOrderItem(
        principal,
        orderId,
        itemId,
        { expectedVersion: 1, quantity: '2.5' },
        client,
      ),
    ).rejects.toBeInstanceOf(ApiProblemError);
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it('does not allow items that have already been sent to the kitchen to be edited', async () => {
    const { client, tx } = makeFixture({ currentStatus: 'SENT' });
    await expect(
      updatePendingOrderItem(
        principal,
        orderId,
        itemId,
        { expectedVersion: 1, quantity: '2.5' },
        client,
      ),
    ).rejects.toMatchObject({ status: 409, code: 'ORDER_ITEM_CONFLICT' });
    expect(tx.orderItem.updateMany).not.toHaveBeenCalled();
  });

  it('soft-deletes a pending item and subtracts its exact subtotal', async () => {
    const fixture = makeFixture({
      currentQuantity: '1',
      unitPrice: '14.00',
      updatedQuantity: '1',
      updatedNotes: null,
      resultTotal: '0.00',
    });
    fixture.tx.orderItem.updateMany.mockResolvedValue({ count: 1 });
    fixture.tx.order.findFirst.mockResolvedValue({
      id: orderId,
      comandaNumber: null,
      tableId: '0192f4a8-2c3d-7abc-8def-0123456789af',
      waiterId: null,
      total: new Prisma.Decimal('0.00'),
      createdAt: new Date('2026-11-03T10:00:00.000Z'),
      updatedAt: new Date('2026-11-03T10:01:00.000Z'),
      version: 3,
      items: [],
    });

    const result = await deletePendingOrderItem(
      principal,
      orderId,
      itemId,
      { expectedVersion: 1 },
      fixture.client,
    );

    expect(result.order.total).toBe('0.00');
    expect(fixture.tx.orderItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ version: 1, status: null }),
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
    const totalChange = fixture.tx.order.updateMany.mock.calls[0][0].data.total;
    expect(totalChange).toEqual({ decrement: new Prisma.Decimal('14.00') });
  });
});

describe('createOpenOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an independent command without looking up or changing a table', async () => {
    const createdOrder = {
      id: orderId,
      restaurantId: principal.restaurantId,
      comandaNumber: 20,
      tableId: null,
      waiterId: null,
      status: 'OPEN',
      total: new Prisma.Decimal('0.00'),
      createdAt: new Date('2026-11-03T10:00:00.000Z'),
      updatedAt: new Date('2026-11-03T10:00:00.000Z'),
      version: 1,
      deviceId: null,
      deletedAt: null,
    };
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ role: 'ADMIN' }) },
      restaurant: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: principal.restaurantId })
          .mockResolvedValueOnce({ comandaNumbers: '{20-110}' }),
      },
      table: { findFirst: vi.fn(), updateMany: vi.fn() },
      order: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(createdOrder),
      },
    };
    const client = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaClient;

    const result = await createOpenOrder(principal, { id: orderId, comandaNumber: 20 }, client);

    expect(result.order).toMatchObject({
      id: orderId,
      comandaNumber: 20,
      tableId: null,
      status: 'OPEN',
    });

    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ comandaNumber: 20, tableId: null }),
      }),
    );
    expect(tx.table.findFirst).not.toHaveBeenCalled();
    expect(tx.table.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a comanda number already assigned to another open order', async () => {
    const duplicateNumber = new Prisma.PrismaClientKnownRequestError('Duplicate number', {
      code: 'P2002',
      clientVersion: '6.19.3',
      meta: { target: ['restaurantId', 'comandaNumber'] },
    });
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ role: 'ADMIN' }) },
      restaurant: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: principal.restaurantId })
          .mockResolvedValueOnce({ comandaNumbers: '{20-110}' }),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(duplicateNumber),
      },
    };
    const client = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      order: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue({ id: '0192f4a8-2c3d-7abc-8def-0123456789af' }),
      },
    } as unknown as PrismaClient;

    await expect(
      createOpenOrder(principal, { id: orderId, comandaNumber: 20 }, client),
    ).rejects.toMatchObject({ status: 409, code: 'COMANDA_NUMBER_TAKEN' });
  });

  it('does not allow opening numbers outside the restaurant configuration', async () => {
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ role: 'ADMIN' }) },
      restaurant: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: principal.restaurantId })
          .mockResolvedValueOnce({ comandaNumbers: '{20-110}' }),
      },
      order: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };
    const client = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaClient;

    await expect(
      createOpenOrder(principal, { id: orderId, comandaNumber: 7 }, client),
    ).rejects.toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});

describe('createMenuItem', () => {
  it('does not allow managers to register products even when MENU_MANAGE is granted', async () => {
    await expect(
      createMenuItem(
        { ...principal, role: 'MANAGER' },
        { name: 'Buffet Livre', category: 'Buffet', price: '64,90' },
      ),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});

describe('listTables', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not fetch linked commands when the selected view only needs tables', async () => {
    const tx = {
      user: { findFirst: vi.fn().mockResolvedValue({ role: 'ADMIN' }) },
      restaurant: { findFirst: vi.fn().mockResolvedValue({ id: principal.restaurantId }) },
      table: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: '0192f4a8-2c3d-7abc-8def-0123456789af',
            number: 1,
            capacity: 4,
            status: 'FREE',
            version: 1,
            updatedAt: new Date('2026-11-03T10:00:00.000Z'),
          },
        ]),
      },
    };
    const client = {
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    } as unknown as PrismaClient;

    const tables = await listTables(principal, { includeOpenOrders: false }, client);

    expect(tables).toMatchObject([{ status: 'FREE', openOrders: [] }]);
    expect(tx.table.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ orders: expect.anything() }),
      }),
    );
  });
});
