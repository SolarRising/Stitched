/**
 * Colour reduction: maps stitch-grid colours onto at most N threads of a palette.
 *
 * 1. Cell colours are converted to CIELAB and binned (5 bits per RGB channel).
 * 2. If the bins' nearest threads already fit in N colours, those are used directly.
 * 3. Otherwise weighted k-means++ runs in Lab space, and the cluster centres are snapped to
 *    distinct threads (largest clusters pick first), then refined a few rounds so every
 *    chosen thread sits near the mean of the colours it represents.
 * 4. Each cell gets its perceptually closest chosen thread (CIEDE2000), optionally with
 *    gentle Floyd–Steinberg error diffusion in Lab space.
 */
import { ciede2000, deltaE76Sq, rgbToLab } from './color';
import type { GridColors } from './image';
import type { Thread } from './palettes';
import { mulberry32 } from './random';

/** Cell value meaning "no stitch". */
export const EMPTY = 0xffff;

export interface QuantizeOptions {
  maxColors: number;
  dither: boolean;
  /** Cells whose coverage alpha is below this (0–1) are left unstitched. */
  alphaThreshold: number;
  /** Error diffusion strength when dithering (0–1). */
  ditherStrength?: number;
  seed?: number;
}

export interface QuantizedGrid {
  width: number;
  height: number;
  /** Index into `threads`, or EMPTY. */
  cells: Uint16Array;
  /** Threads used, ordered by stitch count (descending). */
  threads: Thread[];
}

const PREFILTER = 10;
/** Above this many colour bins, clustering switches to coarser bins. */
const MAX_POINTS = 4096;
const topIdx = new Int32Array(PREFILTER);
const topD = new Float64Array(PREFILTER);

