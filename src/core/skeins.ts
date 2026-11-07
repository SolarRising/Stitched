import { stitchSizeMm, type Fabric } from './sizing';

/** A standard 6-strand cotton skein (e.g. DMC Mouliné) is 8 m long. */
export const SKEIN_LENGTH_M = 8;
export const STRANDS_PER_SKEIN = 6;

/**
 * Thread used by one full cross stitch, in mm of the working bundle: the two diagonals on
 * the front (2·√2·s) plus travel on the back (≈2·s), times 1.5 for tails, starts and waste.
 * On 14 ct with 2 strands this gives ≈1800 stitches per skein, in line with common charts.
 */
export function threadPerStitchMm(f: Fabric): number {
  return stitchSizeMm(f) * (2 * Math.SQRT2 + 2) * 1.5;
}

/** Length (m) of the working bundle needed for `stitches` cross stitches. */
export function threadLengthM(stitches: number, f: Fabric): number {
  return (stitches * threadPerStitchMm(f)) / 1000;
}

/** Fractional number of skeins needed. */
export function skeinsNeeded(stitches: number, f: Fabric, strands: number): number {
  const strandMm = stitches * threadPerStitchMm(f) * strands;
  return strandMm / (SKEIN_LENGTH_M * 1000 * STRANDS_PER_SKEIN);
}

/** Whole skeins to buy (at least one for any used colour). */
export function skeinsToBuy(stitches: number, f: Fabric, strands: number): number {
  if (stitches <= 0) return 0;
  return Math.max(1, Math.ceil(skeinsNeeded(stitches, f, strands) - 1e-9));
}
