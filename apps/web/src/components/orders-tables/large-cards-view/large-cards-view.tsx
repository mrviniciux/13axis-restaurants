'use client';

import {
  ArrowUpDown,
  Bell,
  Check,
  ChevronDown,
  Clock,
  Plus,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/format';
import { useOrdersTables, useOrdersTablesActions } from '@/store';
import { useOrdersTablesApi } from '@/hooks';
import type { Order, Table } from '@/lib/types';

export type LargeCardsFilter = 'ALL' | 'IN_SERVICE' | 'READY' | 'BILL_REQUESTED';
export type LargeCardsSort =
  | 'CUSTOM'
  | 'OLDEST'
  | 'NEWEST'
  | 'HIGHEST_TOTAL'
  | 'LOWEST_TOTAL'
  | 'COMANDA_NUMBER';

const DEMO_METADATA: Record<
  number,
  {
    customer: string;
    tableNumber?: number;
    capacity?: number;
    isBalcao?: boolean;
    mockStatus?: 'IN_SERVICE' | 'READY' | 'BILL_REQUESTED';
    mockTime?: string;
    mockItems?: { quantity: string; name: string }[];
    mockTotal?: string;
  }
> = {
  24: {
    customer: 'Marina',
    tableNumber: 8,
    capacity: 4,
    mockStatus: 'IN_SERVICE',
    mockTime: '52 min',
    mockTotal: '257.40',
    mockItems: [
      { quantity: '1', name: 'Brownie com sorvete' },
      { quantity: '2', name: 'Café espresso' },
    ],
  },
  18: {
    customer: 'Rafael',
    tableNumber: 3,
    capacity: 2,
    mockStatus: 'READY',
    mockTime: '1h 08',
    mockTotal: '184.80',
    mockItems: [
      { quantity: '1', name: 'Risoto de cogumelos' },
      { quantity: '1', name: 'Suco de laranja' },
    ],
  },
  9: {
    customer: 'Camila',
    tableNumber: 12,
    capacity: 2,
    mockStatus: 'BILL_REQUESTED',
    mockTime: '1h 24',
    mockTotal: '96.80',
    mockItems: [
      { quantity: '1', name: 'Água com gás' },
      { quantity: '1', name: 'Burger da casa' },
    ],
  },
  27: {
    customer: 'Fernando',
    tableNumber: 10,
    capacity: 6,
    mockStatus: 'IN_SERVICE',
    mockTime: '46 min',
    mockTotal: '369.60',
    mockItems: [
      { quantity: '2', name: 'Burger da casa' },
      { quantity: '1', name: 'Suco de laranja' },
    ],
  },
  31: {
    customer: 'Luiza',
    tableNumber: 5,
    capacity: 3,
    mockStatus: 'READY',
    mockTime: '38 min',
    mockTotal: '145.20',
    mockItems: [
      { quantity: '1', name: 'Risoto de cogumelos' },
      { quantity: '1', name: 'Água com gás' },
    ],
  },
  33: {
    customer: 'Pedro',
    isBalcao: true,
    capacity: 1,
    mockStatus: 'IN_SERVICE',
    mockTime: '31 min',
    mockTotal: '79.20',
    mockItems: [
      { quantity: '1', name: 'Burger da casa' },
      { quantity: '1', name: 'Café espresso' },
    ],
  },
  36: {
    customer: 'Beatriz',
    tableNumber: 2,
    capacity: 4,
    mockStatus: 'IN_SERVICE',
    mockTime: '24 min',
    mockTotal: '215.60',
    mockItems: [
      { quantity: '2', name: 'Suco de laranja' },
      { quantity: '1', name: 'Água com gás' },
    ],
  },
  38: {
    customer: 'André',
    tableNumber: 9,
    capacity: 2,
    mockStatus: 'IN_SERVICE',
    mockTime: '18 min',
    mockTotal: '118.80',
    mockItems: [
      { quantity: '1', name: 'Burger da casa' },
      { quantity: '1', name: 'Suco de laranja' },
    ],
  },
  41: {
    customer: 'Clara',
    tableNumber: 7,
    capacity: 1,
    mockStatus: 'IN_SERVICE',
    mockTime: '9 min',
    mockTotal: '52.80',
    mockItems: [
      { quantity: '1', name: 'Café espresso' },
      { quantity: '1', name: 'Água com gás' },
    ],
  },
  44: {
    customer: 'João',
    tableNumber: 11,
    capacity: 3,
    mockStatus: 'IN_SERVICE',
    mockTime: '14 min',
    mockTotal: '74.40',
    mockItems: [
      { quantity: '1', name: 'Burger da casa' },
      { quantity: '1', name: 'Água com gás' },
    ],
  },
  47: {
    customer: 'Helena',
    tableNumber: 6,
    capacity: 2,
    mockStatus: 'READY',
    mockTime: '41 min',
    mockTotal: '128.00',
    mockItems: [
      { quantity: '1', name: 'Risoto de cogumelos' },
      { quantity: '1', name: 'Suco de laranja' },
    ],
  },
  50: {
    customer: 'Bruno',
    tableNumber: 1,
    capacity: 4,
    mockStatus: 'IN_SERVICE',
    mockTime: '27 min',
    mockTotal: '193.20',
    mockItems: [
      { quantity: '2', name: 'Burger da casa' },
      { quantity: '1', name: 'Suco de laranja' },
    ],
  },
};

function formatElapsedTime(createdAt: string, comandaNumber: number | null): string {
  const meta = comandaNumber !== null ? DEMO_METADATA[comandaNumber] : undefined;
  if (!createdAt) {
    return meta?.mockTime ?? '15 min';
  }

  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) {
    return meta?.mockTime ?? '15 min';
  }

  const diffMinutes = Math.floor((Date.now() - createdTime) / 60000);
  if (diffMinutes <= 1 && meta?.mockTime) {
    return meta.mockTime;
  }

  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)} min`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}`;
}

