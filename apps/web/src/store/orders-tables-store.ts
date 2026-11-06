import { createStore } from 'zustand/vanilla';
import type { TablesComandasView } from '@/lib/server/tables-comandas-view';
import { sortMenuItems } from '../lib/product-search';
import type {
  ActionState,
  ItemDraft,
  MenuItem,
  OrderItem,
  OrdersTablesStoreInitial,
  OrdersTablesTab,
  PaymentMethod,
  PreferenceStatus,
  ProductCreateTarget,
  RealtimeStatus,
} from '../lib/types';

type OrdersTablesState = Readonly<{
  view: TablesComandasView;
  comandasTab: OrdersTablesTab;
  propertiesOpen: boolean;
  preferenceStatus: PreferenceStatus;
  comandaNumbers: string;
  comandaNumbersError: string;
  comandaNumbersStatus: PreferenceStatus;
  comandaPage: number;
  pendingComandaNumber: number | null;
  selectedComandaOrderId: string | null;
  dialogOrderId: string | null;
  menuItems: readonly MenuItem[];
  tableActions: Readonly<Record<string, ActionState>>;
  itemActions: Readonly<Record<string, ActionState>>;
  quickAddOrders: Readonly<Record<string, boolean>>;
  selectedItems: Readonly<Record<string, string>>;
  quantities: Readonly<Record<string, string>>;
  notes: Readonly<Record<string, string>>;
  searches: Readonly<Record<string, string>>;
  productDropdownOpen: Readonly<Record<string, boolean>>;
  creatingProductFor: string | null;
  newProductCategory: string;
  newProductPrice: string;
  productCreateAction: ActionState | null;
  detailAddOpen: boolean;
  detailProductId: string;
  detailProductSearch: string;
  detailProductDropdownOpen: boolean;
  detailQuantity: string;
  detailNotes: string;
  editingItem: string | null;
  itemDrafts: Readonly<Record<string, ItemDraft>>;
  itemMutation: Readonly<Record<string, ActionState>>;
  pendingDeletion: string | null;
  paymentAmounts: Readonly<Record<string, string>>;
  paymentMethods: Readonly<Record<string, PaymentMethod>>;
  collapsedPaymentOrders: Readonly<Record<string, boolean>>;
  closeConfirmOrderId: string | null;
  focusOrderId: string | null;
  realtimeStatus: RealtimeStatus;
}>;

type OrdersTablesActions = Readonly<{
  setView: (view: TablesComandasView) => void;
  setComandasTab: (tab: OrdersTablesTab) => void;
  toggleProperties: () => void;
  setPreferenceStatus: (status: PreferenceStatus) => void;
  setComandaNumbers: (value: string) => void;
  setComandaNumbersError: (value: string) => void;
  setComandaNumbersStatus: (status: PreferenceStatus) => void;
  setComandaPage: (page: number) => void;
  requestOpenComanda: (comandaNumber: number) => void;
  clearPendingComanda: () => void;
  selectComandaOrder: (orderId: string) => void;
  showOrderDetails: (orderId: string) => void;
  hideOrderDetails: () => void;
  setTableAction: (key: string, action: ActionState) => void;
  setItemAction: (orderId: string, action: ActionState) => void;
  clearAddItemFeedback: (orderId: string) => void;
  clearItemError: (orderId: string) => void;
  syncMenuItems: (menuItems: readonly MenuItem[]) => void;
  toggleQuickAdd: (orderId: string) => void;
  setQuickAddOpen: (orderId: string, open: boolean) => void;
  updateQuickAddSearch: (orderId: string, search: string) => void;
  selectQuickAddProduct: (orderId: string, item: MenuItem) => void;
  setQuickAddDropdownOpen: (orderId: string, open: boolean) => void;
  setQuickAddQuantity: (orderId: string, quantity: string) => void;
  setQuickAddNotes: (orderId: string, notes: string) => void;
  resetQuickAdd: (orderId: string) => void;
  openDetailAddForm: () => void;
  closeDetailAddForm: () => void;
  updateDetailProductSearch: (search: string) => void;
  selectDetailProduct: (item: MenuItem) => void;
  setDetailProductDropdownOpen: (open: boolean) => void;
  setDetailQuantity: (quantity: string) => void;
  setDetailNotes: (notes: string) => void;
  resetDetailAddFields: () => void;
  startProductCreate: (orderId: string) => void;
  cancelProductCreate: () => void;
  setNewProductCategory: (value: string) => void;
  setNewProductPrice: (value: string) => void;
  setProductCreateAction: (action: ActionState | null) => void;
  completeProductCreate: (
    orderId: string,
    createdItem: MenuItem,
    target: ProductCreateTarget,
  ) => void;
  startEditingItem: (item: OrderItem) => void;
  cancelEditingItem: () => void;
  updateItemDraft: (itemId: string, draft: Partial<ItemDraft>) => void;
  setItemMutation: (itemId: string, action: ActionState) => void;
  clearItemMutation: (itemId: string) => void;
  requestDeleteItem: (itemId: string) => void;
  cancelDeleteItem: () => void;
  setPaymentAmount: (orderId: string, amount: string) => void;
  setPaymentMethod: (orderId: string, method: PaymentMethod) => void;
  togglePaymentSection: (orderId: string) => void;
  requestCloseOrder: (orderId: string) => void;
  cancelCloseOrder: () => void;
  requestOrderFocus: (orderId: string) => void;
  clearOrderFocus: () => void;
  setRealtimeStatus: (status: RealtimeStatus) => void;
}>;

