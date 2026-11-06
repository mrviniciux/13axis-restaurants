import { ApiProblemError } from './problem';

export const tablesComandasViews = ['COMANDA', 'MESA', 'MESA_E_COMANDA'] as const;

export type TablesComandasView = (typeof tablesComandasViews)[number];

export function isTablesComandasView(value: unknown): value is TablesComandasView {
  return typeof value === 'string' && tablesComandasViews.includes(value as TablesComandasView);
}

export function parseTablesComandasView(input: unknown): TablesComandasView {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('view' in input) ||
    !isTablesComandasView(input.view)
  ) {
    throw new ApiProblemError(
      400,
      'INVALID_TABLES_COMANDAS_VIEW',
      'Visualização inválida',
      'Escolha Comanda, Mesa ou Mesa + comanda.',
    );
  }

  return input.view;
}
