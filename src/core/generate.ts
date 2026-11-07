import { removeSmallRegions } from './cleanup';
import {
  applyAdjustments,
  resampleToGrid,
  type Adjustments,
  type CropRect,
  type RasterImage,
  type ResampleMode,
} from './image';
import { DMC, type Thread } from './palettes';
import { compactByUsage, quantizeGrid } from './quantize';

/** Everything that affects the generated stitch grid (rotation is applied to the image beforehand). */
export interface GenerateOptions extends Adjustments {
  width: number;
  height: number;
  crop: CropRect;
  maxColors: number;
  dither: boolean;
  /** Minimum region size to keep; 0 or 1 disables cleanup. */
  cleanup: number;
  resample: ResampleMode;
  alphaThreshold: number;
  /** Thread ids that must not be used. */
  excluded: string[];
}

/** Worker output: a grid of thread indices before user post-processing. */
export interface GeneratedGrid {
  width: number;
  height: number;
  cells: Uint16Array;
  /** Thread ids, ordered by stitch count (descending). */
  threadIds: string[];
}

export function availablePalette(excluded: readonly string[]): Thread[] {
  if (excluded.length === 0) return [...DMC];
  const ex = new Set(excluded);
  const left = DMC.filter((t) => !ex.has(t.id));
  return left.length > 0 ? left : [...DMC];
}

export function generateGrid(image: RasterImage, o: GenerateOptions): GeneratedGrid {
  const colors = resampleToGrid(image, o.crop, o.width, o.height, o.resample);
  applyAdjustments(colors.rgb, o);
  const palette = availablePalette(o.excluded);
  let q = quantizeGrid(colors, palette, {
    maxColors: o.maxColors,
    dither: o.dither,
    alphaThreshold: o.alphaThreshold,
  });
  if (o.cleanup > 1) {
    const cleaned = removeSmallRegions(q.cells, q.width, q.height, o.cleanup);
    q = compactByUsage(cleaned, q.threads, q.width, q.height);
  }
  return {
    width: q.width,
    height: q.height,
    cells: q.cells,
    threadIds: q.threads.map((t) => t.id),
  };
}
