/** Page geometry for printed charts (all values in millimetres). */

export type Paper = 'a4' | 'letter';

export const PAPER_MM: Record<Paper, readonly [number, number]> = {
  a4: [210, 297],
  letter: [215.9, 279.4],
};

export const CELL_SIZES_MM = { small: 2.6, medium: 3.2, large: 4.2 } as const;
export type CellSize = keyof typeof CELL_SIZES_MM;

export const MARGIN = 12;
export const HEADER = 13;
export const FOOTER = 9;
/** Band for row / column numbers next to the grid. */
export const AXIS = 7;
/** Rows/columns repeated from the previous page so it's easy to line pages up. */
export const OVERLAP = 2;

export interface Tile {
  /** 0-based position in the page grid. */
  tx: number;
  ty: number;
  col0: number;
  row0: number;
  cols: number;
  rows: number;
}

export interface ChartLayout {
  paper: Paper;
  pageWidth: number;
  pageHeight: number;
  cellMm: number;
  /** Maximum cells per page. */
  cols: number;
  rows: number;
  tilesX: number;
  tilesY: number;
  tiles: Tile[];
  gridLeft: number;
  gridTop: number;
}

function tileStarts(total: number, perPage: number, overlap: number): number[] {
  if (total <= perPage) return [0];
  const step = perPage - overlap;
  const starts: number[] = [];
  for (let s = 0; ; s += step) {
    starts.push(s);
    if (s + perPage >= total) break;
  }
  return starts;
}

export function chartLayout(
  patternWidth: number,
  patternHeight: number,
  paper: Paper,
  cellMm: number,
): ChartLayout {
  const [pageWidth, pageHeight] = PAPER_MM[paper];
  const cols = Math.max(OVERLAP + 1, Math.floor((pageWidth - 2 * MARGIN - AXIS) / cellMm));
  const rows = Math.max(
    OVERLAP + 1,
    Math.floor((pageHeight - 2 * MARGIN - HEADER - FOOTER - AXIS) / cellMm),
  );
  const xs = tileStarts(patternWidth, cols, OVERLAP);
  const ys = tileStarts(patternHeight, rows, OVERLAP);
  const tiles: Tile[] = [];
  ys.forEach((row0, ty) =>
    xs.forEach((col0, tx) =>
      tiles.push({
        tx,
        ty,
        col0,
        row0,
        cols: Math.min(cols, patternWidth - col0),
        rows: Math.min(rows, patternHeight - row0),
      }),
    ),
  );
  return {
    paper,
    pageWidth,
    pageHeight,
    cellMm,
    cols,
    rows,
    tilesX: xs.length,
    tilesY: ys.length,
    tiles,
    gridLeft: MARGIN + AXIS,
    gridTop: MARGIN + HEADER + AXIS,
  };
}
