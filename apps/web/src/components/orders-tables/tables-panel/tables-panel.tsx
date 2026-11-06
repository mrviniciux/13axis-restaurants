'use client';

import { useOrdersTables } from '@/store';
import { tableStatus, type Table } from '@/lib/types';
import { useOrdersTablesApi } from '@/hooks';
import type { TablesComandasView } from '@/lib/server/tables-comandas-view';

export function TablesPanel({
  tables,
  view,
}: Readonly<{
  tables: readonly Table[];
  view: TablesComandasView;
}>) {
  const tableActions = useOrdersTables((state) => state.tableActions);
  const api = useOrdersTablesApi();

  return (
    <section aria-labelledby="tables-title" className="panel">
      <div className="panel-heading">
        <div>
          <h3 id="tables-title">Mesas</h3>
          <p>{tables.length} mesa(s) cadastrada(s)</p>
        </div>
      </div>
      {tables.length === 0 ? (
        <p className="empty-state">
          Nenhuma mesa cadastrada para este restaurante. Quando houver mesas ativas, elas aparecerão
          aqui.
        </p>
      ) : (
        <ul className="table-list table-card-grid">
          {tables.map((table) => {
            const action = tableActions[table.id];
            const unavailable = table.status === 'RESERVED' || table.status === 'CLOSING';
            return (
              <li className="table-row table-card" key={table.id}>
                <div className="table-main">
                  <strong>Mesa {String(table.number).padStart(2, '0')}</strong>
                  <span>
                    {tableStatus[table.status]} · capacidade {table.capacity}
                    {view === 'MESA_E_COMANDA' ? ` · ${table.openOrders.length} comanda(s)` : ''}
                  </span>
                  {view === 'MESA_E_COMANDA' && action ? (
                    <span
                      className={
                        action.status === 'error'
                          ? 'action-feedback action-error'
                          : 'action-feedback'
                      }
                      role={action.status === 'error' ? 'alert' : 'status'}
                    >
                      {action.message}
                    </span>
                  ) : null}
                </div>
                {view === 'MESA_E_COMANDA' ? (
                  <button
                    className="secondary-button"
                    disabled={action?.status === 'pending' || unavailable}
                    onClick={() => void api.openOrder(table.id)}
                    type="button"
                  >
                    {unavailable
                      ? table.status === 'RESERVED'
                        ? 'Reservada'
                        : 'Em fechamento'
                      : action?.status === 'pending'
                        ? 'Abrindo…'
                        : action?.status === 'error'
                          ? 'Tentar novamente'
                          : 'Abrir comanda'}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
