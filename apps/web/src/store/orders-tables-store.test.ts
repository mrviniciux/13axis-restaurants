import { describe, expect, it } from 'vitest';
import { createOrdersTablesStore } from './orders-tables-store';
import type { MenuItem } from '../lib/types';

const menuItems: readonly MenuItem[] = [
  { id: 'pudim', name: 'Pudim', category: 'Sobremesa', price: '9.00' },
  { id: 'buffet', name: 'Buffet Livre', category: 'Buffet', price: '64.90' },
];

function createTestStore() {
  return createOrdersTablesStore({
    view: 'MESA_E_COMANDA',
    comandaNumbers: '{1-3}',
    menuItems,
  });
}

describe('orders tables store', () => {
  it('starts on the map and cards tab with sorted products', () => {
    const store = createTestStore();

    expect(store.getState().comandasTab).toBe('MAP_WITH_CARDS');
    expect(store.getState().menuItems.map((item) => item.id)).toEqual(['buffet', 'pudim']);
  });

  it('closes transient detail state when switching tabs', () => {
    const store = createTestStore();
    store.getState().actions.requestOpenComanda(2);
    store.getState().actions.openDetailAddForm();
    store.getState().actions.requestCloseOrder('order-1');
    store.getState().actions.startProductCreate('order-1');

    store.getState().actions.setComandasTab('CARDS');

    expect(store.getState().comandasTab).toBe('CARDS');
    expect(store.getState().pendingComandaNumber).toBeNull();
    expect(store.getState().detailAddOpen).toBe(false);
    expect(store.getState().detailProductSearch).toBe('');
    expect(store.getState().closeConfirmOrderId).toBeNull();
    expect(store.getState().creatingProductFor).toBeNull();

    store.getState().actions.setComandasTab('LARGE_CARDS');
    expect(store.getState().comandasTab).toBe('LARGE_CARDS');
  });

  it('opens the detail form with the first product and resets it after an add', () => {
    const store = createTestStore();

    store.getState().actions.openDetailAddForm();
    expect(store.getState().detailAddOpen).toBe(true);
    expect(store.getState().detailProductId).toBe('buffet');
    expect(store.getState().detailProductSearch).toBe('Buffet Livre');

    store.getState().actions.updateDetailProductSearch('Pudim');
    store.getState().actions.setDetailQuantity('2');
    store.getState().actions.setDetailNotes('sem calda');
    store.getState().actions.resetDetailAddFields();

    expect(store.getState().detailAddOpen).toBe(true);
    expect(store.getState().detailProductId).toBe('');
    expect(store.getState().detailProductSearch).toBe('');
    expect(store.getState().detailQuantity).toBe('1');
    expect(store.getState().detailNotes).toBe('');
  });

  it('always requests confirmation before closing a comanda', () => {
    const store = createTestStore();

    store.getState().actions.requestCloseOrder('order-1');
    expect(store.getState().closeConfirmOrderId).toBe('order-1');

    store.getState().actions.cancelCloseOrder();
    expect(store.getState().closeConfirmOrderId).toBeNull();

    store.getState().actions.requestCloseOrder('order-1');
    store.getState().actions.selectComandaOrder('order-2');
    expect(store.getState().closeConfirmOrderId).toBeNull();
    expect(store.getState().selectedComandaOrderId).toBe('order-2');
  });

  it('resets the quick add form after a successful launch', () => {
    const store = createTestStore();

    store.getState().actions.toggleQuickAdd('order-1');
    store.getState().actions.updateQuickAddSearch('order-1', 'Pudim');
    store.getState().actions.setQuickAddQuantity('order-1', '2');
    store.getState().actions.setQuickAddNotes('order-1', 'com calda');
    store.getState().actions.selectQuickAddProduct('order-1', menuItems[0]!);

    store.getState().actions.resetQuickAdd('order-1');

    expect(store.getState().quickAddOrders['order-1']).toBe(false);
    expect(store.getState().selectedItems['order-1']).toBeUndefined();
    expect(store.getState().searches['order-1']).toBe('');
    expect(store.getState().quantities['order-1']).toBe('1');
    expect(store.getState().notes['order-1']).toBeUndefined();
  });

  it('adds a created product and selects it in the active form', () => {
    const store = createTestStore();
    const created = {
      id: 'suco',
      name: 'Suco de Laranja',
      category: 'Bebidas',
      price: '12.00',
    };

    store.getState().actions.startProductCreate('order-1');
    store.getState().actions.completeProductCreate('order-1', created, 'detail');

    expect(store.getState().menuItems.some((item) => item.id === 'suco')).toBe(true);
    expect(store.getState().detailProductId).toBe('suco');
    expect(store.getState().detailProductSearch).toBe('Suco de Laranja');
    expect(store.getState().creatingProductFor).toBeNull();
  });

  it('keeps the payment section expanded by default', () => {
    const store = createTestStore();

    expect(store.getState().collapsedPaymentOrders['order-1']).toBeUndefined();
    store.getState().actions.togglePaymentSection('order-1');
    expect(store.getState().collapsedPaymentOrders['order-1']).toBe(true);
  });
});
