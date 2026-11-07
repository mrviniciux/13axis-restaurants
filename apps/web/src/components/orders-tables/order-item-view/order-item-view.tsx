'use client';

import { useOrdersTables, useOrdersTablesActions } from '@/store';
import { formatMoney } from '@/lib/format';
import { itemStatus, type OrderItem } from '@/lib/types';
import { useOrdersTablesApi } from '@/hooks';

export function OrderItemView({
  orderId,
  item,
  context,
}: Readonly<{
  orderId: string;
  item: OrderItem;
  context: 'card' | 'detail';
}>) {
  const { editingItem, itemDrafts, itemMutation, pendingDeletion } = useOrdersTables((state) => ({
    editingItem: state.editingItem,
    itemDrafts: state.itemDrafts,
    itemMutation: state.itemMutation,
    pendingDeletion: state.pendingDeletion,
  }));
  const editing = editingItem === item.id;
  const draft = itemDrafts[item.id];
  const mutation = itemMutation[item.id];
  const orderPendingDeletion = pendingDeletion === item.id;
  const actions = useOrdersTablesActions();
  const api = useOrdersTablesApi();
  const disabled = mutation?.status === 'pending';

  return (
    <li className={editing ? 'is-editing' : undefined}>
      {editing ? (
        <div className="edit-order-item compact-edit">
          <strong className="edit-item-title">{item.name}</strong>
          <div className="edit-order-item-fields">
            <label>
              Qtd
              <input
                inputMode="decimal"
                onChange={(event) =>
                  actions.updateItemDraft(item.id, { quantity: event.target.value })
                }
                value={draft?.quantity ?? item.quantity}
              />
            </label>
            <label className="edit-notes-label">
              Obs
              <input
                maxLength={500}
                onChange={(event) => actions.updateItemDraft(item.id, { notes: event.target.value })}
                placeholder="Observação opcional"
                value={draft?.notes ?? item.notes ?? ''}
              />
            </label>
          </div>
          <div className="item-actions">
            <button
              className="secondary-button compact-btn"
              disabled={disabled}
              onClick={() => void api.saveItem(orderId, item)}
              type="button"
            >
              Salvar
            </button>
            <button
              className="text-button"
              onClick={() => actions.cancelEditingItem()}
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : context === 'detail' ? (
        <div className="comanda-detail-item-row">
          <div className="comanda-detail-item-left">
            <div className="comanda-detail-item-title-row">
              <strong className="comanda-detail-item-name">
                {item.quantity} × {item.name}
              </strong>
              {item.notes ? (
                <span className="comanda-detail-item-note">({item.notes})</span>
              ) : null}
              <span className="comanda-detail-item-unit">
                · {formatMoney(item.unitPrice)}/un
              </span>
              {item.status ? (
                <span className="comanda-detail-item-status-pill">
                  {itemStatus[item.status] ?? item.status}
                </span>
              ) : null}
            </div>
          </div>
          <div className="comanda-detail-item-side">
            <strong className="comanda-detail-item-total">{formatMoney(item.lineTotal)}</strong>
            <ItemActions
              disabled={disabled}
              onCancelDelete={() => actions.cancelDeleteItem()}
              onConfirmDelete={() => void api.removeItem(orderId, item)}
              onEdit={() => actions.startEditingItem(item)}
              pendingDeletion={orderPendingDeletion}
            />
          </div>
        </div>
      ) : (
        <div className="order-card-item-row">
          <div className="order-card-item-left">
            <strong className="order-card-item-name">
              {item.quantity} × {item.name}
            </strong>
            {item.notes ? (
              <span className="order-card-item-note">({item.notes})</span>
            ) : null}
            {item.status ? (
              <span className="order-card-item-status-pill">
                {itemStatus[item.status] ?? item.status}
              </span>
            ) : null}
          </div>
          <div className="order-card-item-right">
            <span className="order-card-item-price">{formatMoney(item.lineTotal)}</span>
            {item.status === null ? (
              <ItemActions
                disabled={disabled}
                onCancelDelete={() => actions.cancelDeleteItem()}
                onConfirmDelete={() => void api.removeItem(orderId, item)}
                onEdit={() => actions.startEditingItem(item)}
                pendingDeletion={orderPendingDeletion}
              />
            ) : null}
          </div>
        </div>
      )}
      {mutation ? (
        <p
          className={
            mutation.status === 'error' ? 'action-feedback action-error' : 'action-feedback'
          }
          role={mutation.status === 'error' ? 'alert' : 'status'}
        >
          {mutation.message}
        </p>
      ) : null}
    </li>
  );
}

function ItemActions({
  pendingDeletion,
  disabled,
  onEdit,
  onConfirmDelete,
  onCancelDelete,
}: Readonly<{
  pendingDeletion: boolean;
  disabled: boolean;
  onEdit: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}>) {
  return (
    <span className="item-actions">
      {pendingDeletion ? (
        <>
          <button
            className="text-button item-action-btn is-delete"
            disabled={disabled}
            onClick={onConfirmDelete}
            type="button"
          >
            Confirmar
          </button>
          <button className="text-button item-action-btn" onClick={onCancelDelete} type="button">
            Cancelar
          </button>
        </>
      ) : (
        <>
          <button className="text-button item-action-btn" disabled={disabled} onClick={onEdit} type="button">
            Editar
          </button>
          <button
            className="text-button item-action-btn is-delete"
            disabled={disabled}
            onClick={onConfirmDelete}
            type="button"
          >
            Excluir
          </button>
        </>
      )}
    </span>
  );
}
