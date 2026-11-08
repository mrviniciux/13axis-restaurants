'use client';

import { ComandaDetailPane } from '../comanda-detail-pane';
import { ComandaMap } from '../comanda-map';
import { LargeCardsView } from '../large-cards-view';
import { OrderCard } from '../order-card';
import { useOrdersTables, useOrdersTablesActions } from '@/store';
import type { Order, Table } from '@/lib/types';
import { TablesComandasTabs } from '@/components/tables-comandas-tabs';
import { StandaloneOrderForm } from '../standalone-order-form/standalone-order-form';
import type { TablesComandasView } from '@/lib/server/tables-comandas-view';

export function ComandasPanel({
  orders,
  view,
  userId,
  tableNumbers,
  tables,
  canManageMenu,
  canCloseOrders,
  canReceivePayments,
}: Readonly<{
  orders: readonly Order[];
  view: TablesComandasView;
  userId: string;
  tableNumbers: ReadonlyMap<string, number>;
  tables?: readonly Table[];
  canManageMenu: boolean;
  canCloseOrders: boolean;
  canReceivePayments: boolean;
}>) {
  const { comandasTab, selectedComandaOrderId, pendingComandaNumber } =
    useOrdersTables((state) => ({
      comandasTab: state.comandasTab,
      selectedComandaOrderId: state.selectedComandaOrderId,
      pendingComandaNumber: state.pendingComandaNumber,
    }));
  const actions = useOrdersTablesActions();
  const tabsId = `tables-comandas-view-${userId}`;
  const selectedOrder = orders.find((order) => order.id === selectedComandaOrderId) ?? null;

  return (
    <section aria-labelledby="open-orders-title" className="panel comandas-panel">
      <div className="panel-heading comandas-panel-heading">
        <div>
          <h3 id="open-orders-title">Comandas</h3>
        </div>
        <TablesComandasTabs
          idPrefix={tabsId}
          onChange={actions.setComandasTab}
          panelId={`${tabsId}-panel`}
          value={comandasTab}
        />
      </div>
      <div aria-labelledby={`${tabsId}-${comandasTab}`} id={`${tabsId}-panel`} role="tabpanel">
        {comandasTab === 'LARGE_CARDS' ? (
          <LargeCardsView
            canCloseOrders={canCloseOrders}
            canManageMenu={canManageMenu}
            canReceivePayments={canReceivePayments}
            orders={orders}
            tableNumbers={tableNumbers}
            tables={tables}
            userId={userId}
          />
        ) : (
          <>
            {comandasTab !== 'CARDS' ? (
              <div
                className={
                  comandasTab === 'MAP_WITH_DETAILS' ? 'comanda-map-detail-layout' : undefined
                }
              >
                <ComandaMap orders={orders} />
                {comandasTab === 'MAP_WITH_DETAILS' ? (
                  <ComandaDetailPane
                    canCloseOrders={canCloseOrders}
                    canManageMenu={canManageMenu}
                    canReceivePayments={canReceivePayments}
                    order={selectedOrder}
                    pendingComandaNumber={pendingComandaNumber}
                    tableNumbers={tableNumbers}
                  />
                ) : null}
              </div>
            ) : null}
            {view === 'MESA_E_COMANDA' || comandasTab === 'CARDS' ? (
              <StandaloneOrderForm />
            ) : null}
            {orders.length === 0 ? (
              <p className="empty-state">
                {comandasTab === 'CARDS'
                  ? 'Não há comandas abertas no momento. Use o formulário acima para informar o número e abrir uma comanda.'
                  : view === 'MESA_E_COMANDA'
                    ? 'Não há comandas abertas. Selecione um quadrado cinza ou use uma mesa ao lado para abrir uma comanda.'
                    : 'Não há comandas abertas. Selecione um quadrado cinza para abrir uma comanda.'}
              </p>
            ) : comandasTab === 'MAP_WITH_DETAILS' ? null : (
              <ul className="open-order-list order-card-grid">
                {orders.map((order) => (
                  <OrderCard
                    canManageMenu={canManageMenu}
                    key={order.id}
                    order={order}
                    tableNumbers={tableNumbers}
                    view={view}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
}
