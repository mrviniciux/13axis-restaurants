'use client';

import { createId } from '@mudra/shared';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useOrdersTablesStoreApi } from '../store';
import type { MenuItem, OrderItem, ProductCreateTarget } from '../lib/types';
import type { TablesComandasView } from '@/lib/server/tables-comandas-view';

function readServerMessage(result: unknown, fallback: string) {
  if (result === null || typeof result !== 'object') return fallback;
  if ('detail' in result && typeof result.detail === 'string') return result.detail;
  if ('message' in result && typeof result.message === 'string') return result.message;
  return fallback;
}

function isMenuItem(value: unknown): value is MenuItem {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'category' in value &&
    typeof value.category === 'string' &&
    'price' in value &&
    typeof value.price === 'string'
  );
}

export function useOrdersTablesApi() {
  const router = useRouter();
  const store = useOrdersTablesStoreApi();

  return useMemo(() => {
    async function saveViewPreference(nextView: TablesComandasView) {
      const state = store.getState();
      if (nextView === state.view || state.preferenceStatus === 'saving') return;
      state.actions.setPreferenceStatus('saving');
      try {
        const response = await fetch('/api/preferences/tables-comandas-view', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ view: nextView }),
        });
        if (!response.ok) {
          store.getState().actions.setPreferenceStatus('error');
          return;
        }
        store.getState().actions.setView(nextView);
        store.getState().actions.setPreferenceStatus('saved');
        router.refresh();
      } catch {
        store.getState().actions.setPreferenceStatus('error');
      }
    }

    async function saveComandaNumbers() {
      const state = store.getState();
      if (state.comandaNumbersStatus === 'saving') return;
      state.actions.setComandaNumbersStatus('saving');
      try {
        const response = await fetch('/api/preferences/comanda-numbers', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ comandaNumbers: state.comandaNumbers }),
        });
        if (!response.ok) {
          const problem: unknown = await response.json().catch(() => null);
          const validationMessage =
            problem !== null &&
            typeof problem === 'object' &&
            'errors' in problem &&
            Array.isArray(problem.errors) &&
            typeof problem.errors[0]?.message === 'string'
              ? problem.errors[0].message
              : null;
          store.getState().actions.setComandaNumbersStatus('error');
          store
            .getState()
            .actions.setComandaNumbersError(
              validationMessage ?? 'Não foi possível salvar. Revise os números e tente novamente.',
            );
          return;
        }
        store.getState().actions.setComandaNumbersError('');
        store.getState().actions.setComandaNumbersStatus('saved');
        store.getState().actions.setComandaPage(0);
        router.refresh();
      } catch {
        store.getState().actions.setComandaNumbersStatus('error');
        store
          .getState()
          .actions.setComandaNumbersError('Falha de conexão ao salvar. Tente novamente.');
      }
    }

    async function openOrder(tableId?: string, comandaNumber?: number) {
      const state = store.getState();
      const actionKey = comandaNumber ? `comanda-${comandaNumber}` : (tableId ?? 'standalone');
      const current = state.tableActions[actionKey];
      if (current?.status === 'pending') return;
      const id = current?.status === 'error' ? current.id : createId();

      state.actions.setTableAction(actionKey, {
        id,
        status: 'pending',
        message: 'Abrindo comanda…',
      });

      try {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id,
            ...(tableId ? { tableId } : {}),
            ...(comandaNumber ? { comandaNumber } : {}),
            deviceId: null,
          }),
        });

        if (!response.ok) {
          store.getState().actions.setTableAction(actionKey, {
            id,
            status: 'error',
            message:
              response.status >= 500
                ? 'O servidor não confirmou a operação. Tente novamente para repetir a mesma solicitação.'
                : response.status === 409 && comandaNumber
                  ? `A comanda ${comandaNumber} foi aberta em outra sessão. Atualize a tela.`
                  : 'Não foi possível abrir a comanda. Confira a sessão e a mesa e tente novamente.',
          });
          return;
        }

        let result: unknown;
        try {
          result = await response.json();
        } catch {
          store.getState().actions.setTableAction(actionKey, {
            id,
            status: 'error',
            message:
              'A resposta da abertura não pôde ser lida. Atualize a tela; uma nova tentativa repetirá a mesma solicitação com segurança.',
          });
          return;
        }

        const openedOrderId =
          result !== null &&
          typeof result === 'object' &&
          'id' in result &&
          typeof result.id === 'string'
            ? result.id
            : null;
        if (!openedOrderId) {
          store.getState().actions.setTableAction(actionKey, {
            id,
            status: 'error',
            message:
              'A resposta do servidor não confirmou qual comanda foi aberta. Atualize a tela.',
          });
          return;
        }

        const replayed = response.status === 200;
        store.getState().actions.setTableAction(actionKey, {
          id,
          status: replayed ? 'replayed' : 'created',
          message: replayed
            ? 'Solicitação repetida reconhecida: esta comanda já havia sido aberta.'
            : 'Comanda aberta com sucesso.',
        });
        store.getState().actions.clearPendingComanda();
        if (comandaNumber !== undefined && store.getState().comandasTab === 'MAP_WITH_DETAILS') {
          store.getState().actions.selectComandaOrder(openedOrderId);
        } else {
          store.getState().actions.setQuickAddOpen(openedOrderId, true);
          store.getState().actions.requestOrderFocus(openedOrderId);
        }
        router.refresh();
      } catch {
        store.getState().actions.setTableAction(actionKey, {
          id,
          status: 'error',
          message:
            'Não foi possível confirmar a conexão. Tente novamente para repetir a mesma solicitação com segurança.',
        });
      }
    }

    async function closeOrder(orderId: string) {
      const state = store.getState();
      const actionKey = `comanda-${orderId}`;
      const current = state.tableActions[actionKey];
      if (current?.status === 'pending') return;

      state.actions.setTableAction(actionKey, {
        id: createId(),
        status: 'pending',
        message: 'Fechando comanda…',
      });

      try {
        const response = await fetch(`/api/orders/${orderId}/close`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        });
        if (!response.ok) {
          const problem = await response.json().catch(() => null);
          store.getState().actions.setTableAction(actionKey, {
            id: current?.id || createId(),
            status: 'error',
            message: readServerMessage(problem, 'Não foi possível fechar a comanda'),
          });
          return;
        }
        store.getState().actions.setTableAction(actionKey, {
          id: current?.id || createId(),
          status: 'created',
          message: 'Comanda fechada com sucesso.',
        });
        store.getState().actions.cancelCloseOrder();
        router.refresh();
      } catch {
        store.getState().actions.setTableAction(actionKey, {
          id: current?.id || createId(),
          status: 'error',
          message:
            'Falha de conexão. Tente novamente para repetir a mesma solicitação com segurança.',
        });
      }
    }

    async function registerPayment(orderId: string, amount: string, method: string) {
      const state = store.getState();
      const key = `payment-${orderId}`;
      const current = state.tableActions[key];
      if (current?.status === 'pending') return;

      state.actions.setTableAction(key, {
        id: createId(),
        status: 'pending',
        message: 'Registrando pagamento…',
      });

      try {
        const response = await fetch(`/api/orders/${orderId}/payments`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ amount, method }),
        });
        if (!response.ok) {
          const problem = await response.json().catch(() => null);
          store.getState().actions.setTableAction(key, {
            id: current?.id || createId(),
            status: 'error',
            message: readServerMessage(problem, 'Não foi possível registrar o pagamento'),
          });
          return;
        }
        store.getState().actions.setTableAction(key, {
          id: current?.id || createId(),
          status: 'created',
          message: 'Pagamento registrado com sucesso.',
        });
        router.refresh();
      } catch {
        store.getState().actions.setTableAction(key, {
          id: current?.id || createId(),
          status: 'error',
          message:
            'Falha de conexão. Tente novamente para repetir a mesma solicitação com segurança.',
        });
      }
    }

    async function addItem(
      orderId: string,
      draft?: Readonly<{ menuItemId: string; quantity: string; notes: string }>,
    ) {
      const state = store.getState();
      const current = state.itemActions[orderId];
      if (current?.status === 'pending') return;
      const id = current?.status === 'error' ? current.id : createId();
      const menuItemId =
        current?.status === 'error' && current.payload
          ? current.payload.menuItemId
          : (draft?.menuItemId ?? state.selectedItems[orderId] ?? state.menuItems[0]?.id);
      const quantity =
        current?.status === 'error' && current.payload
          ? current.payload.quantity
          : (draft?.quantity ?? state.quantities[orderId] ?? '1');
      const itemNotes =
        current?.status === 'error' && current.payload
          ? current.payload.notes
          : (draft?.notes ?? state.notes[orderId] ?? '');
      if (!menuItemId) return;
      const payload = { menuItemId, quantity: quantity.replace(',', '.'), notes: itemNotes };

      state.actions.setItemAction(orderId, {
        id,
        status: 'pending',
        message: 'Adicionando produto…',
        payload,
      });

      try {
        const response = await fetch(`/api/orders/${orderId}/items`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, ...payload }),
        });
        if (!response.ok) {
          store.getState().actions.setItemAction(orderId, {
            id,
            status: 'error',
            payload,
            message:
              response.status >= 500
                ? 'O servidor não confirmou o lançamento. Tente novamente para repetir a mesma solicitação.'
                : 'Não foi possível adicionar o produto. Confira os dados e tente novamente.',
          });
          return;
        }

        const replayed = response.status === 200;
        store.getState().actions.setItemAction(orderId, {
          id,
          status: replayed ? 'replayed' : 'created',
          payload,
          message: replayed
            ? 'Lançamento repetido reconhecido; o item não foi duplicado.'
            : 'Produto adicionado à comanda.',
        });
        store.getState().actions.resetQuickAdd(orderId);
        if (draft) store.getState().actions.resetDetailAddFields();
        router.refresh();
      } catch {
        store.getState().actions.setItemAction(orderId, {
          id,
          status: 'error',
          payload,
          message: 'Falha de conexão. Tente novamente para repetir o lançamento com segurança.',
        });
      }
    }

    async function createProductFromOrder(
      orderId: string,
      name: string,
      target: ProductCreateTarget = 'card',
    ) {
      const state = store.getState();
      if (state.productCreateAction?.status === 'pending') return;
      const id = createId();
      state.actions.setProductCreateAction({
        id,
        status: 'pending',
        message: 'Cadastrando produto…',
      });
      try {
        const response = await fetch('/api/menu-items', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name,
            category: state.newProductCategory,
            price: state.newProductPrice,
          }),
        });
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          store.getState().actions.setProductCreateAction({
            id,
            status: 'error',
            message: readServerMessage(result, 'Não foi possível cadastrar o produto.'),
          });
          return;
        }
        if (!isMenuItem(result)) {
          store.getState().actions.setProductCreateAction({
            id,
            status: 'error',
            message: 'A resposta do cadastro não pôde ser validada. Atualize a página.',
          });
          return;
        }
        store.getState().actions.completeProductCreate(orderId, result, target);
        store.getState().actions.setProductCreateAction({
          id,
          status: 'created',
          message: 'Produto cadastrado e selecionado.',
        });
        router.refresh();
      } catch {
        store.getState().actions.setProductCreateAction({
          id,
          status: 'error',
          message: 'Falha de conexão ao cadastrar o produto.',
        });
      }
    }

    async function saveItem(orderId: string, item: OrderItem) {
      const state = store.getState();
      const draft = state.itemDrafts[item.id] ?? {
        quantity: item.quantity,
        notes: item.notes ?? '',
      };
      state.actions.setItemMutation(item.id, {
        id: item.id,
        status: 'pending',
        message: 'Salvando alterações…',
      });
      try {
        const response = await fetch(`/api/orders/${orderId}/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedVersion: item.version,
            quantity: draft.quantity,
            notes: draft.notes,
          }),
        });
        if (!response.ok) {
          store.getState().actions.setItemMutation(item.id, {
            id: item.id,
            status: 'error',
            message:
              response.status === 409
                ? 'O item mudou em outra sessão. A comanda será atualizada; revise antes de editar novamente.'
                : 'Não foi possível salvar. Atualize a comanda e tente novamente.',
          });
          if (response.status === 409) router.refresh();
          return;
        }
        store.getState().actions.cancelEditingItem();
        store.getState().actions.clearItemMutation(item.id);
        store.getState().actions.clearAddItemFeedback(orderId);
        router.refresh();
      } catch {
        store.getState().actions.setItemMutation(item.id, {
          id: item.id,
          status: 'error',
          message: 'Falha de conexão. Atualize a comanda para confirmar o estado do item.',
        });
        router.refresh();
      }
    }

    async function removeItem(orderId: string, item: OrderItem) {
      const state = store.getState();
      if (state.pendingDeletion !== item.id) {
        state.actions.requestDeleteItem(item.id);
        return;
      }
      state.actions.setItemMutation(item.id, {
        id: item.id,
        status: 'pending',
        message: 'Removendo item…',
      });
      try {
        const response = await fetch(`/api/orders/${orderId}/items/${item.id}`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ expectedVersion: item.version }),
        });
        if (!response.ok) {
          store.getState().actions.setItemMutation(item.id, {
            id: item.id,
            status: 'error',
            message:
              response.status === 409
                ? 'O item mudou em outra sessão. A comanda será atualizada.'
                : 'Não foi possível remover o item. Atualize a comanda e tente novamente.',
          });
          if (response.status === 409) router.refresh();
          return;
        }
        store.getState().actions.cancelDeleteItem();
        store.getState().actions.cancelEditingItem();
        store.getState().actions.clearItemMutation(item.id);
        store.getState().actions.clearAddItemFeedback(orderId);
        router.refresh();
      } catch {
        store.getState().actions.setItemMutation(item.id, {
          id: item.id,
          status: 'error',
          message: 'Falha de conexão. Atualize a comanda para confirmar o estado do item.',
        });
        store.getState().actions.cancelDeleteItem();
        router.refresh();
      }
    }

    return {
      saveViewPreference,
      saveComandaNumbers,
      openOrder,
      closeOrder,
      registerPayment,
      addItem,
      createProductFromOrder,
      saveItem,
      removeItem,
    };
  }, [router, store]);
}
