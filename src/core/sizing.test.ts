import { describe, expect, it } from 'vitest';
import { skeinsNeeded, skeinsToBuy, threadLengthM } from './skeins';
import {
  cmToStitches,
  fabricById,
  fabricPieceCm,
  FABRICS,
  fitToBox,
  GARMENT_PRESETS,
  MAX_STITCHES,
  stitchesToCm,
  stitchSizeMm,
} from './sizing';

const aida14 = fabricById('aida-14');

describe('sizing', () => {
  it('converts between centimetres and stitches', () => {
    expect(cmToStitches(10, aida14)).toBe(55);
    expect(stitchesToCm(140, aida14)).toBeCloseTo(25.4, 6);
    expect(stitchSizeMm(aida14)).toBeCloseTo(1.814, 3);
  });

  it('treats 28 ct evenweave over two like 14 ct Aida', () => {
    const ew = fabricById('evenweave-28');
    expect(cmToStitches(10, ew)).toBe(cmToStitches(10, aida14));
  });

  it('clamps to the supported range', () => {
    expect(cmToStitches(1000, aida14)).toBe(MAX_STITCHES);
    expect(cmToStitches(0, aida14)).toBe(5);
  });

  it('fits an image inside a box without exceeding it', () => {
    const wide = fitToBox(2, 9, 9, aida14);
    expect(wide).toEqual({ width: 49, height: 24 });
    expect(stitchesToCm(wide.width, aida14)).toBeLessThanOrEqual(9);
    const tall = fitToBox(0.5, 9, 9, aida14);
    expect(tall.height).toBe(49);
    expect(tall.width).toBe(24);
  });

  it('adds a margin for the fabric piece', () => {
    const piece = fabricPieceCm(140, 70, aida14);
    expect(piece.width).toBeCloseTo(35.4, 6);
    expect(piece.height).toBeCloseTo(22.7, 6);
    const waste = fabricPieceCm(140, 70, fabricById('waste-14'));
    expect(waste.width).toBeCloseTo(30.4, 6);
  });

  it('has valid presets and unique fabric ids', () => {
    expect(new Set(FABRICS.map((f) => f.id)).size).toBe(FABRICS.length);
    for (const p of GARMENT_PRESETS) {
      expect(FABRICS.some((f) => f.id === p.fabricId)).toBe(true);
      expect(p.maxWidthCm).toBeGreaterThan(0);
    }
    expect(fabricById('nope').id).toBe('aida-14');
  });
});

describe('skeins', () => {
  it('estimates about 1800 stitches per skein on 14 ct with 2 strands', () => {
    expect(skeinsNeeded(1826, aida14, 2)).toBeCloseTo(1, 1);
    expect(skeinsToBuy(1, aida14, 2)).toBe(1);
    expect(skeinsToBuy(0, aida14, 2)).toBe(0);
    expect(skeinsToBuy(4000, aida14, 2)).toBe(3);
    // Fewer strands → fewer skeins.
    expect(skeinsNeeded(4000, aida14, 1)).toBeCloseTo(skeinsNeeded(4000, aida14, 2) / 2, 6);
  });

  it('computes thread length', () => {
    expect(threadLengthM(1000, aida14)).toBeCloseTo(13.14, 1);
  });
});
