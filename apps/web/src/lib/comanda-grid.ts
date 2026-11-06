import {
  comandaNumberAt,
  countComandaNumbers,
  mergeComandaNumberRanges,
  parseComandaNumbers,
} from '@/lib/comanda-numbers';
import type { Order } from './types';

export const COMANDA_PAGE_SIZE = 100;

export function buildComandaGrid({
  configuredNumbers,
  orders,
  page = 0,
  pageSize = COMANDA_PAGE_SIZE,
}: Readonly<{
  configuredNumbers: string;
  orders: readonly Order[];
  page?: number;
  pageSize?: number;
}>) {
  const configuredRanges = parseComandaNumbers(configuredNumbers);
  const occupiedNumbers = orders.flatMap((order) =>
    order.comandaNumber === null ? [] : [{ start: order.comandaNumber, end: order.comandaNumber }],
  );
  const displayedRanges = mergeComandaNumberRanges([...configuredRanges, ...occupiedNumbers]);
  const total = Number(countComandaNumbers(displayedRanges));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const numbers = Array.from(
    { length: Math.max(0, Math.min(pageSize, total - safePage * pageSize)) },
    (_, index) => comandaNumberAt(displayedRanges, BigInt(safePage * pageSize + index)),
  ).filter((number): number is number => number !== null);
  const ordersByNumber = new Map(
    orders.flatMap((order) =>
      order.comandaNumber === null ? [] : [[order.comandaNumber, order] as const],
    ),
  );

  return {
    numbers,
    total,
    page: safePage,
    pageCount,
    ordersByNumber,
  };
}
