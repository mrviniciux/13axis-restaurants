'use client';

import { formatTime, getOrderDisplayName } from '@/lib/format';
import { DetailAddProductForm } from '../detail-add-product-form';
import { OrderBillingSection } from '../order-billing-section';
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
        onOpen={() => void api.openOrder(undefined, pendingComandaNumber)}
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
  onOpen: () => void;
}>) {
  const action = useOrdersTables((state) => state.tableActions[`comanda-${comandaNumber}`]);

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
            onClick={onOpen}
            type="button"
          >
            {action?.status === 'pending' ? 'Abrindo…' : 'Abrir comanda'}
          </button>
        </div>
      </header>
      <div className="order-summary-content comanda-open-pane-content">
        <p>Abra a comanda para lançar produtos, registrar pagamento e acompanhar os totais.</p>
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