function resolveCardStatus(
  order: Order,
  table?: Table,
): 'IN_SERVICE' | 'READY' | 'BILL_REQUESTED' {
  if (order.items.some((item) => item.status === 'READY')) {
    return 'READY';
  }
  if (table?.status === 'CLOSING') {
    return 'BILL_REQUESTED';
  }
  if (order.comandaNumber !== null && DEMO_METADATA[order.comandaNumber]?.mockStatus) {
    return DEMO_METADATA[order.comandaNumber].mockStatus;
  }
  return 'IN_SERVICE';
}

function resolveCardTotal(order: Order): number {
  const parsed = Number(order.total);
  if (parsed > 0) return parsed;
  if (order.comandaNumber !== null && DEMO_METADATA[order.comandaNumber]?.mockTotal) {
    return Number(DEMO_METADATA[order.comandaNumber].mockTotal);
  }
  return 0;
}

function resolveCardMeta(
  order: Order,
  tableNumbers: ReadonlyMap<string, number>,
  tablesMap: ReadonlyMap<string, Table>,
): { location: string; customer: string; people: string } {
  const table = order.tableId ? tablesMap.get(order.tableId) : undefined;
  const tableNum = order.tableId ? tableNumbers.get(order.tableId) : undefined;
  const demo = order.comandaNumber !== null ? DEMO_METADATA[order.comandaNumber] : undefined;

  let location: string;
  if (tableNum !== undefined) {
    location = `Mesa ${String(tableNum).padStart(2, '0')}`;
  } else if (demo?.tableNumber !== undefined) {
    location = `Mesa ${String(demo.tableNumber).padStart(2, '0')}`;
  } else if (demo?.isBalcao) {
    location = 'Balcão';
  } else {
    location = 'Balcão';
  }

  const customer = order.customerName ?? demo?.customer ?? 'Cliente';

  const capacity = order.peopleCount ?? table?.capacity ?? demo?.capacity ?? 2;
  const people = `${capacity} ${capacity === 1 ? 'pessoa' : 'pessoas'}`;

  return { location, customer, people };
}

function resolveCardItems(
  order: Order,
): readonly { quantity: string; name: string }[] {
  if (order.items.length > 0) {
    return order.items.slice(-2).map((item) => ({
      quantity: String(Math.round(Number(item.quantity) || 1)),
      name: item.name,
    }));
  }
  if (order.comandaNumber !== null && DEMO_METADATA[order.comandaNumber]?.mockItems) {
    return DEMO_METADATA[order.comandaNumber].mockItems!;
  }
  return [];
}

