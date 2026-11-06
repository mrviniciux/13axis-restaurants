'use client';

import { formatMoney } from '@/lib/format';
import { useOrdersTables, useOrdersTablesActions } from '@/store';
import { PAYMENT_METHODS, type Order, type PaymentMethod } from '@/lib/types';
import { useOrdersTablesApi } from '@/hooks';

export function OrderBillingSection({
  order,
  canReceivePayments,
  canCloseOrders,
}: Readonly<{
  order: Order;
  canReceivePayments: boolean;
  canCloseOrders: boolean;
}>) {
  const {
    paymentAmounts,
    paymentMethods,
    collapsedPaymentOrders,
    tableActions,
    closeConfirmOrderId,
  } = useOrdersTables((state) => ({
    paymentAmounts: state.paymentAmounts,
    paymentMethods: state.paymentMethods,
    collapsedPaymentOrders: state.collapsedPaymentOrders,
    tableActions: state.tableActions,
    closeConfirmOrderId: state.closeConfirmOrderId,
  }));
  const paymentAmount = paymentAmounts[order.id];
  const paymentMethod = paymentMethods[order.id] ?? 'dinheiro';
  const paymentCollapsed = collapsedPaymentOrders[order.id] ?? false;
  const paymentAction = tableActions[`payment-${order.id}`];
  const closeAction = tableActions[`comanda-${order.id}`];
  const closeConfirming = closeConfirmOrderId === order.id;
  const actions = useOrdersTablesActions();
  const api = useOrdersTablesApi();
  const paymentSectionId = `payment-section-${order.id}`;

  return (
    <>
      <OrderTotals order={order} />
      {canReceivePayments ? (
        <section
          aria-labelledby={`payment-title-${order.id}`}
          className={`order-payment-section${paymentCollapsed ? '' : ' is-expanded'}`}
          id={paymentSectionId}
        >
          <div className="order-payment-heading">
            <div>
              <h3 id={`payment-title-${order.id}`}>Registrar pagamento</h3>
              <p>Total da comanda: {formatMoney(order.total)}</p>
            </div>
            <button
              aria-controls={paymentSectionId}
              aria-expanded={!paymentCollapsed}
              className="text-button"
              onClick={() => actions.togglePaymentSection(order.id)}
              type="button"
            >
              {paymentCollapsed ? 'Expandir' : 'Recolher'}
            </button>
          </div>
          {!paymentCollapsed ? (
            <form
              className="order-payment-form"
              onSubmit={(event) => {
                event.preventDefault();
                void api.registerPayment(order.id, paymentAmount ?? order.total, paymentMethod);
              }}
            >
              <div className="order-payment-fields">
                <label>
                  Valor
                  <input
                    inputMode="decimal"
                    onChange={(event) => actions.setPaymentAmount(order.id, event.target.value)}
                    placeholder={order.total}
                    value={paymentAmount ?? order.total}
                  />
                </label>
                <label>
                  Forma de pagamento
                  <select
                    onChange={(event) =>
                      actions.setPaymentMethod(order.id, event.target.value as PaymentMethod)
                    }
                    value={paymentMethod}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="order-payment-help">
                Informe o valor total para encerrar a comanda após o pagamento.
              </p>
              <div className="order-payment-actions">
                <button
                  className="primary-button"
                  disabled={paymentAction?.status === 'pending'}
                  type="submit"
                >
                  {paymentAction?.status === 'pending' ? 'Registrando…' : 'Registrar pagamento'}
                </button>
              </div>
              {paymentAction ? (
                <p
                  className={
                    paymentAction.status === 'error'
                      ? 'action-feedback action-error'
                      : 'action-feedback'
                  }
                  role={paymentAction.status === 'error' ? 'alert' : 'status'}
                >
                  {paymentAction.message}
                </p>
              ) : null}
            </form>
          ) : null}
        </section>
      ) : null}
      {canCloseOrders ? (
        <div className="order-close-actions">
          {closeConfirming ? (
            <div
              aria-label="Confirmar fechamento da comanda"
              className="order-close-confirmation"
              role="group"
            >
              <p>Deseja realmente fechar esta comanda?</p>
              <div className="order-close-confirmation-actions">
                <button
                  className="text-button"
                  onClick={() => actions.cancelCloseOrder()}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="secondary-button order-close-confirm-button"
                  disabled={closeAction?.status === 'pending'}
                  onClick={() => void api.closeOrder(order.id)}
                  type="button"
                >
                  {closeAction?.status === 'pending' ? 'Fechando…' : 'Sim, fechar comanda'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="text-button order-close-trigger"
              onClick={() => actions.requestCloseOrder(order.id)}
              type="button"
            >
              Fechar comanda
            </button>
          )}
          {closeAction ? (
            <p
              className={
                closeAction.status === 'error' ? 'action-feedback action-error' : 'action-feedback'
              }
              role={closeAction.status === 'error' ? 'alert' : 'status'}
            >
              {closeAction.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function OrderTotals({ order }: Readonly<{ order: Order }>) {
  return (
    <>
      <dl className="order-summary-totals">
        <div>
          <dt>Produtos</dt>
          <dd>{formatMoney(order.total)}</dd>
        </div>
        <div>
          <dt>Taxa de garçom</dt>
          <dd>Não configurada</dd>
        </div>
        <div>
          <dt>Desconto</dt>
          <dd>Não configurado</dd>
        </div>
        <div className="order-summary-grand-total">
          <dt>Total</dt>
          <dd>{formatMoney(order.total)}</dd>
        </div>
      </dl>
      <p className="order-summary-note">
        Taxa de garçom e desconto ainda não são configurados nem aplicados ao total.
      </p>
    </>
  );
}
