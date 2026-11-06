import { describe, expect, it } from 'vitest';
import {
  comandaNumberAt,
  countComandaNumbers,
  includesComandaNumber,
  parseComandaNumbers,
} from './comanda-numbers';

describe('parseComandaNumbers', () => {
  it('parses a sequence, explicit values, and the traditional comma-separated form', () => {
    expect(parseComandaNumbers('{1-30}')).toEqual([{ start: 1, end: 30 }]);
    expect(parseComandaNumbers('[{1-30}, 50, 60, 90]')).toEqual([
      { start: 1, end: 30 },
      { start: 50, end: 50 },
      { start: 60, end: 60 },
      { start: 90, end: 90 },
    ]);
    expect(parseComandaNumbers('1,2,3,4')).toEqual([{ start: 1, end: 4 }]);
  });

  it('merges duplicate and overlapping ranges', () => {
    expect(parseComandaNumbers('[{1-5}, 3, {6-8}]')).toEqual([{ start: 1, end: 8 }]);
  });

  it.each(['', '1,,2', '{5-2}', '0', '[-2]', '[1,2', '{1-2147483648}', '1, nope'])(
    'rejects invalid input %s',
    (value) => {
      expect(() => parseComandaNumbers(value)).toThrow();
    },
  );
});

describe('comanda number ranges', () => {
  it('counts and indexes ranges without expanding large sequences', () => {
    const ranges = parseComandaNumbers('{20-110}');
    expect(countComandaNumbers(ranges)).toBe(91n);
    expect(comandaNumberAt(ranges, 0n)).toBe(20);
    expect(comandaNumberAt(ranges, 90n)).toBe(110);
    expect(comandaNumberAt(ranges, 91n)).toBeNull();
  });

  it('checks membership in compact ranges', () => {
    const ranges = parseComandaNumbers('[{1-30}, 50, 60]');
    expect(includesComandaNumber(ranges, 30)).toBe(true);
    expect(includesComandaNumber(ranges, 50)).toBe(true);
    expect(includesComandaNumber(ranges, 31)).toBe(false);
  });
});
