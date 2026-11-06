import { describe, expect, it } from 'vitest';
import { parseCreateMenuItemInput } from './menu-item-input';
import { ApiProblemError } from './problem';

describe('parseCreateMenuItemInput', () => {
  it('trims product fields and normalizes Brazilian price notation', () => {
    expect(
      parseCreateMenuItemInput({
        name: ' Buffet Livre ',
        category: ' Buffet ',
        price: '64,90',
      }),
    ).toEqual({ name: 'Buffet Livre', category: 'Buffet', price: '64.90' });
  });

  it.each(['0', '-1', '64,999', '1e2', 'abc'])('rejects invalid price %s', (price) => {
    expect(() =>
      parseCreateMenuItemInput({ name: 'Produto', category: 'Categoria', price }),
    ).toThrow(ApiProblemError);
  });

  it('rejects missing fields and untrusted properties', () => {
    expect(() => parseCreateMenuItemInput({ name: 'Produto', price: '10' })).toThrow(
      ApiProblemError,
    );
    expect(() =>
      parseCreateMenuItemInput({
        name: 'Produto',
        category: 'Categoria',
        price: '10',
        restaurantId: 'other-restaurant',
      }),
    ).toThrow(ApiProblemError);
  });
});
