import { describe, expect, it } from 'vitest';
import {
  filterMenuItems,
  findExactMenuItem,
  normalizeProductSearch,
  sortMenuItems,
} from './product-search';
import type { MenuItem } from './types';

const items: readonly MenuItem[] = [
  { id: '1', name: 'Suco de Laranja', category: 'Bebidas', price: '12.00' },
  { id: '2', name: 'Buffet Livre', category: 'Buffet', price: '64.90' },
  { id: '3', name: 'Coca-Cola Zero Lata 300ml', category: 'Bebidas', price: '7.00' },
  { id: '4', name: 'Pudim', category: 'Sobremesa', price: '9.00' },
];

describe('normalizeProductSearch', () => {
  it('removes accents, normalizes case, and trims whitespace', () => {
    expect(normalizeProductSearch('  AÇÃO  ')).toBe('acao');
    expect(normalizeProductSearch('Suco de Laranja')).toBe('suco de laranja');
  });
});

describe('sortMenuItems', () => {
  it('prioritizes the configured products without mutating the input', () => {
    const sorted = sortMenuItems(items);

    expect(sorted.map((item) => item.name)).toEqual([
      'Buffet Livre',
      'Coca-Cola Zero Lata 300ml',
      'Suco de Laranja',
      'Pudim',
    ]);
    expect(items[0]?.name).toBe('Suco de Laranja');
  });
});

describe('filterMenuItems', () => {
  it('filters by product name or category, ignoring accents and case', () => {
    expect(filterMenuItems(items, 'laranja').map((item) => item.id)).toEqual(['1']);
    expect(filterMenuItems(items, 'BEBIDAS').map((item) => item.id)).toEqual(['1', '3']);
    expect(filterMenuItems(items, 'sobremesa').map((item) => item.id)).toEqual(['4']);
  });

  it('returns every product for an empty search', () => {
    expect(filterMenuItems(items, '   ')).toHaveLength(items.length);
  });
});

describe('findExactMenuItem', () => {
  it('finds a product by exact normalized name', () => {
    expect(findExactMenuItem(items, 'coca-cola zero lata 300ml')?.id).toBe('3');
    expect(findExactMenuItem(items, 'coca')).toBeUndefined();
    expect(findExactMenuItem(items, '')).toBeUndefined();
  });
});