/** Nearest entry by plain CIE76 distance. */
function nearestIndex76(labs: Float64Array, count: number, L: number, a: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < count; i++) {
    const d = deltaE76Sq(L, a, b, labs[i * 3], labs[i * 3 + 1], labs[i * 3 + 2]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Nearest palette entry by CIEDE2000, pre-filtered by CIE76. Returns an index into `labs`. */
function nearestIndex(
  labs: Float64Array,
  count: number,
  L: number,
  a: number,
  b: number,
  exclude?: Set<number>,
  prefilter = PREFILTER,
): number {
  const k = Math.min(prefilter, PREFILTER, count);
  topIdx.fill(-1);
  topD.fill(Infinity);
  for (let i = 0; i < count; i++) {
    if (exclude?.has(i)) continue;
    const d = deltaE76Sq(L, a, b, labs[i * 3], labs[i * 3 + 1], labs[i * 3 + 2]);
    if (d >= topD[k - 1]) continue;
    let j = k - 1;
    while (j > 0 && topD[j - 1] > d) {
      topD[j] = topD[j - 1];
      topIdx[j] = topIdx[j - 1];
      j--;
    }
    topD[j] = d;
    topIdx[j] = i;
  }
  let best = topIdx[0];
  let bestD = Infinity;
  for (let j = 0; j < k; j++) {
    const i = topIdx[j];
    if (i < 0) break;
    const d = ciede2000(L, a, b, labs[i * 3], labs[i * 3 + 1], labs[i * 3 + 2]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function labsOf(threads: readonly Thread[]): Float64Array {
  const out = new Float64Array(threads.length * 3);
  threads.forEach((t, i) => {
    out[i * 3] = t.lab[0];
    out[i * 3 + 1] = t.lab[1];
    out[i * 3 + 2] = t.lab[2];
  });
  return out;
}

/** Weighted k-means++ in Lab space (CIE76). Returns k centres (fewer if not enough points). */
export function kMeans(
  points: Float64Array,
  weights: Float64Array,
  k: number,
  rand: () => number,
  maxIter = 30,
): { centers: Float64Array; assignment: Int32Array; clusterWeights: Float64Array } {
  const n = weights.length;
  k = Math.min(k, n);
  const centers = new Float64Array(k * 3);
  const d2 = new Float64Array(n).fill(Infinity);

  const pickWeighted = (score: (i: number) => number): number => {
    let total = 0;
    for (let i = 0; i < n; i++) total += score(i);
    if (total <= 0) return Math.floor(rand() * n);
    let r = rand() * total;
    for (let i = 0; i < n; i++) {
      r -= score(i);
      if (r <= 0) return i;
    }
    return n - 1;
  };
  const updateD2 = (c: number) => {
    const L = centers[c * 3];
    const a = centers[c * 3 + 1];
    const b = centers[c * 3 + 2];
    for (let i = 0; i < n; i++) {
      const d = deltaE76Sq(points[i * 3], points[i * 3 + 1], points[i * 3 + 2], L, a, b);
      if (d < d2[i]) d2[i] = d;
    }
  };

  for (let c = 0; c < k; c++) {
    const p = c === 0 ? pickWeighted((i) => weights[i]) : pickWeighted((i) => weights[i] * d2[i]);
    centers[c * 3] = points[p * 3];
    centers[c * 3 + 1] = points[p * 3 + 1];
    centers[c * 3 + 2] = points[p * 3 + 2];
    updateD2(c);
  }

  const assignment = new Int32Array(n);
  const sums = new Float64Array(k * 3);
  const clusterWeights = new Float64Array(k);
  for (let iter = 0; iter < maxIter; iter++) {
    sums.fill(0);
    clusterWeights.fill(0);
    for (let i = 0; i < n; i++) {
      const L = points[i * 3];
      const a = points[i * 3 + 1];
      const b = points[i * 3 + 2];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = deltaE76Sq(L, a, b, centers[c * 3], centers[c * 3 + 1], centers[c * 3 + 2]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assignment[i] = best;
      d2[i] = bestD;
      const w = weights[i];
      sums[best * 3] += L * w;
      sums[best * 3 + 1] += a * w;
      sums[best * 3 + 2] += b * w;
      clusterWeights[best] += w;
    }
    let maxShift = 0;
    for (let c = 0; c < k; c++) {
      let L: number;
      let a: number;
      let b: number;
      if (clusterWeights[c] > 0) {
        L = sums[c * 3] / clusterWeights[c];
        a = sums[c * 3 + 1] / clusterWeights[c];
        b = sums[c * 3 + 2] / clusterWeights[c];
      } else {
        // Empty cluster: restart it on the worst-represented point.
        let worst = 0;
        for (let i = 1; i < n; i++) if (weights[i] * d2[i] > weights[worst] * d2[worst]) worst = i;
        L = points[worst * 3];
        a = points[worst * 3 + 1];
        b = points[worst * 3 + 2];
        d2[worst] = 0;
        maxShift = Infinity;
      }
      const shift = deltaE76Sq(L, a, b, centers[c * 3], centers[c * 3 + 1], centers[c * 3 + 2]);
      if (shift > maxShift) maxShift = shift;
      centers[c * 3] = L;
      centers[c * 3 + 1] = a;
      centers[c * 3 + 2] = b;
    }
    if (maxShift < 0.01) break;
  }
  return { centers, assignment, clusterWeights };
}

/** Snaps cluster means to distinct palette threads, heaviest clusters choosing first. */
function snapToPalette(
  means: Float64Array,
  meanWeights: Float64Array,
  paletteLabs: Float64Array,
  paletteSize: number,
): number[] {
  const order = Array.from(meanWeights.keys())
    .filter((c) => meanWeights[c] > 0)
    .sort((x, y) => meanWeights[y] - meanWeights[x]);
  const used = new Set<number>();
  const chosen: number[] = [];
  for (const c of order) {
    if (used.size >= paletteSize) break;
    const idx = nearestIndex(
      paletteLabs,
      paletteSize,
      means[c * 3],
      means[c * 3 + 1],
      means[c * 3 + 2],
      used,
    );
    used.add(idx);
    chosen.push(idx);
  }
  return chosen;
}

export function quantizeGrid(
  grid: GridColors,
  palette: readonly Thread[],
  opts: QuantizeOptions,
): QuantizedGrid {
  const { width, height, rgb, alpha } = grid;
  const n = width * height;
  const cells = new Uint16Array(n).fill(EMPTY);
  if (palette.length === 0) return { width, height, cells, threads: [] };

  const maxColors = Math.max(1, Math.min(Math.floor(opts.maxColors), palette.length, EMPTY - 1));
  const labs = new Float32Array(n * 3);
  const keys = new Int32Array(n).fill(-1);
  const binCount = new Float64Array(32768);
  const binSum = new Float64Array(32768 * 3);
  const labCache = new Map<number, [number, number, number]>();

  for (let i = 0; i < n; i++) {
    if (alpha[i] < opts.alphaThreshold || alpha[i] === 0) continue;
    const r = Math.round(rgb[i * 3]);
    const g = Math.round(rgb[i * 3 + 1]);
    const b = Math.round(rgb[i * 3 + 2]);
    const key = (r << 16) | (g << 8) | b;
    keys[i] = key;
    let lab = labCache.get(key);
    if (!lab) {
      lab = rgbToLab(r, g, b);
      labCache.set(key, lab);
    }
    labs[i * 3] = lab[0];
    labs[i * 3 + 1] = lab[1];
    labs[i * 3 + 2] = lab[2];
    const bin = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    binCount[bin]++;
    binSum[bin * 3] += lab[0];
    binSum[bin * 3 + 1] += lab[1];
    binSum[bin * 3 + 2] += lab[2];
  }

  let binIds: number[] = [];
  for (let bin = 0; bin < 32768; bin++) if (binCount[bin] > 0) binIds.push(bin);
  if (binIds.length === 0) return { width, height, cells, threads: [] };

  let counts = binCount;
  let sums = binSum;
  if (binIds.length > MAX_POINTS) {
    // Too many distinct colours for fast clustering: merge into 4-bit-per-channel bins.
    // Each bin keeps the exact mean Lab of its members, so precision is barely affected.
    counts = new Float64Array(4096);
    sums = new Float64Array(4096 * 3);
    for (const bin of binIds) {
      const coarse = ((bin >> 11) << 8) | (((bin >> 6) & 15) << 4) | ((bin >> 1) & 15);
      counts[coarse] += binCount[bin];
      sums[coarse * 3] += binSum[bin * 3];
      sums[coarse * 3 + 1] += binSum[bin * 3 + 1];
      sums[coarse * 3 + 2] += binSum[bin * 3 + 2];
    }
    binIds = [];
    for (let bin = 0; bin < 4096; bin++) if (counts[bin] > 0) binIds.push(bin);
  }

  const P = binIds.length;
  const points = new Float64Array(P * 3);
  const weights = new Float64Array(P);
  binIds.forEach((bin, p) => {
    const c = counts[bin];
    points[p * 3] = sums[bin * 3] / c;
    points[p * 3 + 1] = sums[bin * 3 + 1] / c;
    points[p * 3 + 2] = sums[bin * 3 + 2] / c;
    weights[p] = c;
  });

  const paletteLabs = labsOf(palette);
  const paletteSize = palette.length;

  // Direct mapping when the image already needs few threads (stops as soon as it doesn't).
  const direct = new Set<number>();
  for (let p = 0; p < P && direct.size <= maxColors; p++) {
    direct.add(nearestIndex(paletteLabs, paletteSize, points[p * 3], points[p * 3 + 1], points[p * 3 + 2]));
  }

  let chosen: number[];
  if (direct.size <= maxColors) {
    chosen = [...direct.keys()];
  } else {
    const rand = mulberry32(opts.seed ?? 1);
    const { centers, clusterWeights } = kMeans(points, weights, maxColors, rand);
    chosen = snapToPalette(centers, clusterWeights, paletteLabs, paletteSize);

    // Refine: re-centre each chosen thread on the colours it actually represents.
    for (let round = 0; round < 4; round++) {
      const chosenLabs = labsOf(chosen.map((i) => palette[i]));
      const sums = new Float64Array(chosen.length * 3);
      const ws = new Float64Array(chosen.length);
      for (let p = 0; p < P; p++) {
        const L = points[p * 3];
        const a = points[p * 3 + 1];
        const b = points[p * 3 + 2];
        const c = nearestIndex76(chosenLabs, chosen.length, L, a, b);
        const w = weights[p];
        sums[c * 3] += L * w;
        sums[c * 3 + 1] += a * w;
        sums[c * 3 + 2] += b * w;
        ws[c] += w;
      }
      for (let c = 0; c < chosen.length; c++) {
        if (ws[c] > 0) {
          sums[c * 3] /= ws[c];
          sums[c * 3 + 1] /= ws[c];
          sums[c * 3 + 2] /= ws[c];
        }
      }
      const next = snapToPalette(sums, ws, paletteLabs, paletteSize);
      const same = next.length === chosen.length && next.every((v) => chosen.includes(v));
      chosen = next;
      if (same) break;
    }
  }

  const chosenThreads = chosen.map((i) => palette[i]);
  const chosenLabs = labsOf(chosenThreads);
  const k = chosenThreads.length;

  if (opts.dither) {
    const strength = opts.ditherStrength ?? 0.75;
    const err = new Float32Array(n * 3);
    for (let y = 0; y < height; y++) {
      const ltr = y % 2 === 0;
      for (let step = 0; step < width; step++) {
        const x = ltr ? step : width - 1 - step;
        const i = y * width + x;
        if (keys[i] < 0) continue;
        const L = Math.min(100, Math.max(0, labs[i * 3] + err[i * 3]));
        const a = Math.min(127, Math.max(-128, labs[i * 3 + 1] + err[i * 3 + 1]));
        const b = Math.min(127, Math.max(-128, labs[i * 3 + 2] + err[i * 3 + 2]));
        let best = 0;
        let bestD = Infinity;
        for (let c = 0; c < k; c++) {
          const d = deltaE76Sq(L, a, b, chosenLabs[c * 3], chosenLabs[c * 3 + 1], chosenLabs[c * 3 + 2]);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        cells[i] = best;
        const eL = (L - chosenLabs[best * 3]) * strength;
        const ea = (a - chosenLabs[best * 3 + 1]) * strength;
        const eb = (b - chosenLabs[best * 3 + 2]) * strength;
        const dx = ltr ? 1 : -1;
        const spread = (nx: number, ny: number, f: number) => {
          if (nx < 0 || nx >= width || ny >= height) return;
          const j = ny * width + nx;
          if (keys[j] < 0) return;
          err[j * 3] += eL * f;
          err[j * 3 + 1] += ea * f;
          err[j * 3 + 2] += eb * f;
        };
        spread(x + dx, y, 7 / 16);
        spread(x - dx, y + 1, 3 / 16);
        spread(x, y + 1, 5 / 16);
        spread(x + dx, y + 1, 1 / 16);
      }
    }
  } else {
    const cache = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const key = keys[i];
      if (key < 0) continue;
      let c = cache.get(key);
      if (c === undefined) {
        c = nearestIndex(chosenLabs, k, labs[i * 3], labs[i * 3 + 1], labs[i * 3 + 2], undefined, 4);
        cache.set(key, c);
      }
      cells[i] = c;
    }
  }

  return compactByUsage(cells, chosenThreads, width, height);
}

/** Drops unused threads and orders the rest by stitch count (descending), remapping cells. */
export function compactByUsage(
  cells: Uint16Array,
  threads: readonly Thread[],
  width: number,
  height: number,
): QuantizedGrid {
  const counts = new Array<number>(threads.length).fill(0);
  for (let i = 0; i < cells.length; i++) if (cells[i] !== EMPTY) counts[cells[i]]++;
  const order = threads
    .map((_, i) => i)
    .filter((i) => counts[i] > 0)
    .sort((a, b) => counts[b] - counts[a] || threads[a].order - threads[b].order);
  const remap = new Uint16Array(threads.length).fill(EMPTY);
  order.forEach((old, idx) => (remap[old] = idx));
  const out = new Uint16Array(cells.length);
  for (let i = 0; i < cells.length; i++) out[i] = cells[i] === EMPTY ? EMPTY : remap[cells[i]];
  return { width, height, cells: out, threads: order.map((i) => threads[i]) };
}
