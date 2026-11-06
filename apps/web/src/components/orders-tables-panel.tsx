'use client';

import { Settings2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import {
  ComandasPanel,
  OrderSummaryDialog,
  OrdersTablesProvider,
  PropertiesPanel,
  TablesPanel,
  useOrdersTables,
  useOrdersTablesActions,
  useOrdersTablesRealtime,
  type MenuItem,
  type Order,
  type Table,
} from './orders-tables';
import type { TablesComandasView } from '@/lib/server/tables-comandas-view';

export function OrdersTablesPanel({
  initialTables,
  initialOrders,
  initialMenuItems,
  initialError,
  initialView,
  initialComandaNumbers,
  canManageMenu,
  canCloseOrders,
  canReceivePayments,
  userId,
}: Readonly<{
  initialTables: readonly Table[];
  initialOrders: readonly Order[];
  initialMenuItems: readonly MenuItem[];
  initialError: boolean;
  initialView: TablesComandasView;
  initialComandaNumbers: string;
  canManageMenu: boolean;
  canCloseOrders: boolean;
  canReceivePayments: boolean;
  userId: string;
}>) {
  return (
    <OrdersTablesProvider
      initialComandaNumbers={initialComandaNumbers}
      initialMenuItems={initialMenuItems}
      initialView={initialView}
    >
      <OrdersTablesPanelContent
        canCloseOrders={canCloseOrders}
        canManageMenu={canManageMenu}
        canReceivePayments={canReceivePayments}
        initialError={initialError}
        initialOrders={initialOrders}
        initialTables={initialTables}
        userId={userId}
      />
    </OrdersTablesProvider>
  );
}

function OrdersTablesPanelContent({
  initialTables,
  initialOrders,
  initialError,
  canManageMenu,
  canCloseOrders,
  canReceivePayments,
  userId,
}: Readonly<{
  initialTables: readonly Table[];
  initialOrders: readonly Order[];
  initialError: boolean;
  canManageMenu: boolean;
  canCloseOrders: boolean;
  canReceivePayments: boolean;
  userId: string;
}>) {
  const { view, propertiesOpen, realtimeStatus, dialogOrderId, focusOrderId } = useOrdersTables(
    (state) => ({
      view: state.view,
      propertiesOpen: state.propertiesOpen,
      realtimeStatus: state.realtimeStatus,
      dialogOrderId: state.dialogOrderId,
      focusOrderId: state.focusOrderId,
    }),
  );
  const actions = useOrdersTablesActions();
  useOrdersTablesRealtime(!initialError);
  const tableNumbers = useMemo(
    () => new Map(initialTables.map((table) => [table.id, table.number])),
    [initialTables],
  );
  const dialogOrder = initialOrders.find((order) => order.id === dialogOrderId) ?? null;

  useEffect(() => {
    if (!focusOrderId) return;
    const orderCard = document.getElementById(`order-card-${focusOrderId}`);
    if (!orderCard) return;
    orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    actions.clearOrderFocus();
  }, [actions, focusOrderId, initialOrders]);

  return (
    <>
      <header className="page-heading tables-page-heading">
        <div>
          <h1>Gestão de Mesas/Comandas</h1>
          <p
            aria-live="polite"
            className={`realtime-status${realtimeStatus === 'connected' ? ' is-connected' : ''}`}
          >
            {realtimeStatus === 'connected'
              ? 'Atualizações em tempo real ativas'
              : 'Reconectando às atualizações; sincronização temporária ativa'}
          </p>
        </div>
        <button
          aria-controls="tables-comandas-properties"
          aria-expanded={propertiesOpen}
          className="secondary-button properties-button"
          onClick={() => actions.toggleProperties()}
          type="button"
        >
          <Settings2 aria-hidden="true" size={15} />
          Propriedades
        </button>
      </header>

      {propertiesOpen ? <PropertiesPanel userId={userId} /> : null}

      {initialError ? (
        <div className="inline-error" role="status">
          Não foi possível carregar mesas e comandas agora. Atualize a página para tentar novamente.
        </div>
      ) : (
        <section aria-label="Gestão operacional" className="live-data-section">
          <div
            className={`live-data-grid${view === 'MESA_E_COMANDA' ? '' : ' live-data-grid-single'}`}
          >
            {view !== 'COMANDA' ? <TablesPanel tables={initialTables} view={view} /> : null}
            {view !== 'MESA' ? (
              <ComandasPanel
                canCloseOrders={canCloseOrders}
                canManageMenu={canManageMenu}
                canReceivePayments={canReceivePayments}
                orders={initialOrders}
                tableNumbers={tableNumbers}
                userId={userId}
                view={view}
              />
            ) : null}
          </div>
        </section>
      )}

      <OrderSummaryDialog
        canCloseOrders={canCloseOrders}
        canReceivePayments={canReceivePayments}
        order={dialogOrder}
        tableNumbers={tableNumbers}
      />
    </>
  );
}
