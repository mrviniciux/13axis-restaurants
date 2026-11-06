'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type MenuItem = Readonly<{
  id: string;
  name: string;
  category: string;
  price: string;
}>;

export function MenuCatalogManager({
  initialItems,
}: Readonly<{ initialItems: readonly MenuItem[] }>) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState<{ kind: 'error' | 'success'; message: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch('/api/menu-items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, category, price }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const detail =
          result !== null && typeof result === 'object' && 'detail' in result &&
          typeof result.detail === 'string'
            ? result.detail
            : 'Não foi possível cadastrar o produto.';
        setStatus({ kind: 'error', message: detail });
        return;
      }
      if (
        result === null ||
        typeof result !== 'object' ||
        !('id' in result) ||
        typeof result.id !== 'string' ||
        !('name' in result) ||
        typeof result.name !== 'string' ||
        !('category' in result) ||
        typeof result.category !== 'string' ||
        !('price' in result) ||
        typeof result.price !== 'string'
      ) {
        setStatus({
          kind: 'error',
          message: 'A resposta do cadastro não pôde ser validada. Atualize a página.',
        });
        return;
      }
      const createdItem: MenuItem = {
        id: result.id,
        name: result.name,
        category: result.category,
        price: result.price,
      };
      setItems((current) => [...current, createdItem]);
      setName('');
      setCategory('');
      setPrice('');
      setStatus({ kind: 'success', message: 'Produto cadastrado e disponível para lançamento.' });
      router.refresh();
    } catch {
      setStatus({ kind: 'error', message: 'Falha de conexão ao cadastrar o produto.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="menu-catalog-heading" className="menu-catalog">
      <header className="page-heading">
        <div>
          <h1 id="menu-catalog-heading">Cardápio</h1>
          <p className="page-description">Cadastre os produtos e preços usados nas comandas.</p>
        </div>
      </header>

      <div className="menu-catalog-grid">
        <form className="menu-product-form" onSubmit={(event) => void createProduct(event)}>
          <h2>Cadastrar produto</h2>
          <label>
            Produto
            <input
              autoComplete="off"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label>
            Categoria
            <input
              autoComplete="off"
              maxLength={80}
              onChange={(event) => setCategory(event.target.value)}
              required
              value={category}
            />
          </label>
          <label>
            Preço (R$)
            <input
              inputMode="decimal"
              onChange={(event) => setPrice(event.target.value)}
              placeholder="Ex.: 64,90"
              required
              value={price}
            />
          </label>
          <button className="primary-button" disabled={saving} type="submit">
            {saving ? 'Salvando…' : 'Cadastrar produto'}
          </button>
          {status ? (
            <p className={status.kind === 'error' ? 'action-feedback action-error' : 'action-feedback'} role={status.kind === 'error' ? 'alert' : 'status'}>
              {status.message}
            </p>
          ) : null}
        </form>

        <section aria-labelledby="menu-products-heading" className="menu-products-list">
          <h2 id="menu-products-heading">Produtos ativos ({items.length})</h2>
          {items.length === 0 ? (
            <p className="order-empty">Nenhum produto cadastrado.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.category}</small>
                  </span>
                  <strong>
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    }).format(Number(item.price))}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
