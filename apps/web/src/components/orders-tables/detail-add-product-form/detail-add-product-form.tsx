'use client';

import Link from 'next/link';
import { formatMoney } from '@/lib/format';
import { filterMenuItems, findExactMenuItem, normalizeProductSearch } from '@/lib/product-search';
import { useOrdersTables, useOrdersTablesActions } from '@/store';
import type { MenuItem, Order } from '@/lib/types';
import { useOrdersTablesApi } from '@/hooks';

export function DetailAddProductForm({
  order,
  canManageMenu,
}: Readonly<{
  order: Order;
  canManageMenu: boolean;
}>) {
  const {
    detailAddOpen: open,
    detailProductId: productId,
    detailProductSearch: productSearch,
    detailProductDropdownOpen: dropdownOpen,
    detailQuantity: quantity,
    detailNotes: notes,
    menuItems,
    creatingProductFor,
    newProductCategory,
    newProductPrice,
    productCreateAction,
  } = useOrdersTables((state) => ({
    detailAddOpen: state.detailAddOpen,
    detailProductId: state.detailProductId,
    detailProductSearch: state.detailProductSearch,
    detailProductDropdownOpen: state.detailProductDropdownOpen,
    detailQuantity: state.detailQuantity,
    detailNotes: state.detailNotes,
    menuItems: state.menuItems,
    creatingProductFor: state.creatingProductFor,
    newProductCategory: state.newProductCategory,
    newProductPrice: state.newProductPrice,
    productCreateAction: state.productCreateAction,
  }));
  const addAction = useOrdersTables((state) => state.itemActions[order.id]);
  const actions = useOrdersTablesActions();
  const api = useOrdersTablesApi();

  const normalizedSearch = normalizeProductSearch(productSearch);
  const availableItems = filterMenuItems(menuItems, productSearch);
  const exactMatch = findExactMenuItem(menuItems, productSearch);
  const selectedMenuItemId = menuItems.some((item) => item.id === productId)
    ? productId
    : (exactMatch?.id ?? '');
  const quantityNumber = Number(quantity.replace(',', '.'));
  const creating = creatingProductFor === order.id;

  function selectProduct(item: MenuItem) {
    actions.clearItemError(order.id);
    actions.selectDetailProduct(item);
  }

  function closeForm() {
    actions.closeDetailAddForm();
    actions.clearAddItemFeedback(order.id);
  }

  if (!open) {
    return (
      <div className="comanda-detail-add">
        <button
          className="comanda-detail-add-trigger"
          onClick={() => {
            actions.clearAddItemFeedback(order.id);
            actions.openDetailAddForm();
          }}
          type="button"
        >
          + Adicionar produto
        </button>
      </div>
    );
  }

  return (
    <div className="comanda-detail-add">
      <div className="comanda-detail-add-form">
        <div className="comanda-detail-add-heading">
          <strong>Adicionar produto</strong>
          <button className="text-button" onClick={closeForm} type="button">
            Fechar
          </button>
        </div>
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
          <>
            <div className="comanda-detail-add-fields">
              <label className="comanda-detail-add-product product-field">
                Produto
                <input
                  aria-autocomplete="list"
                  aria-controls={
                    availableItems.length > 0 ? `detail-product-options-${order.id}` : undefined
                  }
                  aria-expanded={dropdownOpen && availableItems.length > 0}
                  autoComplete="off"
                  onChange={(event) => {
                    actions.clearItemError(order.id);
                    actions.updateDetailProductSearch(event.target.value);
                  }}
                  onFocus={(event) => {
                    event.currentTarget.select();
                    actions.setDetailProductDropdownOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      actions.setDetailProductDropdownOpen(false);
                      return;
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      actions.setDetailProductDropdownOpen(true);
                      return;
                    }
                    if (event.key === 'Enter' && dropdownOpen) {
                      const item = availableItems[0];
                      if (item) {
                        event.preventDefault();
                        selectProduct(item);
                      }
                    }
                  }}
                  placeholder="Buscar produto"
                  role="combobox"
                  value={productSearch}
                />
                {dropdownOpen && availableItems.length > 0 ? (
                  <div
                    className="product-options"
                    id={`detail-product-options-${order.id}`}
                    role="listbox"
                  >
                    {availableItems.map((item) => (
                      <button
                        aria-selected={item.id === selectedMenuItemId}
                        key={item.id}
                        onClick={() => selectProduct(item)}
                        role="option"
                        type="button"
                      >
                        <span>{item.name}</span>
                        <small>{formatMoney(item.price)}</small>
                      </button>
                    ))}
                  </div>
                ) : dropdownOpen ? (
                  <span className="product-no-results">Nenhum produto encontrado.</span>
                ) : null}
              </label>
              <label>
                Qtd.
                <input
                  inputMode="decimal"
                  onChange={(event) => {
                    actions.clearItemError(order.id);
                    actions.setDetailQuantity(event.target.value);
                  }}
                  placeholder="1 ou 0,340"
                  type="text"
                  value={quantity}
                />
              </label>
              <label className="comanda-detail-add-notes">
                Observação
                <input
                  maxLength={500}
                  onChange={(event) => {
                    actions.clearItemError(order.id);
                    actions.setDetailNotes(event.target.value);
                  }}
                  placeholder="Ex.: sem gelo"
                  type="text"
                  value={notes}
                />
              </label>
            </div>
            {normalizedSearch && availableItems.length === 0 ? (
              <div className="inline-product-create comanda-detail-product-create">
                {creating ? (
                  <>
                    <strong>Cadastrar “{productSearch.trim()}”</strong>
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
                        void api.createProductFromOrder(order.id, productSearch.trim(), 'detail')
                      }
                      type="button"
                    >
                      {productCreateAction?.status === 'pending'
                        ? 'Salvando…'
                        : 'Salvar e selecionar'}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => actions.cancelProductCreate()}
                      type="button"
                    >
                      Cancelar cadastro
                    </button>
                  </>
                ) : canManageMenu ? (
                  <button
                    className="text-button"
                    onClick={() => actions.startProductCreate(order.id)}
                    type="button"
                  >
                    Cadastrar “{productSearch.trim()}”
                  </button>
                ) : (
                  <p className="product-no-results">
                    Peça a um administrador para cadastrar este produto.
                  </p>
                )}
                {creating && productCreateAction ? (
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
            <div className="comanda-detail-add-actions">
              <button
                className="primary-button"
                disabled={
                  !selectedMenuItemId ||
                  !Number.isFinite(quantityNumber) ||
                  quantityNumber <= 0 ||
                  addAction?.status === 'pending'
                }
                onClick={() =>
                  void api.addItem(order.id, {
                    menuItemId: selectedMenuItemId,
                    quantity,
                    notes,
                  })
                }
                type="button"
              >
                {addAction?.status === 'pending' ? 'Adicionando…' : 'Adicionar produto'}
              </button>
              <button className="secondary-button" onClick={closeForm} type="button">
                Cancelar
              </button>
            </div>
          </>
        )}
        {addAction ? (
          <p
            className={
              addAction.status === 'error' ? 'action-feedback action-error' : 'action-feedback'
            }
            role={addAction.status === 'error' ? 'alert' : 'status'}
          >
            {addAction.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
