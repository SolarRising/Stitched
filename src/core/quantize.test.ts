import { describe, expect, it } from 'vitest';
import { generateGrid, type GenerateOptions } from './generate';
import { FULL_CROP, resampleToGrid } from './image';
import { DMC, threadById } from './palettes';
import { EMPTY, quantizeGrid } from './quantize';
import { makeImage } from './testUtils';

const base: GenerateOptions = {
  width: 0,
  height: 0,
  crop: FULL_CROP,
  maxColors: 10,
  dither: false,
  cleanup: 0,
  resample: 'average',
  brightness: 0,
  contrast: 0,
  saturation: 0,
  alphaThreshold: 0.5,
  excluded: [],
};

const hex = (id: string) => threadById(id)!.rgb as [number, number, number];

describe('quantizeGrid', () => {
  it('maps exact thread colours onto those threads', () => {
    const colors = [hex('dmc:310'), hex('dmc:666'), hex('dmc:B5200')];
    const img = makeImage(30, 10, (x) => colors[Math.floor(x / 10)]);
    const g = generateGrid(img, { ...base, width: 30, height: 10 });
    expect(new Set(g.threadIds)).toEqual(new Set(['dmc:310', 'dmc:666', 'dmc:B5200']));
    expect(g.cells.every((c) => c !== EMPTY)).toBe(true);
  });

  it('respects the colour limit', () => {
    const img = makeImage(64, 64, (x, y) => [x * 4, y * 4, 128]);
    for (const maxColors of [2, 5, 12]) {
      const g = generateGrid(img, { ...base, width: 64, height: 64, maxColors });
      expect(g.threadIds.length).toBeLessThanOrEqual(maxColors);
      expect(g.threadIds.length).toBeGreaterThanOrEqual(Math.min(maxColors, 2));
      expect(Math.max(...g.cells)).toBeLessThan(g.threadIds.length);
    }
  });

  it('uses all allowed colours on a rich image', () => {
    const img = makeImage(64, 64, (x, y) => [x * 4, y * 4, (x * y) % 256]);
    const g = generateGrid(img, { ...base, width: 64, height: 64, maxColors: 12 });
    expect(g.threadIds.length).toBe(12);
  });

  it('is deterministic', () => {
    const img = makeImage(40, 40, (x, y) => [(x * 37) % 256, (y * 53) % 256, (x * y) % 256]);
    const a = generateGrid(img, { ...base, width: 40, height: 40, maxColors: 8 });
    const b = generateGrid(img, { ...base, width: 40, height: 40, maxColors: 8 });
    expect(a.threadIds).toEqual(b.threadIds);
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
  });

  it('orders threads by usage', () => {
    // 75% black, 25% red.
    const img = makeImage(8, 8, (x) => (x < 6 ? [0, 0, 0] : [227, 29, 66]));
    const g = generateGrid(img, { ...base, width: 8, height: 8 });
    expect(g.threadIds[0]).toBe('dmc:310');
  });

  it('leaves transparent areas unstitched', () => {
    const img = makeImage(10, 10, (x) => (x < 5 ? [0, 0, 0, 0] : [0, 0, 0, 255]));
    const g = generateGrid(img, { ...base, width: 10, height: 10 });
    expect(g.cells[0]).toBe(EMPTY);
    expect(g.cells[9]).not.toBe(EMPTY);
    const blank = generateGrid(makeImage(4, 4, () => [0, 0, 0, 0]), { ...base, width: 4, height: 4 });
    expect(blank.threadIds).toEqual([]);
  });

  it('never uses excluded threads', () => {
    const img = makeImage(10, 10, () => hex('dmc:310'));
    const g = generateGrid(img, { ...base, width: 10, height: 10, excluded: ['dmc:310'] });
    expect(g.threadIds).not.toContain('dmc:310');
    expect(g.threadIds.length).toBe(1);
  });

  it('dithers using only the chosen threads', () => {
    const img = makeImage(48, 16, (x) => [x * 5, x * 5, x * 5]);
    const grid = resampleToGrid(img, FULL_CROP, 48, 16, 'average');
    const q = quantizeGrid(grid, DMC, { maxColors: 3, dither: true, alphaThreshold: 0.5 });
    expect(q.threads.length).toBeLessThanOrEqual(3);
    expect(q.cells.every((c) => c < q.threads.length)).toBe(true);
    // Dithering mixes colours within a column band instead of hard steps.
    const plain = quantizeGrid(grid, DMC, { maxColors: 3, dither: false, alphaThreshold: 0.5 });
    const distinctRows = (cells: Uint16Array) =>
      new Set(Array.from({ length: 16 }, (_, y) => cells.slice(y * 48, y * 48 + 48).join())).size;
    expect(distinctRows(plain.cells)).toBe(1);
    expect(distinctRows(q.cells)).toBeGreaterThan(1);
  });
});
