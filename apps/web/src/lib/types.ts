import type { TablesComandasTab } from '@/components/tables-comandas-tabs';
import type { TablesComandasView } from '@/lib/server/tables-comandas-view';

export type Table = Readonly<{
  id: string;
  number: number;
  capacity: number;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLOSING';
  openOrders: readonly { id: string; createdAt: string }[];
}>;

export type OrderItem = Readonly<{
  id: string;
  menuItemId: string;
  name: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  notes: string | null;
  status: string | null;
  version: number;
}>;

export type Order = Readonly<{
  id: string;
  comandaNumber: number | null;
  tableId: string | null;
  status: 'OPEN';
  total: string;
  createdAt: string;
  items: readonly OrderItem[];
}>;

export type MenuItem = Readonly<{
  id: string;
  name: string;
  category: string;
  price: string;
}>;

export type ActionState = Readonly<{
  id: string;
  status: 'pending' | 'error' | 'created' | 'replayed';
  message: string;
  payload?: Readonly<{ menuItemId: string; quantity: string; notes: string }>;
}>;

export const PAYMENT_METHODS = ['dinheiro', 'cartão Crédito', 'cartão Débito', 'PIX'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type ItemDraft = Readonly<{ quantity: string; notes: string }>;

export type PreferenceStatus = 'idle' | 'saving' | 'saved' | 'error';
export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting';
export type ProductCreateTarget = 'card' | 'detail';

export type OrdersTablesStoreInitial = Readonly<{
  view: TablesComandasView;
  comandaNumbers: string;
  menuItems: readonly MenuItem[];
}>;

export type OrdersTablesTab = TablesComandasTab;

export const tableStatus: Record<Table['status'], string> = {
  FREE: 'Livre',
  OCCUPIED: 'Ocupada',
  RESERVED: 'Reservada',
  CLOSING: 'Em fechamento',
};

export const itemStatus: Record<string, string> = {
  SENT: 'Enviado',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  SERVED: 'Servido',
};
