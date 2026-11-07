'use client';

import type { KeyboardEvent } from 'react';

export const TABLES_COMANDAS_TABS = [
  { id: 'MAP_WITH_CARDS', label: 'Mapa + Cards' },
  { id: 'MAP_WITH_DETAILS', label: 'Mapa + detalhamento' },
  { id: 'CARDS', label: 'Cards' },
  { id: 'LARGE_CARDS', label: 'Large cards' },
] as const;

export type TablesComandasTab = (typeof TABLES_COMANDAS_TABS)[number]['id'];

export function isTablesComandasTab(value: unknown): value is TablesComandasTab {
  return TABLES_COMANDAS_TABS.some((tab) => tab.id === value);
}

type TablesComandasTabsProps = Readonly<{
  idPrefix: string;
  panelId: string;
  value: TablesComandasTab;
  onChange: (tab: TablesComandasTab) => void;
}>;

export function TablesComandasTabs({
  idPrefix,
  panelId,
  value,
  onChange,
}: TablesComandasTabsProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const lastIndex = TABLES_COMANDAS_TABS.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = index === lastIndex ? 0 : index + 1;
    if (event.key === 'ArrowLeft') nextIndex = index === 0 ? lastIndex : index - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = lastIndex;

    if (nextIndex === null) return;
    event.preventDefault();
    onChange(TABLES_COMANDAS_TABS[nextIndex].id);

    const tabButtons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabButtons?.[nextIndex]?.focus();
  }

  return (
    <div aria-label="Visualização das comandas" className="tables-comandas-tabs" role="tablist">
      {TABLES_COMANDAS_TABS.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            aria-controls={panelId}
            aria-selected={selected}
            className="tables-comandas-tab"
            id={`${idPrefix}-${tab.id}`}
            key={tab.id}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
