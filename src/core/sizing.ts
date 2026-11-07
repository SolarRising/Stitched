/** Fabrics, physical size conversions and garment placement presets. */

export type FabricKind = 'aida' | 'evenweave' | 'waste';

export interface Fabric {
  readonly id: string;
  readonly kind: FabricKind;
  /** Threads (or Aida blocks) per inch. */
  readonly count: number;
  /** Stitches worked over 1 or 2 threads. */
  readonly over: 1 | 2;
}

export const FABRICS: readonly Fabric[] = [
  { id: 'aida-11', kind: 'aida', count: 11, over: 1 },
  { id: 'aida-14', kind: 'aida', count: 14, over: 1 },
  { id: 'aida-16', kind: 'aida', count: 16, over: 1 },
  { id: 'aida-18', kind: 'aida', count: 18, over: 1 },
  { id: 'aida-20', kind: 'aida', count: 20, over: 1 },
  { id: 'evenweave-25', kind: 'evenweave', count: 25, over: 2 },
  { id: 'evenweave-28', kind: 'evenweave', count: 28, over: 2 },
  { id: 'evenweave-32', kind: 'evenweave', count: 32, over: 2 },
  { id: 'evenweave-36', kind: 'evenweave', count: 36, over: 2 },
  { id: 'waste-8.5', kind: 'waste', count: 8.5, over: 1 },
  { id: 'waste-10', kind: 'waste', count: 10, over: 1 },
  { id: 'waste-12', kind: 'waste', count: 12, over: 1 },
  { id: 'waste-14', kind: 'waste', count: 14, over: 1 },
];

export const DEFAULT_FABRIC_ID = 'aida-14';

export function fabricById(id: string): Fabric {
  return FABRICS.find((f) => f.id === id) ?? FABRICS.find((f) => f.id === DEFAULT_FABRIC_ID)!;
}

export function stitchesPerInch(f: Fabric): number {
  return f.count / f.over;
}

export function stitchesPerCm(f: Fabric): number {
  return stitchesPerInch(f) / 2.54;
}

/** Size of one stitch in millimetres. */
export function stitchSizeMm(f: Fabric): number {
  return 25.4 / stitchesPerInch(f);
}

export const MIN_STITCHES = 5;
export const MAX_STITCHES = 600;

export function clampStitches(n: number): number {
  if (!Number.isFinite(n)) return MIN_STITCHES;
  return Math.min(MAX_STITCHES, Math.max(MIN_STITCHES, Math.round(n)));
}

export function cmToStitches(cm: number, f: Fabric): number {
  return clampStitches(cm * stitchesPerCm(f));
}

export function stitchesToCm(n: number, f: Fabric): number {
  return n / stitchesPerCm(f);
}

/** Recommended strand count for full cross stitches on the given fabric. */
export function defaultStrands(f: Fabric): number {
  const spi = stitchesPerInch(f);
  if (spi <= 9) return 4;
  if (spi <= 11) return 3;
  if (spi <= 18) return 2;
  return 1;
}

/** Extra fabric around the design: room for a hoop, or for basting waste canvas. */
export function defaultMarginCm(f: Fabric): number {
  return f.kind === 'waste' ? 2.5 : 5;
}

export function fabricPieceCm(
  widthStitches: number,
  heightStitches: number,
  f: Fabric,
  marginCm = defaultMarginCm(f),
): { width: number; height: number } {
  return {
    width: stitchesToCm(widthStitches, f) + 2 * marginCm,
    height: stitchesToCm(heightStitches, f) + 2 * marginCm,
  };
}

/** Largest stitch grid with the given aspect ratio (width / height) that fits in a box. */
export function fitToBox(
  aspect: number,
  maxWidthCm: number,
  maxHeightCm: number,
  f: Fabric,
): { width: number; height: number } {
  const safeAspect = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  let wCm = maxWidthCm;
  let hCm = wCm / safeAspect;
  if (hCm > maxHeightCm) {
    hCm = maxHeightCm;
    wCm = hCm * safeAspect;
  }
  const spc = stitchesPerCm(f);
  // Floor so the design never exceeds the box; clamp keeps tiny/huge values usable.
  return {
    width: clampStitches(Math.max(MIN_STITCHES, Math.floor(wCm * spc))),
    height: clampStitches(Math.max(MIN_STITCHES, Math.floor(hCm * spc))),
  };
}

/** Height in stitches that keeps the aspect ratio for a given width (and vice versa). */
export function heightForWidth(width: number, aspect: number): number {
  return clampStitches(width / aspect);
}

export function widthForHeight(height: number, aspect: number): number {
  return clampStitches(height * aspect);
}

export interface GarmentPreset {
  readonly id: string;
  /** Maximum design area in centimetres; the image is fitted inside, keeping its proportions. */
  readonly maxWidthCm: number;
  readonly maxHeightCm: number;
  /** Fabric suggested for this placement. */
  readonly fabricId: string;
}

/**
 * Typical design areas for common placements on clothing and accessories (adult sizes).
 * They are starting points, not rules — every garment differs.
 */
export const GARMENT_PRESETS: readonly GarmentPreset[] = [
  { id: 'left-chest', maxWidthCm: 9, maxHeightCm: 9, fabricId: 'waste-14' },
  { id: 'center-chest', maxWidthCm: 22, maxHeightCm: 26, fabricId: 'waste-14' },
  { id: 'full-back', maxWidthCm: 28, maxHeightCm: 34, fabricId: 'waste-12' },
  { id: 'sleeve', maxWidthCm: 7, maxHeightCm: 9, fabricId: 'waste-14' },
  { id: 'collar', maxWidthCm: 4, maxHeightCm: 4, fabricId: 'waste-14' },
  { id: 'pocket', maxWidthCm: 7, maxHeightCm: 7, fabricId: 'waste-14' },
  { id: 'cap-front', maxWidthCm: 10, maxHeightCm: 5.5, fabricId: 'waste-14' },
  { id: 'denim-jacket-back', maxWidthCm: 30, maxHeightCm: 25, fabricId: 'waste-10' },
  { id: 'kids-tshirt', maxWidthCm: 16, maxHeightCm: 18, fabricId: 'waste-14' },
  { id: 'baby-bodysuit', maxWidthCm: 10, maxHeightCm: 10, fabricId: 'waste-14' },
  { id: 'tote-bag', maxWidthCm: 22, maxHeightCm: 24, fabricId: 'waste-12' },
  { id: 'patch', maxWidthCm: 8, maxHeightCm: 8, fabricId: 'aida-16' },
];

export function presetById(id: string | null | undefined): GarmentPreset | undefined {
  return id ? GARMENT_PRESETS.find((p) => p.id === id) : undefined;
}
