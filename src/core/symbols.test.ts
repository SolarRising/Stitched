import { describe, expect, it } from 'vitest';
import { MAX_COLORS } from './settings';
import { drawSymbol, symbolAt, SYMBOLS, type Pen } from './symbols';

describe('symbols', () => {
  it('has a unique symbol for every allowed colour', () => {
    expect(SYMBOLS.length).toBeGreaterThanOrEqual(MAX_COLORS);
    expect(new Set(SYMBOLS.map((s) => s.id)).size).toBe(SYMBOLS.length);
    const extra = Array.from({ length: 30 }, (_, i) => symbolAt(SYMBOLS.length + i).id);
    expect(new Set(extra).size).toBe(30);
  });

  it('draws every symbol inside its cell', () => {
    const coords: number[] = [];
    const pen: Pen = {
      setInk: () => {},
      rect: (x, y, w, h) => coords.push(x, y, x + w, y + h),
      circle: (cx, cy, r) => coords.push(cx - r, cy - r, cx + r, cy + r),
      polygon: (pts) => coords.push(...pts),
      line: (x1, y1, x2, y2) => coords.push(x1, y1, x2, y2),
      text: (_s, cx, cy) => coords.push(cx, cy),
    };
    for (const s of SYMBOLS) drawSymbol(pen, s, 10, 20, 10, '#000');
    expect(coords.length).toBeGreaterThan(0);
    for (let i = 0; i < coords.length; i += 2) {
      expect(coords[i]).toBeGreaterThanOrEqual(10);
      expect(coords[i]).toBeLessThanOrEqual(20);
      expect(coords[i + 1]).toBeGreaterThanOrEqual(20);
      expect(coords[i + 1]).toBeLessThanOrEqual(30);
    }
  });
});
