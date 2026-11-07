'use client';

import { useEffect, useState } from 'react';
import type { Order } from '@/lib/types';
import { useOrdersTablesApi } from '@/hooks';
import { useOrdersTables } from '@/store';

export function OrderCustomerSection({ order }: Readonly<{ order: Order }>) {
  const api = useOrdersTablesApi();
  const actionKey = `order-details-${order.id}`;
  const action = useOrdersTables((state) => state.tableActions[actionKey]);

  const [customerName, setCustomerName] = useState(order.customerName ?? '');
  const [peopleCount, setPeopleCount] = useState(
    order.peopleCount !== null ? String(order.peopleCount) : '',
  );
  const [dirty, setDirty] = useState(false);

  // Keep local state in sync if the order is updated externally (realtime)
  useEffect(() => {
    setCustomerName(order.customerName ?? '');
    setPeopleCount(order.peopleCount !== null ? String(order.peopleCount) : '');
    setDirty(false);
  }, [order.customerName, order.peopleCount]);

  const saving = action?.status === 'pending';

  function handleSave() {
    const count = peopleCount !== '' ? parseInt(peopleCount, 10) : null;
    void api.saveOrderDetails(
      order.id,
      customerName.trim() || null,
      Number.isFinite(count) && count !== null && count > 0 ? count : null,
    );
    setDirty(false);
  }

  return (
    <section aria-label="Cliente e número de pessoas" className="order-customer-section">
      <div className="order-customer-fields">
        <label className="order-customer-label">
          <span>Cliente</span>
          <input
            autoComplete="off"
            disabled={saving}
            maxLength={200}
            onChange={(e) => { setCustomerName(e.target.value); setDirty(true); }}
            placeholder="Nome do cliente (opcional)"
            type="text"
            value={customerName}
          />
        </label>
        <label className="order-customer-label order-customer-people">
          <span>Pessoas</span>
          <input
            disabled={saving}
            inputMode="numeric"
            max={999}
            min={1}
            onChange={(e) => { setPeopleCount(e.target.value); setDirty(true); }}
            placeholder="—"
            type="number"
            value={peopleCount}
          />
        </label>
      </div>
      {dirty ? (
        <button
          className="secondary-button compact-btn"
          disabled={saving}
          onClick={handleSave}
          type="button"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      ) : null}
      {action && !dirty ? (
        <p
          className={action.status === 'error' ? 'action-feedback action-error' : 'action-feedback'}
          role={action.status === 'error' ? 'alert' : 'status'}
        >
          {action.message}
        </p>
      ) : null}
    </section>
  );
}
