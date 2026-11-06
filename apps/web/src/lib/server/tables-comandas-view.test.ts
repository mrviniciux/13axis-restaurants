import { describe, expect, it } from 'vitest';
import { ApiProblemError } from './problem';
import { isTablesComandasView, parseTablesComandasView } from './tables-comandas-view';

describe('tables comandas view preference', () => {
  it.each(['COMANDA', 'MESA', 'MESA_E_COMANDA'])('accepts %s', (view) => {
    expect(parseTablesComandasView({ view })).toBe(view);
    expect(isTablesComandasView(view)).toBe(true);
  });

  it.each([null, {}, { view: 'INVALID' }, { view: 1 }])(
    'rejects invalid preference %j',
    (input) => {
      expect(() => parseTablesComandasView(input)).toThrow(ApiProblemError);
    },
  );
});
