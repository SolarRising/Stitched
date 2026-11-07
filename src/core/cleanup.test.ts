import { describe, expect, it } from 'vitest';
import { removeSmallRegions } from './cleanup';
import { EMPTY } from './quantize';

const grid = (rows: string[]) => {
  const map: Record<string, number> = { '.': EMPTY, a: 0, b: 1, c: 2 };
  return Uint16Array.from(rows.join('').split(''), (ch) => map[ch]);
};
const show = (cells: Uint16Array, w: number) => {
  const rev = (c: number) => (c === EMPTY ? '.' : 'abc'[c]);
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += w)
    rows.push(Array.from(cells.slice(i, i + w), rev).join(''));
  return rows;
};

describe('removeSmallRegions', () => {
  it('replaces an isolated stitch with its surroundings', () => {
    const cells = grid(['aaaaa', 'aabaa', 'aaaaa']);
    expect(show(removeSmallRegions(cells, 5, 3, 2), 5)).toEqual(['aaaaa', 'aaaaa', 'aaaaa']);
    // Input untouched.
    expect(cells[7]).toBe(1);
  });

  it('keeps regions at or above the minimum size', () => {
    const cells = grid(['aaaaa', 'abbaa', 'aaaaa']);
    expect(show(removeSmallRegions(cells, 5, 3, 2), 5)).toEqual(['aaaaa', 'abbaa', 'aaaaa']);
    expect(show(removeSmallRegions(cells, 5, 3, 3), 5)).toEqual(['aaaaa', 'aaaaa', 'aaaaa']);
  });

  it('removes stray stitches on empty fabric', () => {
    const cells = grid(['.....', '..a..', '.....']);
    expect(show(removeSmallRegions(cells, 5, 3, 2), 5)).toEqual(['.....', '.....', '.....']);
  });

  it('prefers the colour sharing edges with the speck', () => {
    const cells = grid(['cbb', 'cab', 'ccb']);
    // 'a' touches b on 2 edges and c on 2 edges; diagonals: c(0,0)… b(2,0) b(2,2) c(0,2)
    const out = removeSmallRegions(cells, 3, 3, 2);
    expect([1, 2]).toContain(out[4]);
  });

  it('does nothing when disabled or uniform', () => {
    const cells = grid(['ab', 'ba']);
    expect(Array.from(removeSmallRegions(cells, 2, 2, 0))).toEqual(Array.from(cells));
    const uniform = grid(['a']);
    expect(Array.from(removeSmallRegions(uniform, 1, 1, 5))).toEqual([0]);
  });
});
