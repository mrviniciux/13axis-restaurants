'use client';

import { formatTime, getOrderDisplayName } from '@/lib/format';
import { DetailAddProductForm } from '../detail-add-product-form';
import { OrderBillingSection } from '../order-billing-section';
import { OrderCustomerSection } from '../order-customer-section';
import { OrderItemView } from '../order-item-view';
import { useOrdersTables, useOrdersTablesActions } from '@/store';
import type { Order } from '@/lib/types';
import { useOrdersTablesApi } from '@/hooks';

export function ComandaDetailPane({
  order,
  pendingComandaNumber,
  tableNumbers,
  canManageMenu,
  canCloseOrders,
  canReceivePayments,
}: Readonly<{
  order: Order | null;
  pendingComandaNumber: number | null;
  tableNumbers: ReadonlyMap<string, number>;
  canManageMenu: boolean;
  canCloseOrders: boolean;
  canReceivePayments: boolean;
}>) {
  const actions = useOrdersTablesActions();
  const api = useOrdersTablesApi();

  if (pendingComandaNumber !== null) {
    return (
      <OpenComandaPane
        comandaNumber={pendingComandaNumber}
        onCancel={() => actions.clearPendingComanda()}
        onOpen={(customerName, peopleCount) =>
          void api.openOrder(undefined, pendingComandaNumber, customerName, peopleCount)
        }
      />
    );
  }

  if (!order) {
    return (
      <aside className="comanda-detail-pane comanda-detail-placeholder">
        <strong>Selecione uma comanda</strong>
        <p>Clique em um número verde no mapa para ver os detalhes da comanda.</p>
      </aside>
    );
  }

  const tableNumber = order.tableId ? tableNumbers.get(order.tableId) : undefined;
  const orderName = getOrderDisplayName(order, tableNumbers);
  const tableDescription = tableNumber !== undefined ? `Mesa ${tableNumber}` : '';

  return (
    <aside aria-label={`Detalhamento da ${orderName}`} className="comanda-detail-pane">
      <header className="order-summary-heading">
        <div>
          <h3>{orderName}</h3>
          <p>
            {order.items.length} produto(s)
            {tableDescription ? ` · ${tableDescription}` : ''}
            {' · '}aberta às {formatTime(order.createdAt)}
          </p>
        </div>
      </header>
      <div className="order-summary-content comanda-detail-content">
        {order.items.length === 0 ? (
          <p className="order-empty">Nenhum produto lançado nesta comanda.</p>
        ) : (
          <ul className="order-summary-items comanda-detail-items">
            {order.items.map((item) => (
              <OrderItemView context="detail" item={item} key={item.id} orderId={order.id} />
            ))}
          </ul>
        )}
        <OrderCustomerSection order={order} />
        <DetailAddProductForm canManageMenu={canManageMenu} order={order} />
        <OrderBillingSection
          canCloseOrders={canCloseOrders}
          canReceivePayments={canReceivePayments}
          order={order}
        />
      </div>
    </aside>
  );
}

function OpenComandaPane({
  comandaNumber,
  onCancel,
  onOpen,
}: Readonly<{
  comandaNumber: number;
  onCancel: () => void;
  onOpen: (customerName?: string, peopleCount?: number) => void;
}>) {
  const action = useOrdersTables((state) => state.tableActions[`comanda-${comandaNumber}`]);
  const { openOrderCustomerName, openOrderPeopleCount } = useOrdersTables((state) => ({
    openOrderCustomerName: state.openOrderCustomerName,
    openOrderPeopleCount: state.openOrderPeopleCount,
  }));
  const actions = useOrdersTablesActions();

  return (
    <aside
      aria-label={`Abrir Comanda ${comandaNumber}`}
      className="comanda-detail-pane comanda-open-pane"
    >
      <header className="order-summary-heading comanda-open-pane-heading">
        <div>
          <h3>Comanda {comandaNumber}</h3>
          <p>Esta comanda ainda não foi aberta.</p>
        </div>
        <div className="comanda-open-pane-actions">
          <button className="text-button" onClick={onCancel} type="button">
            Cancelar
          </button>
          <button
            className="primary-button"
            disabled={action?.status === 'pending'}
            onClick={() => onOpen(
              openOrderCustomerName || undefined,
              openOrderPeopleCount ? parseInt(openOrderPeopleCount, 10) || undefined : undefined,
            )}
            type="button"
          >
            {action?.status === 'pending' ? 'Abrindo…' : 'Abrir comanda'}
          </button>
        </div>
      </header>
      <div className="order-summary-content comanda-open-pane-content">
        <p>Abra a comanda para lançar produtos, registrar pagamento e acompanhar os totais.</p>
        <div className="new-order-inputs">
          <label className="new-order-input-label">
            <span>Cliente</span>
            <input
              autoComplete="off"
              disabled={action?.status === 'pending'}
              maxLength={200}
              onChange={(e) => actions.setOpenOrderCustomerName(e.target.value)}
              placeholder="Nome (opcional)"
              type="text"
              value={openOrderCustomerName}
            />
          </label>
          <label className="new-order-input-label new-order-people">
            <span>Pessoas</span>
            <input
              disabled={action?.status === 'pending'}
              inputMode="numeric"
              max={999}
              min={1}
              onChange={(e) => actions.setOpenOrderPeopleCount(e.target.value)}
              placeholder="—"
              type="number"
              value={openOrderPeopleCount}
            />
          </label>
        </div>
        {action ? (
          <p
            className={
              action.status === 'error' ? 'action-feedback action-error' : 'action-feedback'
            }
            role={action.status === 'error' ? 'alert' : 'status'}
          >
            {action.message}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
