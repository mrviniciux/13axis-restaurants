import type { Order } from './types';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatMoney(value: string) {
  return formatCurrency(Number(value));
}

export function getOrderDisplayName(
  order: Pick<Order, 'comandaNumber' | 'tableId'>,
  tableNumbers: ReadonlyMap<string, number>,
) {
  if (order.comandaNumber !== null) return `Comanda ${order.comandaNumber}`;
  const tableNumber = order.tableId ? tableNumbers.get(order.tableId) : undefined;
  return tableNumber !== undefined ? `Mesa ${String(tableNumber).padStart(2, '0')}` : 'Comanda';
}

export function getTableDisplayName(
  table: Pick<Order, 'tableId'>,
  tableNumbers: ReadonlyMap<string, number>,
) {
  if (!table.tableId) return 'Sem mesa';
  const tableNumber = tableNumbers.get(table.tableId);
  return tableNumber !== undefined ? `Mesa ${String(tableNumber).padStart(2, '0')}` : 'Sem mesa';
}
