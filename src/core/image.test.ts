import { describe, expect, it } from 'vitest';
import { applyAdjustments, cropAspect, resampleToGrid, rotateImage, FULL_CROP } from './image';
import { makeImage } from './testUtils';

describe('rotateImage', () => {
  // 3×2 image, pixel value encodes its position.
  const img = makeImage(3, 2, (x, y) => [x, y, 0]);
  const at = (im: { width: number; data: Uint8ClampedArray }, x: number, y: number) => [
    im.data[(y * im.width + x) * 4],
    im.data[(y * im.width + x) * 4 + 1],
  ];

  it('rotates 90° clockwise', () => {
    const r = rotateImage(img, 90);
    expect([r.width, r.height]).toEqual([2, 3]);
    // Top-left of the result is the bottom-left of the source.
    expect(at(r, 0, 0)).toEqual([0, 1]);
    expect(at(r, 1, 0)).toEqual([0, 0]);
    expect(at(r, 1, 2)).toEqual([2, 0]);
  });

  it('rotates 180° and 270°', () => {
    const r180 = rotateImage(img, 180);
    expect(at(r180, 0, 0)).toEqual([2, 1]);
    const r270 = rotateImage(img, 270);
    expect([r270.width, r270.height]).toEqual([2, 3]);
    expect(at(r270, 0, 0)).toEqual([2, 0]);
    // Four quarter turns give back the original.
    const back = rotateImage(rotateImage(rotateImage(rotateImage(img, 90), 90), 90), 90);
    expect(Array.from(back.data)).toEqual(Array.from(img.data));
  });
});

describe('resampleToGrid', () => {
  it('averages blocks of pixels', () => {
    // 4×2: left half black/white checker (avg 127.5), right half red.
    const img = makeImage(4, 2, (x, y) => (x < 2 ? ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]) : [255, 0, 0]));
    const g = resampleToGrid(img, FULL_CROP, 2, 1, 'average');
    expect(g.rgb[0]).toBeCloseTo(127.5);
    expect(Array.from(g.rgb.slice(3, 6))).toEqual([255, 0, 0]);
    expect(Array.from(g.alpha)).toEqual([1, 1]);
  });

  it('weights colour by alpha and reports coverage', () => {
    const img = makeImage(2, 1, (x) => (x === 0 ? [200, 0, 0, 255] : [0, 0, 200, 0]));
    const g = resampleToGrid(img, FULL_CROP, 1, 1, 'average');
    expect(g.rgb[0]).toBeCloseTo(200);
    expect(g.rgb[2]).toBeCloseTo(0);
    expect(g.alpha[0]).toBeCloseTo(0.5);
  });

  it('keeps the dominant colour in sharp mode', () => {
    // 3 of 4 pixels green, one blue.
    const img = makeImage(2, 2, (x, y) => (x === 1 && y === 1 ? [0, 0, 255] : [0, 200, 0]));
    const g = resampleToGrid(img, FULL_CROP, 1, 1, 'sharp');
    expect(Array.from(g.rgb)).toEqual([0, 200, 0]);
  });

  it('honours the crop and can upscale', () => {
    const img = makeImage(2, 1, (x) => (x === 0 ? [10, 10, 10] : [250, 250, 250]));
    const right = resampleToGrid(img, { x: 0.5, y: 0, w: 0.5, h: 1 }, 3, 3, 'average');
    expect(right.rgb[0]).toBe(250);
    expect(right.rgb[right.rgb.length - 1]).toBe(250);
    expect(cropAspect(200, 100, { x: 0, y: 0, w: 0.5, h: 1 })).toBe(1);
  });
});

describe('applyAdjustments', () => {
  it('desaturates fully at −100', () => {
    const rgb = new Float32Array([255, 0, 0]);
    applyAdjustments(rgb, { brightness: 0, contrast: 0, saturation: -100 });
    expect(rgb[0]).toBeCloseTo(rgb[1]);
    expect(rgb[1]).toBeCloseTo(rgb[2]);
  });

  it('brightens and clamps', () => {
    const rgb = new Float32Array([250, 100, 0]);
    applyAdjustments(rgb, { brightness: 50, contrast: 0, saturation: 0 });
    expect(rgb[0]).toBe(255);
    expect(rgb[1]).toBeCloseTo(163.75);
  });

  it('is a no-op at zero', () => {
    const rgb = new Float32Array([1, 2, 3]);
    applyAdjustments(rgb, { brightness: 0, contrast: 0, saturation: 0 });
    expect(Array.from(rgb)).toEqual([1, 2, 3]);
  });
});
