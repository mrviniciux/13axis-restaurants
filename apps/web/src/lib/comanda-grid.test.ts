import { describe, expect, it } from 'vitest';
import { buildComandaGrid } from './comanda-grid';
import type { Order } from './types';

function order(comandaNumber: number): Order {
  return {
    id: `order-${comandaNumber}`,
    comandaNumber,
    tableId: null,
    status: 'OPEN',
    total: '0.00',
    createdAt: '2026-01-01T12:00:00.000Z',
    items: [],
  };
}

describe('buildComandaGrid', () => {
  it('adds occupied comanda numbers that are missing from the configured list', () => {
    const grid = buildComandaGrid({
      configuredNumbers: '{1-3}',
      orders: [order(5), order(2)],
    });

    expect(grid.numbers).toEqual([1, 2, 3, 5]);
    expect(grid.total).toBe(4);
    expect(grid.page).toBe(0);
    expect(grid.ordersByNumber.get(5)?.id).toBe('order-5');
    expect(grid.ordersByNumber.has(4)).toBe(false);
  });

  it('paginates large configured lists', () => {
    const grid = buildComandaGrid({
      configuredNumbers: '{1-120}',
      orders: [order(105)],
      page: 1,
    });

    expect(grid.page).toBe(1);
    expect(grid.pageCount).toBe(2);
    expect(grid.numbers).toHaveLength(20);
    expect(grid.numbers[0]).toBe(101);
    expect(grid.numbers.at(-1)).toBe(120);
    expect(grid.ordersByNumber.get(105)?.id).toBe('order-105');
  });

  it('clamps an out-of-range page to the last available page', () => {
    const grid = buildComandaGrid({
      configuredNumbers: '{1-120}',
      orders: [],
      page: 99,
    });

    expect(grid.page).toBe(1);
    expect(grid.numbers[0]).toBe(101);
  });
});
