/** Raster operations on plain RGBA buffers (no DOM), shared by the worker and tests. */

export interface RasterImage {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major, 4 bytes per pixel. */
  readonly data: Uint8ClampedArray;
}

export type Rotation = 0 | 90 | 180 | 270;

/** Normalised crop rectangle (0–1) relative to the rotated image. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

export type ResampleMode = 'average' | 'sharp';

export interface Adjustments {
  /** −100…100 */
  brightness: number;
  /** −100…100 */
  contrast: number;
  /** −100…100 */
  saturation: number;
}

/** Stitch-grid sized colour data: RGB as floats (0–255) and coverage alpha (0–1). */
export interface GridColors {
  width: number;
  height: number;
  rgb: Float32Array;
  alpha: Float32Array;
}

export function rotateImage(img: RasterImage, rotation: Rotation): RasterImage {
  if (rotation === 0) return img;
  const { width: w, height: h, data: src } = img;
  const swap = rotation !== 180;
  const ow = swap ? h : w;
  const oh = swap ? w : h;
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx: number;
      let ny: number;
      if (rotation === 90) {
        nx = h - 1 - y;
        ny = x;
      } else if (rotation === 180) {
        nx = w - 1 - x;
        ny = h - 1 - y;
      } else {
        nx = y;
        ny = w - 1 - x;
      }
      const si = (y * w + x) * 4;
      const di = (ny * ow + nx) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return { width: ow, height: oh, data: out };
}

export function normalizeCrop(c: CropRect): CropRect {
  const x = Math.min(Math.max(c.x, 0), 1);
  const y = Math.min(Math.max(c.y, 0), 1);
  const w = Math.min(Math.max(c.w, 0.001), 1 - x);
  const h = Math.min(Math.max(c.h, 0.001), 1 - y);
  return { x, y, w, h };
}

/** Aspect ratio (width / height) of the cropped area of an image. */
export function cropAspect(imgWidth: number, imgHeight: number, crop: CropRect): number {
  const c = normalizeCrop(crop);
  return (imgWidth * c.w) / (imgHeight * c.h);
}

/** Pixel index ranges [start, end) covered by each output cell along one axis. */
function cellRanges(offset: number, span: number, cells: number, size: number): Int32Array {
  const out = new Int32Array(cells * 2);
  const step = span / cells;
  for (let i = 0; i < cells; i++) {
    const a = offset + i * step;
    const b = a + step;
    // Pixels whose centres fall inside [a, b).
    let start = Math.ceil(a - 0.5);
    let end = Math.ceil(b - 0.5);
    if (end <= start) {
      // Upscaling: the cell is smaller than a pixel — take the pixel under its centre.
      start = Math.floor((a + b) / 2);
      end = start + 1;
    }
    start = Math.min(Math.max(start, 0), size - 1);
    end = Math.min(Math.max(end, start + 1), size);
    out[i * 2] = start;
    out[i * 2 + 1] = end;
  }
  return out;
}

/**
 * Downsamples the cropped image to the stitch grid.
 * - `average`: alpha-weighted box filter — smooth, good for photos.
 * - `sharp`: the dominant colour within each cell — keeps logos and pixel art crisp.
 */
export function resampleToGrid(
  img: RasterImage,
  crop: CropRect,
  width: number,
  height: number,
  mode: ResampleMode,
): GridColors {
  const c = normalizeCrop(crop);
  const xs = cellRanges(c.x * img.width, c.w * img.width, width, img.width);
  const ys = cellRanges(c.y * img.height, c.h * img.height, height, img.height);
  const rgb = new Float32Array(width * height * 3);
  const alpha = new Float32Array(width * height);
  const src = img.data;
  const stride = img.width * 4;
  const bins = mode === 'sharp' ? new Int32Array(4096) : null;
  const touched: number[] = [];

  for (let cy = 0; cy < height; cy++) {
    const y0 = ys[cy * 2];
    const y1 = ys[cy * 2 + 1];
    for (let cx = 0; cx < width; cx++) {
      const x0 = xs[cx * 2];
      const x1 = xs[cx * 2 + 1];
      const cell = cy * width + cx;
      const total = (x1 - x0) * (y1 - y0);

      if (!bins) {
        let sr = 0;
        let sg = 0;
        let sb = 0;
        let sa = 0;
        for (let y = y0; y < y1; y++) {
          let i = y * stride + x0 * 4;
          for (let x = x0; x < x1; x++, i += 4) {
            const a = src[i + 3];
            sr += src[i] * a;
            sg += src[i + 1] * a;
            sb += src[i + 2] * a;
            sa += a;
          }
        }
        if (sa > 0) {
          rgb[cell * 3] = sr / sa;
          rgb[cell * 3 + 1] = sg / sa;
          rgb[cell * 3 + 2] = sb / sa;
        }
        alpha[cell] = sa / (total * 255);
      } else {
        let opaque = 0;
        let bestKey = -1;
        let bestCount = 0;
        for (let y = y0; y < y1; y++) {
          let i = y * stride + x0 * 4;
          for (let x = x0; x < x1; x++, i += 4) {
            if (src[i + 3] < 128) continue;
            opaque++;
            const key = ((src[i] >> 4) << 8) | ((src[i + 1] >> 4) << 4) | (src[i + 2] >> 4);
            if (bins[key] === 0) touched.push(key);
            const n = ++bins[key];
            if (n > bestCount) {
              bestCount = n;
              bestKey = key;
            }
          }
        }
        if (bestKey >= 0) {
          let sr = 0;
          let sg = 0;
          let sb = 0;
          for (let y = y0; y < y1; y++) {
            let i = y * stride + x0 * 4;
            for (let x = x0; x < x1; x++, i += 4) {
              if (src[i + 3] < 128) continue;
              const key = ((src[i] >> 4) << 8) | ((src[i + 1] >> 4) << 4) | (src[i + 2] >> 4);
              if (key !== bestKey) continue;
              sr += src[i];
              sg += src[i + 1];
              sb += src[i + 2];
            }
          }
          rgb[cell * 3] = sr / bestCount;
          rgb[cell * 3 + 1] = sg / bestCount;
          rgb[cell * 3 + 2] = sb / bestCount;
        }
        alpha[cell] = opaque / total;
        for (const k of touched) bins[k] = 0;
        touched.length = 0;
      }
    }
  }
  return { width, height, rgb, alpha };
}

/** Brightness / contrast / saturation, applied in place. */
export function applyAdjustments(rgb: Float32Array, adj: Adjustments): void {
  const { brightness, contrast, saturation } = adj;
  if (brightness === 0 && contrast === 0 && saturation === 0) return;
  const bOffset = brightness * 1.275;
  const C = contrast * 2.55;
  const cFactor = (259 * (C + 255)) / (255 * (259 - C));
  const sFactor = 1 + saturation / 100;
  const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
  for (let i = 0; i < rgb.length; i += 3) {
    let r = rgb[i] + bOffset;
    let g = rgb[i + 1] + bOffset;
    let b = rgb[i + 2] + bOffset;
    r = cFactor * (r - 128) + 128;
    g = cFactor * (g - 128) + 128;
    b = cFactor * (b - 128) + 128;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    rgb[i] = clamp(gray + (r - gray) * sFactor);
    rgb[i + 1] = clamp(gray + (g - gray) * sFactor);
    rgb[i + 2] = clamp(gray + (b - gray) * sFactor);
  }
}
