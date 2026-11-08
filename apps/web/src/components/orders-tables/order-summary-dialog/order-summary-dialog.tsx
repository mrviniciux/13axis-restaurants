'use client';

import { useEffect, useRef } from 'react';
import { formatTime, getOrderDisplayName } from '@/lib/format';
import { DetailAddProductForm } from '../detail-add-product-form';
import { OrderBillingSection } from '../order-billing-section';
import { OrderCustomerSection } from '../order-customer-section';
import { OrderItemView } from '../order-item-view';
import { useOrdersTablesActions } from '@/store';
import type { Order } from '@/lib/types';

export function OrderSummaryDialog({
  order,
  tableNumbers,
  canReceivePayments,
  canCloseOrders,
  canManageMenu = false,
}: Readonly<{
  order: Order | null;
  tableNumbers: ReadonlyMap<string, number>;
  canReceivePayments: boolean;
  canCloseOrders: boolean;
  canManageMenu?: boolean;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const actions = useOrdersTablesActions();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (order && !dialog.open) dialog.showModal();
    if (!order && dialog.open) dialog.close();
  }, [order]);

  const tableNumber = order?.tableId ? tableNumbers.get(order.tableId) : undefined;
  const tableDescription = tableNumber !== undefined ? `Mesa ${tableNumber}` : '';
  const orderName = order ? getOrderDisplayName(order, tableNumbers) : '';

  return (
    <dialog
      aria-labelledby="order-summary-title"
      className="order-summary-dialog"
      onClose={() => actions.hideOrderDetails()}
      ref={dialogRef}
    >
      {order ? (
        <>
          <header className="order-summary-heading">
            <div>
              <h2 id="order-summary-title">{orderName}</h2>
              <p>
                {order.items.length} produto(s)
                {tableDescription ? ` · ${tableDescription}` : ''}
                {' · '}aberta às {formatTime(order.createdAt)}
              </p>
            </div>
            <button
              aria-label="Fechar resumo da comanda"
              className="secondary-button compact-btn"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Fechar
            </button>
          </header>
          <div className="order-summary-content comanda-detail-content">
            <OrderCustomerSection order={order} />
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
        </>
      ) : null}
    </dialog>
  );
}
