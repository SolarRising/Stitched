import { describe, expect, it } from 'vitest';
import { chartLayout, OVERLAP, PAPER_MM } from './layout';

describe('chartLayout', () => {
  it('fits a small pattern on one page', () => {
    const l = chartLayout(40, 30, 'a4', 3.2);
    expect(l.tiles).toEqual([{ tx: 0, ty: 0, col0: 0, row0: 0, cols: 40, rows: 30 }]);
  });

  it('keeps the grid inside the page', () => {
    for (const paper of ['a4', 'letter'] as const) {
      for (const cell of [2.6, 3.2, 4.2]) {
        const l = chartLayout(500, 500, paper, cell);
        const [w, h] = PAPER_MM[paper];
        expect(l.gridLeft + l.cols * cell).toBeLessThanOrEqual(w - 12 + 1e-9);
        expect(l.gridTop + l.rows * cell).toBeLessThanOrEqual(h - 12 - 9 + 1e-9);
      }
    }
  });

  it('covers every cell, with overlap between neighbouring pages', () => {
    const pw = 173;
    const ph = 211;
    const l = chartLayout(pw, ph, 'a4', 3.2);
    const covered = new Uint8Array(pw * ph);
    for (const t of l.tiles) {
      for (let y = t.row0; y < t.row0 + t.rows; y++) {
        for (let x = t.col0; x < t.col0 + t.cols; x++) covered[y * pw + x]++;
      }
    }
    expect(covered.every((c) => c > 0)).toBe(true);
    expect(l.tiles.length).toBe(l.tilesX * l.tilesY);
    const second = l.tiles.find((t) => t.tx === 1 && t.ty === 0)!;
    expect(second.col0).toBe(l.cols - OVERLAP);
    const last = l.tiles[l.tiles.length - 1];
    expect(last.col0 + last.cols).toBe(pw);
    expect(last.row0 + last.rows).toBe(ph);
  });

  it('uses fewer pages with smaller squares', () => {
    expect(chartLayout(200, 200, 'a4', 2.6).tiles.length).toBeLessThan(
      chartLayout(200, 200, 'a4', 4.2).tiles.length,
    );
  });
});
