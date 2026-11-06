'use client';

import { useEffect, useRef } from 'react';
import { formatMoney, getOrderDisplayName } from '@/lib/format';
import { OrderBillingSection } from '../order-billing-section';
import { useOrdersTablesActions } from '@/store';
import type { Order } from '@/lib/types';

export function OrderSummaryDialog({
  order,
  tableNumbers,
  canReceivePayments,
  canCloseOrders,
}: Readonly<{
  order: Order | null;
  tableNumbers: ReadonlyMap<string, number>;
  canReceivePayments: boolean;
  canCloseOrders: boolean;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const actions = useOrdersTablesActions();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (order && !dialog.open) dialog.showModal();
    if (!order && dialog.open) dialog.close();
  }, [order]);

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
              <h2 id="order-summary-title">{getOrderDisplayName(order, tableNumbers)}</h2>
              <p>{order.items.length} produto(s)</p>
            </div>
            <button
              aria-label="Fechar resumo da comanda"
              className="secondary-button"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Fechar
            </button>
          </header>
          <div className="order-summary-content">
            {order.items.length === 0 ? (
              <p className="order-empty">Nenhum produto lançado nesta comanda.</p>
            ) : (
              <ul className="order-summary-items">
                {order.items.map((item) => (
                  <li key={item.id}>
                    <span>
                      <strong>
                        {item.quantity} × {item.name}
                      </strong>
                      <small>
                        {formatMoney(item.unitPrice)} por unidade
                        {item.notes ? ` · ${item.notes}` : ''}
                      </small>
                    </span>
                    <strong>{formatMoney(item.lineTotal)}</strong>
                  </li>
                ))}
              </ul>
            )}
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
