import type { GeneratedGrid } from './generate';
import { threadById, type Thread } from './palettes';
import { EMPTY } from './quantize';

export { EMPTY };

/** Edit value meaning "remove the stitch". */
export const NO_STITCH = '';

export interface PatternColor {
  thread: Thread;
  count: number;
  /** Index into the symbol set; stable while the user edits. */
  symbol: number;
}

export interface Pattern {
  width: number;
  height: number;
  /** Index into `colors`, or EMPTY. */
  cells: Uint16Array;
  colors: PatternColor[];
  stitchCount: number;
}

/** Non-destructive user changes layered over a generated grid. */
export interface PostProcess {
  /** Thread ids left unstitched (the fabric shows through). */
  background: readonly string[];
  /** Thread id → replacement thread id. */
  replacements: Readonly<Record<string, string>>;
  /** Cell index → thread id, or NO_STITCH. */
  edits: ReadonlyMap<number, string>;
}

export function resolveReplacement(id: string, replacements: Readonly<Record<string, string>>): string {
  let current = id;
  const seen = new Set<string>();
  while (replacements[current] && !seen.has(current)) {
    seen.add(current);
    const next = replacements[current];
    if (!threadById(next)) break;
    current = next;
  }
  return current;
}

export function buildPattern(grid: GeneratedGrid, post: PostProcess): Pattern {
  const { width, height } = grid;
  const n = width * height;
  const background = new Set(post.background);
  const order: string[] = [];
  const indexOf = new Map<string, number>();
  const add = (id: string): number => {
    let i = indexOf.get(id);
    if (i === undefined) {
      i = order.length;
      order.push(id);
      indexOf.set(id, i);
    }
    return i;
  };

  const baseIdx = grid.threadIds.map((id) => {
    const resolved = resolveReplacement(id, post.replacements);
    if (background.has(resolved) || !threadById(resolved)) return EMPTY;
    return add(resolved);
  });

  const raw = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const c = grid.cells[i];
    raw[i] = c === EMPTY ? EMPTY : baseIdx[c];
  }
  for (const [i, id] of post.edits) {
    if (i < 0 || i >= n) continue;
    if (id === NO_STITCH) raw[i] = EMPTY;
    else if (threadById(id)) raw[i] = add(id);
  }

  const counts = new Array<number>(order.length).fill(0);
  for (let i = 0; i < n; i++) if (raw[i] !== EMPTY) counts[raw[i]]++;

  const remap = new Uint16Array(order.length).fill(EMPTY);
  const colors: PatternColor[] = [];
  order.forEach((id, i) => {
    if (counts[i] === 0) return;
    remap[i] = colors.length;
    colors.push({ thread: threadById(id)!, count: counts[i], symbol: i });
  });

  const cells = new Uint16Array(n);
  let stitchCount = 0;
  for (let i = 0; i < n; i++) {
    if (raw[i] === EMPTY) cells[i] = EMPTY;
    else {
      cells[i] = remap[raw[i]];
      stitchCount++;
    }
  }
  return { width, height, cells, colors, stitchCount };
}

/** Thread id at a cell of a pattern, or NO_STITCH. */
export function cellThreadId(p: Pattern, index: number): string {
  const c = p.cells[index];
  return c === EMPTY ? NO_STITCH : p.colors[c].thread.id;
}

/** Most common thread along the outer edge, if it dominates it (a likely background). */
export function detectBackground(p: Pattern, minShare = 0.35): string | null {
  const counts = new Map<number, number>();
  let total = 0;
  const visit = (x: number, y: number) => {
    const c = p.cells[y * p.width + x];
    total++;
    if (c !== EMPTY) counts.set(c, (counts.get(c) ?? 0) + 1);
  };
  for (let x = 0; x < p.width; x++) {
    visit(x, 0);
    if (p.height > 1) visit(x, p.height - 1);
  }
  for (let y = 1; y < p.height - 1; y++) {
    visit(0, y);
    if (p.width > 1) visit(p.width - 1, y);
  }
  let best = -1;
  let bestCount = 0;
  for (const [c, v] of counts) {
    if (v > bestCount) {
      best = c;
      bestCount = v;
    }
  }
  if (best < 0 || bestCount / total < minShare) return null;
  return p.colors[best].thread.id;
}

/** Cells of the 4-connected region sharing the start cell's value. */
export function floodRegion(
  cells: Uint16Array,
  width: number,
  height: number,
  start: number,
): number[] {
  const target = cells[start];
  const seen = new Uint8Array(cells.length);
  const out: number[] = [];
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    out.push(i);
    const x = i % width;
    const y = (i - x) / width;
    const tryPush = (j: number) => {
      if (!seen[j] && cells[j] === target) {
        seen[j] = 1;
        stack.push(j);
      }
    };
    if (x > 0) tryPush(i - 1);
    if (x < width - 1) tryPush(i + 1);
    if (y > 0) tryPush(i - width);
    if (y < height - 1) tryPush(i + width);
  }
  return out;
}

/** Grid cells on a straight line (Bresenham), so fast pencil strokes leave no gaps. */
export function lineCells(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}
