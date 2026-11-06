import type { MenuItem } from './types';

const prioritizedProductNames = [
  'buffet livre',
  'buffet por kg',
  'coca-cola zero lata 300ml',
  'suco mudra',
  'suco de laranja',
  'suco de laranka',
];

export function normalizeProductSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

export function sortMenuItems(items: readonly MenuItem[]): MenuItem[] {
  return [...items].sort((left, right) => {
    const leftPriority = prioritizedProductNames.indexOf(normalizeProductSearch(left.name));
    const rightPriority = prioritizedProductNames.indexOf(normalizeProductSearch(right.name));
    const leftRank = leftPriority === -1 ? prioritizedProductNames.length : leftPriority;
    const rightRank = rightPriority === -1 ? prioritizedProductNames.length : rightPriority;
    return leftRank - rightRank || left.name.localeCompare(right.name, 'pt-BR');
  });
}

export function filterMenuItems(items: readonly MenuItem[], search: string) {
  const normalizedSearch = normalizeProductSearch(search);
  return items.filter((item) =>
    normalizeProductSearch(`${item.name} ${item.category}`).includes(normalizedSearch),
  );
}

export function findExactMenuItem(items: readonly MenuItem[], search: string) {
  const normalizedSearch = normalizeProductSearch(search);
  if (!normalizedSearch) return undefined;
  return items.find((item) => normalizeProductSearch(item.name) === normalizedSearch);
}