export type OrdersTablesStore = OrdersTablesState & { actions: OrdersTablesActions };

function withoutKey<TValue>(record: Readonly<Record<string, TValue>>, key: string) {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

export function createOrdersTablesStore(initial: OrdersTablesStoreInitial) {
  return createStore<OrdersTablesStore>()((set, get) => ({
    view: initial.view,
    comandasTab: 'MAP_WITH_CARDS',
    propertiesOpen: false,
    preferenceStatus: 'idle',
    comandaNumbers: initial.comandaNumbers,
    comandaNumbersError: '',
    comandaNumbersStatus: 'idle',
    comandaPage: 0,
    pendingComandaNumber: null,
    selectedComandaOrderId: null,
    dialogOrderId: null,
    menuItems: sortMenuItems(initial.menuItems),
    tableActions: {},
    itemActions: {},
    quickAddOrders: {},
    selectedItems: {},
    quantities: {},
    notes: {},
    searches: {},
    productDropdownOpen: {},
    creatingProductFor: null,
    newProductCategory: '',
    newProductPrice: '',
    productCreateAction: null,
    detailAddOpen: false,
    detailProductId: '',
    detailProductSearch: '',
    detailProductDropdownOpen: false,
    detailQuantity: '1',
    detailNotes: '',
    editingItem: null,
    itemDrafts: {},
    itemMutation: {},
    pendingDeletion: null,
    paymentAmounts: {},
    paymentMethods: {},
    collapsedPaymentOrders: {},
    closeConfirmOrderId: null,
    focusOrderId: null,
    realtimeStatus: 'connecting',
    actions: {
      setView: (view) => set({ view }),
      setComandasTab: (comandasTab) =>
        set({
          comandasTab,
          pendingComandaNumber: null,
          detailAddOpen: false,
          detailProductSearch: '',
          detailProductDropdownOpen: false,
          closeConfirmOrderId: null,
          creatingProductFor: null,
          newProductCategory: '',
          newProductPrice: '',
          productCreateAction: null,
        }),
      toggleProperties: () => set((state) => ({ propertiesOpen: !state.propertiesOpen })),
      setPreferenceStatus: (preferenceStatus) => set({ preferenceStatus }),
      setComandaNumbers: (comandaNumbers) => set({ comandaNumbers }),
      setComandaNumbersError: (comandaNumbersError) => set({ comandaNumbersError }),
      setComandaNumbersStatus: (comandaNumbersStatus) => set({ comandaNumbersStatus }),
      setComandaPage: (comandaPage) => set({ comandaPage: Math.max(0, comandaPage) }),
      requestOpenComanda: (pendingComandaNumber) =>
        set({
          pendingComandaNumber,
          detailAddOpen: false,
          detailProductSearch: '',
          detailProductDropdownOpen: false,
          closeConfirmOrderId: null,
          creatingProductFor: null,
          newProductCategory: '',
          newProductPrice: '',
          productCreateAction: null,
        }),
      clearPendingComanda: () => set({ pendingComandaNumber: null }),
      selectComandaOrder: (selectedComandaOrderId) =>
        set({
          selectedComandaOrderId,
          pendingComandaNumber: null,
          detailAddOpen: false,
          detailProductId: '',
          detailProductSearch: '',
          detailProductDropdownOpen: false,
          detailQuantity: '1',
          detailNotes: '',
          closeConfirmOrderId: null,
          creatingProductFor: null,
          newProductCategory: '',
          newProductPrice: '',
          productCreateAction: null,
        }),
      showOrderDetails: (dialogOrderId) => set({ dialogOrderId }),
      hideOrderDetails: () => set({ dialogOrderId: null }),
      setTableAction: (key, action) =>
        set((state) => ({ tableActions: { ...state.tableActions, [key]: action } })),
      setItemAction: (orderId, action) =>
        set((state) => ({ itemActions: { ...state.itemActions, [orderId]: action } })),
      clearAddItemFeedback: (orderId) =>
        set((state) => ({ itemActions: withoutKey(state.itemActions, orderId) })),
      clearItemError: (orderId) =>
        set((state) =>
          state.itemActions[orderId]?.status === 'error'
            ? { itemActions: withoutKey(state.itemActions, orderId) }
            : state,
        ),
      syncMenuItems: (menuItems) => set({ menuItems: sortMenuItems(menuItems) }),
      toggleQuickAdd: (orderId) =>
        set((state) => ({
          quickAddOrders: {
            ...state.quickAddOrders,
            [orderId]: !state.quickAddOrders[orderId],
          },
        })),
      setQuickAddOpen: (orderId, open) =>
        set((state) => ({ quickAddOrders: { ...state.quickAddOrders, [orderId]: open } })),
      updateQuickAddSearch: (orderId, search) =>
        set((state) => ({
          selectedItems: { ...state.selectedItems, [orderId]: '' },
          searches: { ...state.searches, [orderId]: search },
          productDropdownOpen: { ...state.productDropdownOpen, [orderId]: true },
        })),
      selectQuickAddProduct: (orderId, item) =>
        set((state) => ({
          selectedItems: { ...state.selectedItems, [orderId]: item.id },
          searches: { ...state.searches, [orderId]: item.name },
          productDropdownOpen: { ...state.productDropdownOpen, [orderId]: false },
        })),
      setQuickAddDropdownOpen: (orderId, open) =>
        set((state) => ({
          productDropdownOpen: { ...state.productDropdownOpen, [orderId]: open },
        })),
      setQuickAddQuantity: (orderId, quantity) =>
        set((state) => ({ quantities: { ...state.quantities, [orderId]: quantity } })),
      setQuickAddNotes: (orderId, notes) =>
        set((state) => ({ notes: { ...state.notes, [orderId]: notes } })),
      resetQuickAdd: (orderId) =>
        set((state) => ({
          quickAddOrders: { ...state.quickAddOrders, [orderId]: false },
          selectedItems: withoutKey(state.selectedItems, orderId),
          searches: { ...state.searches, [orderId]: '' },
          quantities: { ...state.quantities, [orderId]: '1' },
          notes: withoutKey(state.notes, orderId),
          productDropdownOpen: { ...state.productDropdownOpen, [orderId]: false },
        })),
      openDetailAddForm: () => {
        const firstItem = get().menuItems[0];
        set({
          detailAddOpen: true,
          detailProductId: firstItem?.id ?? '',
          detailProductSearch: firstItem?.name ?? '',
          detailProductDropdownOpen: false,
          detailQuantity: '1',
          detailNotes: '',
          creatingProductFor: null,
          productCreateAction: null,
        });
      },
      closeDetailAddForm: () => {
        const state = get();
        set({
          detailAddOpen: false,
          detailProductId: '',
          detailProductSearch: '',
          detailProductDropdownOpen: false,
          detailQuantity: '1',
          detailNotes: '',
          creatingProductFor:
            state.creatingProductFor === state.selectedComandaOrderId
              ? null
              : state.creatingProductFor,
          productCreateAction: null,
        });
      },
      updateDetailProductSearch: (detailProductSearch) =>
        set({
          detailProductId: '',
          detailProductSearch,
          detailProductDropdownOpen: true,
          productCreateAction: null,
        }),
      selectDetailProduct: (item) =>
        set({
          detailProductId: item.id,
          detailProductSearch: item.name,
          detailProductDropdownOpen: false,
          creatingProductFor: null,
          productCreateAction: null,
        }),
      setDetailProductDropdownOpen: (detailProductDropdownOpen) =>
        set({ detailProductDropdownOpen }),
      setDetailQuantity: (detailQuantity) => set({ detailQuantity }),
      setDetailNotes: (detailNotes) => set({ detailNotes }),
      resetDetailAddFields: () =>
        set({
          detailProductId: '',
          detailProductSearch: '',
          detailProductDropdownOpen: false,
          detailQuantity: '1',
          detailNotes: '',
        }),
      startProductCreate: (creatingProductFor) =>
        set({
          creatingProductFor,
          newProductCategory: '',
          newProductPrice: '',
          productCreateAction: null,
          detailProductDropdownOpen: false,
        }),
      cancelProductCreate: () =>
        set({
          creatingProductFor: null,
          newProductCategory: '',
          newProductPrice: '',
          productCreateAction: null,
        }),
      setNewProductCategory: (newProductCategory) => set({ newProductCategory }),
      setNewProductPrice: (newProductPrice) => set({ newProductPrice }),
      setProductCreateAction: (productCreateAction) => set({ productCreateAction }),
      completeProductCreate: (orderId, createdItem, target) => {
        const state = get();
        set({
          menuItems: sortMenuItems([...state.menuItems, createdItem]),
          ...(target === 'detail'
            ? {
                detailProductId: createdItem.id,
                detailProductSearch: createdItem.name,
                detailProductDropdownOpen: false,
              }
            : {
                selectedItems: { ...state.selectedItems, [orderId]: createdItem.id },
                searches: { ...state.searches, [orderId]: createdItem.name },
              }),
          creatingProductFor: null,
          newProductCategory: '',
          newProductPrice: '',
        });
      },
      startEditingItem: (item) =>
        set((state) => ({
          editingItem: item.id,
          itemDrafts: {
            ...state.itemDrafts,
            [item.id]: { quantity: item.quantity, notes: item.notes ?? '' },
          },
        })),
      cancelEditingItem: () => set({ editingItem: null }),
      updateItemDraft: (itemId, draft) =>
        set((state) => ({
          itemDrafts: {
            ...state.itemDrafts,
            [itemId]: {
              ...(state.itemDrafts[itemId] ?? { quantity: '', notes: '' }),
              ...draft,
            },
          },
        })),
      setItemMutation: (itemId, action) =>
        set((state) => ({ itemMutation: { ...state.itemMutation, [itemId]: action } })),
      clearItemMutation: (itemId) =>
        set((state) => ({ itemMutation: withoutKey(state.itemMutation, itemId) })),
      requestDeleteItem: (pendingDeletion) => set({ pendingDeletion }),
      cancelDeleteItem: () => set({ pendingDeletion: null }),
      setPaymentAmount: (orderId, amount) =>
        set((state) => ({ paymentAmounts: { ...state.paymentAmounts, [orderId]: amount } })),
      setPaymentMethod: (orderId, method) =>
        set((state) => ({ paymentMethods: { ...state.paymentMethods, [orderId]: method } })),
      togglePaymentSection: (orderId) =>
        set((state) => ({
          collapsedPaymentOrders: {
            ...state.collapsedPaymentOrders,
            [orderId]: !state.collapsedPaymentOrders[orderId],
          },
        })),
      requestCloseOrder: (closeConfirmOrderId) => set({ closeConfirmOrderId }),
      cancelCloseOrder: () => set({ closeConfirmOrderId: null }),
      requestOrderFocus: (focusOrderId) => set({ focusOrderId }),
      clearOrderFocus: () => set({ focusOrderId: null }),
      setRealtimeStatus: (realtimeStatus) => set({ realtimeStatus }),
    },
  }));
}

export type OrdersTablesStoreApi = ReturnType<typeof createOrdersTablesStore>;