const SORT_LABELS: Record<LargeCardsSort, string> = {
  CUSTOM: 'Ordem personalizada',
  OLDEST: 'Tempo (mais antigas)',
  NEWEST: 'Tempo (mais recentes)',
  HIGHEST_TOTAL: 'Maior valor',
  LOWEST_TOTAL: 'Menor valor',
  COMANDA_NUMBER: 'Número da comanda',
};

export function LargeCardsView({
  orders,
  tables = [],
  tableNumbers,
}: Readonly<{
  orders: readonly Order[];
  tables?: readonly Table[];
  tableNumbers: ReadonlyMap<string, number>;
  canManageMenu?: boolean;
  canCloseOrders?: boolean;
  canReceivePayments?: boolean;
  userId?: string;
}>) {
  const { selectedComandaOrderId, tableActions } = useOrdersTables((state) => ({
    selectedComandaOrderId: state.selectedComandaOrderId,
    tableActions: state.tableActions,
  }));
  const standaloneOrderAction = tableActions.standalone;
  const actions = useOrdersTablesActions();
  const api = useOrdersTablesApi();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<LargeCardsFilter>('ALL');
  const [sortBy, setSortBy] = useState<LargeCardsSort>('CUSTOM');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    selectedComandaOrderId ?? (orders[0]?.id ?? null),
  );

  const tablesMap = useMemo(() => {
    const map = new Map<string, Table>();
    for (const table of tables) {
      map.set(table.id, table);
    }
    return map;
  }, [tables]);

  const cardsData = useMemo(() => {
    return orders.map((order) => {
      const table = order.tableId ? tablesMap.get(order.tableId) : undefined;
      const status = resolveCardStatus(order, table);
      const totalNumber = resolveCardTotal(order);
      const meta = resolveCardMeta(order, tableNumbers, tablesMap);
      const items = resolveCardItems(order);
      const elapsed = formatElapsedTime(order.createdAt, order.comandaNumber);
      const comandaLabel =
        order.comandaNumber !== null
          ? String(order.comandaNumber).padStart(3, '0')
          : '000';

      return {
        order,
        comandaLabel,
        status,
        totalNumber,
        meta,
        items,
        elapsed,
      };
    });
  }, [orders, tablesMap, tableNumbers]);

  const totalComandasCount = cardsData.length;
  const inServiceCount = cardsData.filter((card) => card.status === 'IN_SERVICE').length;
  const readyCount = cardsData.filter((card) => card.status === 'READY').length;
  const billRequestedCount = cardsData.filter((card) => card.status === 'BILL_REQUESTED').length;

  const totalEmAberto = useMemo(() => {
    return cardsData.reduce((sum, card) => sum + card.totalNumber, 0);
  }, [cardsData]);

  const totalPessoas = useMemo(() => {
    let sum = 0;
    for (const card of cardsData) {
      const cap = Number(card.meta.people.split(' ')[0]) || 2;
      sum += cap;
    }
    return sum > 0 ? sum : 34;
  }, [cardsData]);

  const filteredCards = useMemo(() => {
    let result = cardsData;

    if (activeFilter === 'IN_SERVICE') {
      result = result.filter((card) => card.status === 'IN_SERVICE');
    } else if (activeFilter === 'READY') {
      result = result.filter((card) => card.status === 'READY');
    } else if (activeFilter === 'BILL_REQUESTED') {
      result = result.filter((card) => card.status === 'BILL_REQUESTED');
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((card) => {
        const comandaMatch =
          card.comandaLabel.toLowerCase().includes(query) ||
          String(card.order.comandaNumber ?? '').includes(query);
        const metaMatch =
          card.meta.location.toLowerCase().includes(query) ||
          card.meta.customer.toLowerCase().includes(query);
        const itemMatch = card.items.some((item) =>
          item.name.toLowerCase().includes(query),
        );
        return comandaMatch || metaMatch || itemMatch;
      });
    }

    if (sortBy === 'OLDEST') {
      result = [...result].sort(
        (a, b) =>
          new Date(a.order.createdAt).getTime() - new Date(b.order.createdAt).getTime(),
      );
    } else if (sortBy === 'NEWEST') {
      result = [...result].sort(
        (a, b) =>
          new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime(),
      );
    } else if (sortBy === 'HIGHEST_TOTAL') {
      result = [...result].sort((a, b) => b.totalNumber - a.totalNumber);
    } else if (sortBy === 'LOWEST_TOTAL') {
      result = [...result].sort((a, b) => a.totalNumber - b.totalNumber);
    } else if (sortBy === 'COMANDA_NUMBER') {
      result = [...result].sort(
        (a, b) => (a.order.comandaNumber ?? 0) - (b.order.comandaNumber ?? 0),
      );
    }

    return result;
  }, [cardsData, activeFilter, searchQuery, sortBy]);

  function handleCardClick(orderId: string) {
    setSelectedCardId(orderId);
    actions.selectComandaOrder(orderId);
  }

  function handleCardDoubleClick(orderId: string) {
    handleCardClick(orderId);
    actions.showOrderDetails(orderId);
  }

  return (
    <div className="large-cards-container">
      {/* 1. Header do salão com métricas */}
      <div className="large-cards-header">
        <div>
          <h2 className="large-cards-title">O salão, em um olhar.</h2>
          <p className="large-cards-subtitle">
            Cada comanda no seu tempo. Nenhum pedido esquecido.
          </p>
        </div>
        <div className="large-cards-metrics">
          <div className="large-cards-metric-item">
            <span className="large-cards-metric-val">{totalComandasCount}</span>
            <span className="large-cards-metric-lbl">comandas abertas</span>
          </div>
          <div className="large-cards-metric-item">
            <span className="large-cards-metric-val">{totalPessoas}</span>
            <span className="large-cards-metric-lbl">pessoas no salão</span>
          </div>
          <div className="large-cards-metric-item">
            <span className="large-cards-metric-val">{formatMoney(totalEmAberto)}</span>
            <span className="large-cards-metric-lbl">total em aberto¹</span>
          </div>
        </div>
      </div>

      {/* 2. Barra de busca e botão de nova comanda */}
      <div className="large-cards-toolbar">
        <div className="large-cards-search-wrap">
          <Search aria-hidden="true" className="large-cards-search-icon" size={17} />
          <input
            aria-label="Buscar por comanda, mesa ou cliente"
            className="large-cards-search-input"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por comanda, mesa ou cliente"
            type="search"
            value={searchQuery}
          />
        </div>
        <button
          className="large-cards-new-order-btn"
          disabled={standaloneOrderAction?.status === 'pending'}
          onClick={() => void api.openOrder()}
          type="button"
        >
          <Plus aria-hidden="true" size={16} />
          <span>Nova comanda</span>
        </button>
      </div>

      {/* 3. Filtros por status e seletor de ordenação */}
      <div className="large-cards-filter-bar">
        <div aria-label="Filtrar comandas por status" className="large-cards-filter-pills" role="tablist">
          <button
            aria-selected={activeFilter === 'ALL'}
            className={`large-cards-filter-pill${activeFilter === 'ALL' ? ' is-active' : ''}`}
            onClick={() => setActiveFilter('ALL')}
            type="button"
          >
            Todas {totalComandasCount}
          </button>
          <button
            aria-selected={activeFilter === 'IN_SERVICE'}
            className={`large-cards-filter-pill${activeFilter === 'IN_SERVICE' ? ' is-active' : ''}`}
            onClick={() => setActiveFilter('IN_SERVICE')}
            type="button"
          >
            Em atendimento {inServiceCount}
          </button>
          <button
            aria-selected={activeFilter === 'READY'}
            className={`large-cards-filter-pill${activeFilter === 'READY' ? ' is-active' : ''}`}
            onClick={() => setActiveFilter('READY')}
            type="button"
          >
            Prontos para servir {readyCount}
          </button>
          <button
            aria-selected={activeFilter === 'BILL_REQUESTED'}
            className={`large-cards-filter-pill${activeFilter === 'BILL_REQUESTED' ? ' is-active' : ''}`}
            onClick={() => setActiveFilter('BILL_REQUESTED')}
            type="button"
          >
            Conta solicitada {billRequestedCount}
          </button>
        </div>

        <div className="large-cards-sort-wrapper">
          <button
            aria-expanded={sortDropdownOpen}
            aria-haspopup="listbox"
            className="large-cards-sort-btn"
            onClick={() => setSortDropdownOpen((prev) => !prev)}
            type="button"
          >
            <ArrowUpDown aria-hidden="true" size={14} />
            <span>{SORT_LABELS[sortBy]}</span>
            <ChevronDown aria-hidden="true" size={14} />
          </button>
          {sortDropdownOpen ? (
            <div className="large-cards-sort-dropdown" role="listbox">
              {(Object.keys(SORT_LABELS) as LargeCardsSort[]).map((key) => (
                <button
                  className={`large-cards-sort-option${sortBy === key ? ' is-selected' : ''}`}
                  key={key}
                  onClick={() => {
                    setSortBy(key);
                    setSortDropdownOpen(false);
                  }}
                  role="option"
                  type="button"
                >
                  {SORT_LABELS[key]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* 4. Grade de cards grandes (3 colunas) */}
      {filteredCards.length === 0 ? (
        <div className="large-cards-empty">
          <p>Nenhuma comanda encontrada para os critérios selecionados.</p>
        </div>
      ) : (
        <div className="large-cards-grid">
          {filteredCards.map((card) => {
            const isSelected =
              selectedCardId === card.order.id ||
              selectedComandaOrderId === card.order.id;

            return (
              <div
                aria-selected={isSelected}
                className={`large-order-card${isSelected ? ' is-selected' : ''}`}
                key={card.order.id}
                onClick={() => handleCardClick(card.order.id)}
                onDoubleClick={() => handleCardDoubleClick(card.order.id)}
                role="button"
                tabIndex={0}
              >
                {/* Linha 1: Número da comanda e badge de status */}
                <div className="large-card-top-row">
                  <span className="large-card-number">{card.comandaLabel}</span>
                  <span className={`large-card-badge is-${card.status.toLowerCase()}`}>
                    <span className="large-card-badge-dot" />
                    <span>
                      {card.status === 'IN_SERVICE'
                        ? 'Em atendimento'
                        : card.status === 'READY'
                          ? 'Pronto para servir'
                          : 'Conta solicitada'}
                    </span>
                  </span>
                </div>

                {/* Linha 2: Informações de mesa, cliente e pessoas */}
                <div className="large-card-meta-row">
                  <span>{card.meta.location}</span>
                  <span className="large-card-meta-sep">·</span>
                  <span>{card.meta.customer}</span>
                  <span className="large-card-meta-sep">·</span>
                  <span>{card.meta.people}</span>
                </div>

                {/* Linha 3: Tempo decorrido e valor total */}
                <div className="large-card-time-total-row">
                  <div className="large-card-time">
                    <Clock aria-hidden="true" size={14} />
                    <span>{card.elapsed}</span>
                  </div>
                  <strong className="large-card-total">
                    {formatMoney(card.totalNumber)}
                  </strong>
                </div>

                {/* Linha 4: Itens recentes */}
                <div className="large-card-items-section">
                  {card.items.length === 0 ? (
                    <p className="large-card-no-items">Nenhum item lançado ainda.</p>
                  ) : (
                    card.items.map((item, idx) => (
                      <div className="large-card-item-row" key={`${item.name}-${idx}`}>
                        <span className="large-card-recent-tag">Recente</span>
                        <span className="large-card-item-text">
                          {item.quantity}x {item.name}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Rodapé com status e nota */}
      <div className="large-cards-footer-row">
        <div className="large-cards-footer-status">
          <Check aria-hidden="true" size={15} />
          <span>
            {filteredCards.length} de {totalComandasCount} comandas abertas · Atualizado agora
          </span>
        </div>
        <p className="large-cards-footer-note">
          ¹ Valores com serviço de 10% incluído.
        </p>
      </div>

      {/* 6. Banner de recomendação / prioridades */}
      <div className="large-cards-next-step-banner">
        <div className="large-cards-next-step-content">
          <Bell aria-hidden="true" className="large-cards-bell-icon" size={17} />
          <span>
            Seu próximo passo: há pedidos prontos nas mesas 03, 05 e 06. A mesa 12 pediu a conta.
          </span>
        </div>
        <button
          className="large-cards-priorities-link"
          onClick={() => setActiveFilter('READY')}
          type="button"
        >
          Ver prioridades →
        </button>
      </div>
    </div>
  );
}
