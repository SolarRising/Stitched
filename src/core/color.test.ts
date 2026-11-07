import { describe, expect, it } from 'vitest';
import { ciede2000, contrastInk, hexToRgb, labToRgb, rgbToHex, rgbToLab } from './color';

describe('rgbToLab', () => {
  it('maps white, black and primaries to reference values', () => {
    const white = rgbToLab(255, 255, 255);
    expect(white[0]).toBeCloseTo(100, 3);
    expect(white[1]).toBeCloseTo(0, 3);
    expect(white[2]).toBeCloseTo(0, 3);
    expect(rgbToLab(0, 0, 0)).toEqual([0, 0, 0]);
    const red = rgbToLab(255, 0, 0);
    expect(red[0]).toBeCloseTo(53.24, 1);
    expect(red[1]).toBeCloseTo(80.09, 1);
    expect(red[2]).toBeCloseTo(67.2, 1);
    const blue = rgbToLab(0, 0, 255);
    expect(blue[0]).toBeCloseTo(32.3, 1);
    expect(blue[2]).toBeCloseTo(-107.86, 0);
  });

  it('round-trips through labToRgb', () => {
    for (const [r, g, b] of [
      [12, 200, 99],
      [255, 128, 0],
      [33, 33, 33],
      [240, 234, 218],
    ]) {
      const [L, a, bb] = rgbToLab(r, g, b);
      const back = labToRgb(L, a, bb);
      expect(back[0]).toBeCloseTo(r, 1);
      expect(back[1]).toBeCloseTo(g, 1);
      expect(back[2]).toBeCloseTo(b, 1);
    }
  });
});

describe('ciede2000', () => {
  // Reference pairs from Sharma, Wu & Dalal (2005), "The CIEDE2000 color-difference formula".
  const cases: Array<[number, number, number, number, number, number, number]> = [
    [50, 2.6772, -79.7751, 50, 0, -82.7485, 2.0425],
    [50, 3.1571, -77.2803, 50, 0, -82.7485, 2.8615],
    [50, 0, 0, 50, -1, 2, 2.3669],
    [50, 2.49, -0.001, 50, -2.49, 0.0011, 7.2195],
    [50, 2.5, 0, 73, 25, -18, 27.1492],
    [50, 2.5, 0, 50, 3.1736, 0.5854, 1.0],
    [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
    [22.7233, 20.0904, -46.694, 23.0331, 14.973, -42.5619, 2.0373],
    [2.0776, 0.0795, -1.135, 0.9033, -0.0636, -0.5514, 0.9082],
  ];
  it.each(cases)('pair %#', (L1, a1, b1, L2, a2, b2, expected) => {
    expect(ciede2000(L1, a1, b1, L2, a2, b2)).toBeCloseTo(expected, 4);
    // Symmetric.
    expect(ciede2000(L2, a2, b2, L1, a1, b1)).toBeCloseTo(expected, 4);
  });

  it('is zero for identical colours', () => {
    expect(ciede2000(40, 10, -20, 40, 10, -20)).toBe(0);
  });
});

describe('hex helpers', () => {
  it('parses and formats', () => {
    expect(hexToRgb('#FFE2E2')).toEqual([255, 226, 226]);
    expect(hexToRgb('abc')).toEqual([170, 187, 204]);
    expect(rgbToHex(255, 0, 15.6)).toBe('#ff0010');
    expect(() => hexToRgb('#12')).toThrow();
  });

  it('picks readable ink', () => {
    expect(contrastInk(255, 255, 255)).toBe('#000000');
    expect(contrastInk(0, 0, 80)).toBe('#ffffff');
  });
});
