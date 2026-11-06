'use client';

import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { formatMoney, formatTime } from '@/lib/format';
import { OrderItemView } from '../order-item-view';
import { filterMenuItems, normalizeProductSearch } from '@/lib/product-search';
import { useOrdersTables, useOrdersTablesActions } from '@/store';
import type { Order } from '@/lib/types';
import { useOrdersTablesApi } from '@/hooks';
import type { TablesComandasView } from '@/lib/server/tables-comandas-view';

export function OrderCard({
  order,
  view,
  tableNumbers,
  canManageMenu,
}: Readonly<{
  order: Order;
  view: TablesComandasView;
  tableNumbers: ReadonlyMap<string, number>;
  canManageMenu: boolean;
}>) {
  const {
    quickAddOrders,
    selectedItems,
    quantities,
    notes,
    searches,
    productDropdownOpen,
    menuItems,
    creatingProductFor,
    newProductCategory,
    newProductPrice,
    productCreateAction,
    itemActions,
  } = useOrdersTables((state) => ({
    quickAddOrders: state.quickAddOrders,
    selectedItems: state.selectedItems,
    quantities: state.quantities,
    notes: state.notes,
    searches: state.searches,
    productDropdownOpen: state.productDropdownOpen,
    menuItems: state.menuItems,
    creatingProductFor: state.creatingProductFor,
    newProductCategory: state.newProductCategory,
    newProductPrice: state.newProductPrice,
    productCreateAction: state.productCreateAction,
    itemActions: state.itemActions,
  }));
  const quickAddOpen = Boolean(quickAddOrders[order.id]);
  const selectedItem = selectedItems[order.id];
  const quantity = quantities[order.id] ?? '1';
  const orderNotes = notes[order.id] ?? '';
  const search = searches[order.id] ?? '';
  const dropdownOpen = Boolean(productDropdownOpen[order.id]);
  const action = itemActions[order.id];
  const actions = useOrdersTablesActions();
  const api = useOrdersTablesApi();
  const productInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (quickAddOpen) productInputRef.current?.focus();
  }, [quickAddOpen]);

  const normalizedSearch = normalizeProductSearch(search);
  const availableItems = filterMenuItems(menuItems, search);
  const selectedMenuItemId = menuItems.some((item) => item.id === selectedItem)
    ? selectedItem
    : normalizedSearch
      ? ''
      : (menuItems[0]?.id ?? '');
  const selectedMenuItem = menuItems.find((item) => item.id === selectedMenuItemId);
  const lastItems = order.items.slice(-3);
  const tableNumber = order.tableId ? tableNumbers.get(order.tableId) : undefined;
  const title =
    view === 'COMANDA'
      ? `Comanda ${order.comandaNumber ?? '—'}`
      : tableNumber !== undefined
        ? `Mesa ${String(tableNumber).padStart(2, '0')}`
        : 'Sem mesa';
  const quantityNumber = Number(quantity.replace(',', '.'));

  return (
    <li className="order-card" id={`order-card-${order.id}`}>
      <div className="order-card-heading">
        <div>
          <strong>{title}</strong>
          <span>Aberta às {formatTime(order.createdAt)}</span>
        </div>
        <strong className="order-total">{formatMoney(order.total)}</strong>
      </div>
      <div aria-label="Produtos da comanda" className="order-recent-items">
        {order.items.length === 0 ? (
          <p className="order-empty">Nenhum item lançado ainda.</p>
        ) : (
          <>
            <ul className="order-item-list">
              {lastItems.map((item) => (
                <OrderItemView context="card" item={item} key={item.id} orderId={order.id} />
              ))}
            </ul>
            {order.items.length > 3 ? (
              <button
                aria-label={`Ver todos os ${order.items.length} itens da comanda`}
                className="more-items-trigger"
                onClick={() => actions.showOrderDetails(order.id)}
                title="Ver todos os itens da comanda"
                type="button"
              >
                <MoreHorizontal aria-hidden="true" size={18} />
              </button>
            ) : null}
          </>
        )}
      </div>
      <div className="order-card-actions">
        <button
          aria-controls={quickAddOpen ? `quick-add-${order.id}` : undefined}
          aria-expanded={quickAddOpen}
          className="quick-add-trigger"
          onClick={() => actions.toggleQuickAdd(order.id)}
          type="button"
        >
          {quickAddOpen ? 'Cancelar' : '+ Adicionar item'}
        </button>
        <button
          className="text-button"
          onClick={() => actions.showOrderDetails(order.id)}
          type="button"
        >
          Ver comanda
        </button>
      </div>
      {quickAddOpen ? (
        <div className="quick-add-panel" id={`quick-add-${order.id}`}>
          {menuItems.length === 0 ? (
            <div className="order-empty">
              <p>Nenhum produto ativo no cardápio.</p>
              {canManageMenu ? (
                <Link className="text-link" href="/menu">
                  Cadastrar produtos
                </Link>
              ) : (
                <p>Peça a um administrador para cadastrar os produtos.</p>
              )}
            </div>
          ) : (
            <div className="add-item-form">
              <strong>Adicionar item</strong>
              <label className="product-field">
                Produto
                <input
                  aria-autocomplete="list"
                  aria-controls={
                    availableItems.length > 0 ? `product-options-${order.id}` : undefined
                  }
                  aria-expanded={dropdownOpen && availableItems.length > 0}
                  autoComplete="off"
                  onChange={(event) => {
                    actions.clearItemError(order.id);
                    actions.updateQuickAddSearch(order.id, event.target.value);
                  }}
                  onFocus={(event) => {
                    event.currentTarget.select();
                    actions.setQuickAddDropdownOpen(order.id, true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      actions.setQuickAddDropdownOpen(order.id, false);
                      return;
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      actions.setQuickAddDropdownOpen(order.id, true);
                      return;
                    }
                    if (event.key === 'Enter' && dropdownOpen) {
                      const item = availableItems[0];
                      if (item) {
                        event.preventDefault();
                        actions.clearItemError(order.id);
                        actions.selectQuickAddProduct(order.id, item);
                      }
                    }
                  }}
                  placeholder="Buscar produto"
                  ref={productInputRef}
                  role="combobox"
                  value={search || selectedMenuItem?.name || menuItems[0]?.name || ''}
                />
                {dropdownOpen && availableItems.length > 0 ? (
                  <div
                    className="product-options"
                    id={`product-options-${order.id}`}
                    role="listbox"
                  >
                    {availableItems.map((item) => (
                      <button
                        aria-selected={item.id === selectedMenuItemId}
                        key={item.id}
                        onClick={() => {
                          actions.clearItemError(order.id);
                          actions.selectQuickAddProduct(order.id, item);
                        }}
                        role="option"
                        type="button"
                      >
                        <span>{item.name}</span>
                        <small>{formatMoney(item.price)}</small>
                      </button>
                    ))}
                  </div>
                ) : dropdownOpen && availableItems.length === 0 ? (
                  <span className="product-no-results">Nenhum produto encontrado.</span>
                ) : null}
              </label>
              <label className="quantity-field">
                Qtd.
                <input
                  inputMode="decimal"
                  onChange={(event) => {
                    actions.clearItemError(order.id);
                    actions.setQuickAddQuantity(order.id, event.target.value);
                  }}
                  placeholder="1 ou 0,340"
                  type="text"
                  value={quantity}
                />
              </label>
              <label className="add-item-notes">
                Observação (opcional)
                <input
                  maxLength={500}
                  onChange={(event) => {
                    actions.clearItemError(order.id);
                    actions.setQuickAddNotes(order.id, event.target.value);
                  }}
                  placeholder="Ex.: sem gelo"
                  type="text"
                  value={orderNotes}
                />
              </label>
              <button
                className="primary-button"
                disabled={
                  action?.status === 'pending' ||
                  !selectedMenuItemId ||
                  !Number.isFinite(quantityNumber) ||
                  quantityNumber <= 0
                }
                onClick={() => void api.addItem(order.id)}
                type="button"
              >
                {action?.status === 'pending'
                  ? 'Adicionando…'
                  : action?.status === 'error'
                    ? 'Tentar novamente'
                    : 'Adicionar produto'}
              </button>
              {canManageMenu && availableItems.length === 0 && normalizedSearch ? (
                <div className="inline-product-create">
                  {creatingProductFor === order.id ? (
                    <>
                      <strong>Cadastrar “{search}”</strong>
                      <label>
                        Categoria
                        <input
                          onChange={(event) => actions.setNewProductCategory(event.target.value)}
                          placeholder="Ex.: Buffet"
                          value={newProductCategory}
                        />
                      </label>
                      <label>
                        Preço (R$)
                        <input
                          inputMode="decimal"
                          onChange={(event) => actions.setNewProductPrice(event.target.value)}
                          placeholder="Ex.: 64,90"
                          value={newProductPrice}
                        />
                      </label>
                      <button
                        className="text-button"
                        disabled={productCreateAction?.status === 'pending'}
                        onClick={() =>
                          void api.createProductFromOrder(order.id, search.trim(), 'card')
                        }
                        type="button"
                      >
                        {productCreateAction?.status === 'pending'
                          ? 'Salvando…'
                          : 'Salvar e selecionar'}
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-button"
                      onClick={() => actions.startProductCreate(order.id)}
                      type="button"
                    >
                      Cadastrar produto (administrador)
                    </button>
                  )}
                  {creatingProductFor === order.id && productCreateAction ? (
                    <p
                      className={
                        productCreateAction.status === 'error'
                          ? 'action-feedback action-error'
                          : 'action-feedback'
                      }
                      role={productCreateAction.status === 'error' ? 'alert' : 'status'}
                    >
                      {productCreateAction.message}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
      {action ? (
        <p
          className={action.status === 'error' ? 'action-feedback action-error' : 'action-feedback'}
          role={action.status === 'error' ? 'alert' : 'status'}
        >
          {action.message}
        </p>
      ) : null}
    </li>
  );
}
