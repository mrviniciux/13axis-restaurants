'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import {
  createOrdersTablesStore,
  type OrdersTablesStore,
  type OrdersTablesStoreApi,
} from './orders-tables-store';
import type { MenuItem } from '../lib/types';
import type { TablesComandasView } from '@/lib/server/tables-comandas-view';

const OrdersTablesStoreContext = createContext<OrdersTablesStoreApi | null>(null);

export function OrdersTablesProvider({
  initialView,
  initialComandaNumbers,
  initialMenuItems,
  children,
}: Readonly<{
  initialView: TablesComandasView;
  initialComandaNumbers: string;
  initialMenuItems: readonly MenuItem[];
  children: ReactNode;
}>) {
  const [store] = useState(() =>
    createOrdersTablesStore({
      view: initialView,
      comandaNumbers: initialComandaNumbers,
      menuItems: initialMenuItems,
    }),
  );

  useEffect(() => {
    store.getState().actions.syncMenuItems(initialMenuItems);
  }, [initialMenuItems, store]);

  return (
    <OrdersTablesStoreContext.Provider value={store}>{children}</OrdersTablesStoreContext.Provider>
  );
}

export function useOrdersTablesStoreApi() {
  const store = useContext(OrdersTablesStoreContext);
  if (!store) throw new Error('useOrdersTablesStoreApi must be used inside OrdersTablesProvider');
  return store;
}

export function useOrdersTables<T>(selector: (state: OrdersTablesStore) => T): T {
  return useStore(useOrdersTablesStoreApi(), useShallow(selector));
}

export function useOrdersTablesActions() {
  return useOrdersTables((state) => state.actions);
}
