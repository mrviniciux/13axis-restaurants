'use client';

import { useState } from 'react';
import { useOrdersTables, useOrdersTablesActions } from '@/store';
import { useOrdersTablesApi } from '@/hooks';

export function StandaloneOrderForm() {
  const [comandaNumber, setComandaNumber] = useState('');
  const number = Number(comandaNumber);
  const validNumber = Number.isInteger(number) && number > 0 && number <= 2_147_483_647;
  const { action, customerName, peopleCount } = useOrdersTables((state) => ({
    action: state.tableActions[validNumber ? `comanda-${number}` : 'standalone'],
    customerName: state.openOrderCustomerName,
    peopleCount: state.openOrderPeopleCount,
  }));
  const actions = useOrdersTablesActions();
  const api = useOrdersTablesApi();

  return (
    <div aria-label="Abrir comanda sem mesa" className="new-order-form">
      <div className="new-order-inputs">
        <label className="new-order-input-label new-order-number">
          <span>Número da comanda</span>
          <input
            disabled={action?.status === 'pending'}
            inputMode="numeric"
            max={2_147_483_647}
            min={1}
            onChange={(event) => setComandaNumber(event.target.value)}
            placeholder="Ex.: 21"
            required
            type="number"
            value={comandaNumber}
          />
        </label>
        <label className="new-order-input-label">
          <span>Cliente</span>
          <input
            autoComplete="off"
            disabled={action?.status === 'pending'}
            maxLength={200}
            onChange={(event) => actions.setOpenOrderCustomerName(event.target.value)}
            placeholder="Nome (opcional)"
            type="text"
            value={customerName}
          />
        </label>
        <label className="new-order-input-label new-order-people">
          <span>Pessoas</span>
          <input
            disabled={action?.status === 'pending'}
            inputMode="numeric"
            max={999}
            min={1}
            onChange={(event) => actions.setOpenOrderPeopleCount(event.target.value)}
            placeholder="—"
            type="number"
            value={peopleCount}
          />
        </label>
      </div>
      <button
        className="secondary-button"
        disabled={!validNumber || action?.status === 'pending'}
        onClick={() =>
          void api.openOrder(
            undefined,
            number,
            customerName || undefined,
            peopleCount ? parseInt(peopleCount, 10) || undefined : undefined,
          )
        }
        type="button"
      >
        {action?.status === 'pending'
          ? 'Abrindo…'
          : action?.status === 'error'
            ? 'Tentar novamente'
            : `Abrir comanda${validNumber ? ` ${number}` : ''}`}
      </button>
      {action ? (
        <p
          className={action.status === 'error' ? 'action-feedback action-error' : 'action-feedback'}
          role={action.status === 'error' ? 'alert' : 'status'}
        >
          {action.message}
        </p>
      ) : null}
    </div>
  );
}
