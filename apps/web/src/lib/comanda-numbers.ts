export const MAX_COMANDA_NUMBER = 2_147_483_647;

export type ComandaNumberRange = Readonly<{ start: number; end: number }>;

export function parseComandaNumbers(value: string): readonly ComandaNumberRange[] {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 10_000) {
    throw new Error('Informe uma lista de comandas com até 10.000 caracteres.');
  }

  const hasOpenBracket = trimmed.startsWith('[');
  const hasCloseBracket = trimmed.endsWith(']');
  if (hasOpenBracket !== hasCloseBracket) {
    throw new Error('Verifique os colchetes da lista de comandas.');
  }
  const content = hasOpenBracket ? trimmed.slice(1, -1).trim() : trimmed;
  const tokens = content.split(',');
  if (tokens.some((token) => !token.trim())) {
    throw new Error('Há um item vazio na lista. Separe os números por vírgula.');
  }

  const ranges = tokens.map((token): ComandaNumberRange => {
    const entry = token.trim();
    const rangeMatch = /^\{\s*(\d+)\s*-\s*(\d+)\s*\}$/.exec(entry);
    const singleMatch = /^(\d+)$/.exec(entry);
    if (!rangeMatch && !singleMatch) {
      throw new Error(`Formato inválido: "${entry}". Use um número ou uma faixa {início-fim}.`);
    }

    const start = Number(rangeMatch?.[1] ?? singleMatch?.[1]);
    const end = Number(rangeMatch?.[2] ?? start);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 1 ||
      end > MAX_COMANDA_NUMBER
    ) {
      throw new Error(`Os números devem estar entre 1 e ${MAX_COMANDA_NUMBER}.`);
    }
    if (start > end) {
      throw new Error('O início da faixa deve ser menor ou igual ao fim.');
    }
    return { start, end };
  });

  return mergeComandaNumberRanges(ranges);
}

export function mergeComandaNumberRanges(
  ranges: readonly ComandaNumberRange[],
): readonly ComandaNumberRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: ComandaNumberRange[] = [];

  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end + 1) {
      merged[merged.length - 1] = {
        start: previous.start,
        end: Math.max(previous.end, range.end),
      };
    } else {
      merged.push(range);
    }
  }

  return merged;
}

export function countComandaNumbers(ranges: readonly ComandaNumberRange[]): bigint {
  return ranges.reduce((count, range) => count + BigInt(range.end - range.start + 1), 0n);
}

export function comandaNumberAt(
  ranges: readonly ComandaNumberRange[],
  index: bigint,
): number | null {
  if (index < 0n) return null;
  let remaining = index;
  for (const range of ranges) {
    const length = BigInt(range.end - range.start + 1);
    if (remaining < length) return range.start + Number(remaining);
    remaining -= length;
  }
  return null;
}

export function includesComandaNumber(
  ranges: readonly ComandaNumberRange[],
  number: number,
): boolean {
  return ranges.some((range) => number >= range.start && number <= range.end);
}
