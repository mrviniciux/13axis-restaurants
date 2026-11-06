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
        <div className="edit-order-item">
          <strong>{item.name}</strong>
          <label>
            Quantidade
            <input
              inputMode="decimal"
              onChange={(event) =>
                actions.updateItemDraft(item.id, { quantity: event.target.value })
              }
              value={draft?.quantity ?? item.quantity}
            />
          </label>
          <label>
            Observação
            <input
              maxLength={500}
              onChange={(event) => actions.updateItemDraft(item.id, { notes: event.target.value })}
              value={draft?.notes ?? item.notes ?? ''}
            />
          </label>
          <div className="item-actions">
            <button
              className="secondary-button"
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
          <span>
            <strong>
              {item.quantity} × {item.name}
            </strong>
            <small>
              {formatMoney(item.unitPrice)} por unidade
              {item.notes ? ` · ${item.notes}` : ''}
            </small>
            {item.status ? <small>{itemStatus[item.status] ?? item.status}</small> : null}
          </span>
          <span className="comanda-detail-item-side">
            <strong>{formatMoney(item.lineTotal)}</strong>
            {item.status === null ? (
              <ItemActions
                disabled={disabled}
                onConfirmDelete={() => void api.removeItem(orderId, item)}
                onEdit={() => actions.startEditingItem(item)}
                onCancelDelete={() => actions.cancelDeleteItem()}
                pendingDeletion={orderPendingDeletion}
              />
            ) : null}
          </span>
        </div>
      ) : (
        <>
          <span>
            <strong>
              {item.quantity} × {item.name}
            </strong>
            {item.notes ? <small>{item.notes}</small> : null}
            <small>
              {item.status ? (itemStatus[item.status] ?? item.status) : 'Pendente de envio'}
            </small>
          </span>
          <span>
            {formatMoney(item.lineTotal)}
            {item.status === null ? (
              <ItemActions
                disabled={disabled}
                onConfirmDelete={() => void api.removeItem(orderId, item)}
                onEdit={() => actions.startEditingItem(item)}
                onCancelDelete={() => actions.cancelDeleteItem()}
                pendingDeletion={orderPendingDeletion}
              />
            ) : null}
          </span>
        </>
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
            className="text-button"
            disabled={disabled}
            onClick={onConfirmDelete}
            type="button"
          >
            Confirmar exclusão
          </button>
          <button className="text-button" onClick={onCancelDelete} type="button">
            Cancelar
          </button>
        </>
      ) : (
        <>
          <button className="text-button" disabled={disabled} onClick={onEdit} type="button">
            Editar
          </button>
          <button
            className="text-button"
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
