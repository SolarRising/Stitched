import { describe, expect, it } from 'vitest';
import type { GeneratedGrid } from './generate';
import {
  buildPattern,
  cellThreadId,
  detectBackground,
  EMPTY,
  floodRegion,
  lineCells,
  NO_STITCH,
  resolveReplacement,
} from './pattern';

// 4×2 grid: top row white, bottom row black/red.
const grid: GeneratedGrid = {
  width: 4,
  height: 2,
  cells: Uint16Array.from([0, 0, 0, 0, 1, 1, 2, EMPTY]),
  threadIds: ['dmc:B5200', 'dmc:310', 'dmc:666'],
};
const none = { background: [], replacements: {}, edits: new Map<number, string>() };

describe('buildPattern', () => {
  it('passes the generated grid through', () => {
    const p = buildPattern(grid, none);
    expect(p.colors.map((c) => [c.thread.code, c.count, c.symbol])).toEqual([
      ['B5200', 4, 0],
      ['310', 2, 1],
      ['666', 1, 2],
    ]);
    expect(p.stitchCount).toBe(7);
    expect(cellThreadId(p, 7)).toBe(NO_STITCH);
  });

  it('drops background threads', () => {
    const p = buildPattern(grid, { ...none, background: ['dmc:B5200'] });
    expect(p.colors.map((c) => c.thread.code)).toEqual(['310', '666']);
    expect(p.cells[0]).toBe(EMPTY);
    expect(p.stitchCount).toBe(3);
    // Symbols are reassigned so the best ones are not wasted on the background.
    expect(p.colors[0].symbol).toBe(0);
  });

  it('merges replaced threads', () => {
    const p = buildPattern(grid, { ...none, replacements: { 'dmc:666': 'dmc:310' } });
    expect(p.colors.map((c) => [c.thread.code, c.count])).toEqual([
      ['B5200', 4],
      ['310', 3],
    ]);
    expect(resolveReplacement('dmc:666', { 'dmc:666': 'dmc:310', 'dmc:310': 'dmc:666' })).toBe(
      'dmc:666',
    );
  });

  it('applies edits on top, keeping symbols stable', () => {
    const edits = new Map([
      [7, 'dmc:798'],
      [6, NO_STITCH],
      [999, 'dmc:310'],
      [0, 'dmc:not-a-thread'],
    ]);
    const p = buildPattern(grid, { ...none, edits });
    const byCode = Object.fromEntries(p.colors.map((c) => [c.thread.code, c]));
    expect(byCode['798'].count).toBe(1);
    expect(byCode['798'].symbol).toBe(3);
    expect(byCode['666']).toBeUndefined();
    expect(byCode['B5200'].count).toBe(4);
  });
});

describe('helpers', () => {
  it('detects a dominant border colour', () => {
    const g: GeneratedGrid = {
      width: 5,
      height: 5,
      cells: Uint16Array.from({ length: 25 }, (_, i) => (i === 12 ? 1 : 0)),
      threadIds: ['dmc:3865', 'dmc:310'],
    };
    expect(detectBackground(buildPattern(g, none))).toBe('dmc:3865');
    const mixed: GeneratedGrid = { ...g, cells: Uint16Array.from({ length: 25 }, (_, i) => i % 2) };
    expect(detectBackground(buildPattern(mixed, none), 0.6)).toBeNull();
  });

  it('flood-fills a 4-connected region', () => {
    const cells = Uint16Array.from([0, 0, 1, 1, 0, 1, 0, 0, 0]);
    expect(floodRegion(cells, 3, 3, 0).sort()).toEqual([0, 1, 4, 6, 7, 8].sort());
  });

  it('draws gap-free lines', () => {
    expect(lineCells(0, 0, 3, 1)).toEqual([
      [0, 0],
      [1, 0],
      [2, 1],
      [3, 1],
    ]);
    expect(lineCells(2, 2, 2, 2)).toEqual([[2, 2]]);
  });
});
