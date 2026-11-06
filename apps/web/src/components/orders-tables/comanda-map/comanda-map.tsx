'use client';

import { useMemo } from 'react';
import { buildComandaGrid } from '@/lib/comanda-grid';
import { useOrdersTables, useOrdersTablesActions } from '@/store';
import type { Order } from '@/lib/types';
import { useOrdersTablesApi } from '@/hooks';

export function ComandaMap({ orders }: Readonly<{ orders: readonly Order[] }>) {
  const {
    comandasTab,
    comandaNumbers: configuredNumbers,
    comandaPage,
    selectedComandaOrderId,
    pendingComandaNumber,
    tableActions,
  } = useOrdersTables((state) => ({
    comandasTab: state.comandasTab,
    comandaNumbers: state.comandaNumbers,
    comandaPage: state.comandaPage,
    selectedComandaOrderId: state.selectedComandaOrderId,
    pendingComandaNumber: state.pendingComandaNumber,
    tableActions: state.tableActions,
  }));
  const actions = useOrdersTablesActions();
  const api = useOrdersTablesApi();
  const grid = useMemo(
    () => buildComandaGrid({ configuredNumbers, orders, page: comandaPage }),
    [comandaPage, configuredNumbers, orders],
  );
  const pendingAction =
    pendingComandaNumber !== null ? tableActions[`comanda-${pendingComandaNumber}`] : undefined;

  return (
    <section aria-label="Números de comanda" className="comanda-number-board">
      <div className="comanda-number-board-heading">
        <p>
          {grid.total} comandas configuradas
          {orders.some((order) => order.comandaNumber !== null) ? ' · verde: aberta' : ''}
        </p>
        <span>
          <i aria-hidden="true" className="comanda-number-indicator is-open" />
          Aberta
          <i aria-hidden="true" className="comanda-number-indicator is-closed" />
          Fechada
        </span>
      </div>
      <div className="comanda-number-grid">
        {grid.numbers.map((number) => {
          const order = grid.ordersByNumber.get(number);
          const action = tableActions[`comanda-${number}`];
          const selected =
            comandasTab === 'MAP_WITH_DETAILS' && order?.id === selectedComandaOrderId;
          return (
            <button
              aria-current={selected ? 'true' : undefined}
              aria-label={
                order
                  ? comandasTab === 'MAP_WITH_DETAILS'
                    ? `Selecionar comanda ${number}`
                    : `Abrir detalhes da comanda ${number}`
                  : `Abrir comanda ${number}`
              }
              className={`comanda-number-tile${order ? ' is-open' : ' is-closed'}${selected ? ' is-selected' : ''}`}
              disabled={action?.status === 'pending'}
              key={number}
              onClick={() => {
                if (order) {
                  if (comandasTab === 'MAP_WITH_DETAILS') {
                    actions.selectComandaOrder(order.id);
                  } else {
                    actions.showOrderDetails(order.id);
                  }
                } else {
                  actions.requestOpenComanda(number);
                }
              }}
              type="button"
            >
              {number}
            </button>
          );
        })}
      </div>
      {grid.pageCount > 1 ? (
        <div aria-label="Paginação das comandas" className="comanda-number-pagination">
          <button
            className="text-button"
            disabled={grid.page === 0}
            onClick={() => actions.setComandaPage(grid.page - 1)}
            type="button"
          >
            Anterior
          </button>
          <span>
            Página {grid.page + 1} de {grid.pageCount}
          </span>
          <button
            className="text-button"
            disabled={grid.page + 1 >= grid.pageCount}
            onClick={() => actions.setComandaPage(grid.page + 1)}
            type="button"
          >
            Próxima
          </button>
        </div>
      ) : null}
      {pendingComandaNumber !== null && comandasTab !== 'MAP_WITH_DETAILS' ? (
        <div className="comanda-open-confirmation" role="group">
          <p>
            Deseja abrir a <strong>Comanda {pendingComandaNumber}</strong>?
          </p>
          <button
            className="primary-button"
            disabled={pendingAction?.status === 'pending'}
            onClick={() => void api.openOrder(undefined, pendingComandaNumber)}
            type="button"
          >
            {pendingAction?.status === 'pending' ? 'Abrindo…' : 'Sim, abrir comanda'}
          </button>
          <button
            className="text-button"
            onClick={() => actions.clearPendingComanda()}
            type="button"
          >
            Cancelar
          </button>
          {pendingAction ? (
            <p
              className={
                pendingAction.status === 'error'
                  ? 'action-feedback action-error'
                  : 'action-feedback'
              }
              role={pendingAction.status === 'error' ? 'alert' : 'status'}
            >
              {pendingAction.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
