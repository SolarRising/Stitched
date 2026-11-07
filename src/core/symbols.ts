/**
 * Chart symbols, described in a unit square so the same definitions render on canvas and
 * in PDF. They are chosen to stay distinguishable when printed in black and white.
 */

export type FillMode = 'fill' | 'stroke';

/** Minimal drawing surface implemented for Canvas 2D and jsPDF. Coordinates are absolute. */
export interface Pen {
  setInk(color: string, lineWidth: number): void;
  rect(x: number, y: number, w: number, h: number, mode: FillMode): void;
  circle(cx: number, cy: number, r: number, mode: FillMode): void;
  /** Closed polygon from flat [x0, y0, x1, y1, …]. */
  polygon(points: number[], mode: FillMode): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  /** Bold text centred on (cx, cy); `size` is the font size in the pen's units. */
  text(s: string, cx: number, cy: number, size: number): void;
}

type Op =
  | readonly ['r', number, number, number, number, boolean]
  | readonly ['c', number, number, number, boolean]
  | readonly ['p', readonly number[], boolean]
  | readonly ['l', number, number, number, number]
  | readonly ['t', string, number];

export interface SymbolDef {
  readonly id: string;
  readonly ops: readonly Op[];
}

function starPoints(cx: number, cy: number, outer: number, inner: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return pts;
}

function heartPoints(): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * 2 * Math.PI;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push(0.5 + (hx / 16) * 0.33, 0.5 + ((hy - 2.5) / 14.5) * 0.31);
  }
  return pts;
}

function arcPoints(cx: number, cy: number, r: number, from: number, to: number, steps = 16): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return pts;
}

const SQ: readonly [number, number, number, number] = [0.22, 0.22, 0.56, 0.56];
const STAR = starPoints(0.5, 0.54, 0.36, 0.15);
const HEART = heartPoints();
const TRI_UP = [0.5, 0.18, 0.84, 0.8, 0.16, 0.8];
const TRI_DOWN = [0.16, 0.2, 0.84, 0.2, 0.5, 0.82];
const DIAMOND = [0.5, 0.13, 0.86, 0.5, 0.5, 0.87, 0.14, 0.5];

const SHAPES: Record<string, readonly Op[]> = {
  circleFilled: [['c', 0.5, 0.5, 0.3, true]],
  cross: [
    ['l', 0.22, 0.22, 0.78, 0.78],
    ['l', 0.78, 0.22, 0.22, 0.78],
  ],
  triUp: [['p', TRI_UP, false]],
  square: [['r', 0.24, 0.24, 0.52, 0.52, false]],
  plus: [
    ['l', 0.5, 0.17, 0.5, 0.83],
    ['l', 0.17, 0.5, 0.83, 0.5],
  ],
  diamondFilled: [['p', DIAMOND, true]],
  circle: [['c', 0.5, 0.5, 0.29, false]],
  triDownFilled: [['p', TRI_DOWN, true]],
  star: [['p', STAR, false]],
  squareFilled: [['r', ...SQ, true]],
  heart: [['p', HEART, true]],
  circleDot: [
    ['c', 0.5, 0.5, 0.3, false],
    ['c', 0.5, 0.5, 0.1, true],
  ],
  triUpFilled: [['p', TRI_UP, true]],
  bars3: [
    ['l', 0.2, 0.27, 0.8, 0.27],
    ['l', 0.2, 0.5, 0.8, 0.5],
    ['l', 0.2, 0.73, 0.8, 0.73],
  ],
  diamond: [['p', DIAMOND, false]],
  squareX: [
    ['r', ...SQ, false],
    ['l', 0.22, 0.22, 0.78, 0.78],
    ['l', 0.78, 0.22, 0.22, 0.78],
  ],
  hourglass: [
    ['p', [0.22, 0.2, 0.78, 0.2, 0.5, 0.5], true],
    ['p', [0.22, 0.8, 0.78, 0.8, 0.5, 0.5], true],
  ],
  halfSquare: [
    ['r', ...SQ, false],
    ['r', 0.22, 0.22, 0.28, 0.56, true],
  ],
  triDown: [['p', TRI_DOWN, false]],
  asterisk: [
    ['l', 0.5, 0.17, 0.5, 0.83],
    ['l', 0.21, 0.33, 0.79, 0.67],
    ['l', 0.21, 0.67, 0.79, 0.33],
  ],
  circlePlus: [
    ['c', 0.5, 0.5, 0.3, false],
    ['l', 0.5, 0.2, 0.5, 0.8],
    ['l', 0.2, 0.5, 0.8, 0.5],
  ],
  starFilled: [['p', STAR, true]],
  slash: [['l', 0.24, 0.8, 0.76, 0.2]],
  triLeftFilled: [['p', [0.8, 0.18, 0.8, 0.82, 0.2, 0.5], true]],
  smallSquare: [['r', 0.37, 0.37, 0.26, 0.26, true]],
  diagHalf: [
    ['r', ...SQ, false],
    ['p', [0.22, 0.22, 0.22, 0.78, 0.78, 0.78], true],
  ],
  squareDot: [
    ['r', ...SQ, false],
    ['r', 0.41, 0.41, 0.18, 0.18, true],
  ],
  bowtie: [
    ['p', [0.2, 0.22, 0.5, 0.5, 0.2, 0.78], true],
    ['p', [0.8, 0.22, 0.5, 0.5, 0.8, 0.78], true],
  ],
  triRight: [['p', [0.2, 0.18, 0.2, 0.82, 0.8, 0.5], false]],
  vbars2: [
    ['l', 0.36, 0.2, 0.36, 0.8],
    ['l', 0.64, 0.2, 0.64, 0.8],
  ],
  halfCircle: [
    ['c', 0.5, 0.5, 0.3, false],
    ['p', arcPoints(0.5, 0.5, 0.3, Math.PI / 2, (3 * Math.PI) / 2), true],
  ],
  dots2: [
    ['c', 0.31, 0.5, 0.12, true],
    ['c', 0.69, 0.5, 0.12, true],
  ],
  dots3: [
    ['c', 0.5, 0.29, 0.11, true],
    ['c', 0.29, 0.69, 0.11, true],
    ['c', 0.71, 0.69, 0.11, true],
  ],
  backslash: [['l', 0.24, 0.2, 0.76, 0.8]],
};

/** Order matters: the most used colours get the first (most distinct) symbols. */
// prettier-ignore
const ORDER = [
  'circleFilled', 'cross', 'triUp', 'square', 'g:A', 'plus', 'diamondFilled', 'g:S', 'circle',
  'triDownFilled', 'g:K', 'star', 'squareFilled', 'g:V', 'heart', 'circleDot', 'g:M',
  'triUpFilled', 'bars3', 'g:Z', 'diamond', 'g:2', 'squareX', 'hourglass', 'g:T', 'halfSquare',
  'g:5', 'triDown', 'g:R', 'asterisk', 'circlePlus', 'g:8', 'starFilled', 'g:H', 'slash',
  'triLeftFilled', 'g:E', 'smallSquare', 'diagHalf', 'g:7', 'squareDot', 'g:N', 'bowtie', 'g:U',
  'triRight', 'g:3', 'vbars2', 'g:P', 'halfCircle', 'g:#', 'dots2', 'g:%', 'dots3', 'g:&',
  'backslash', 'g:@', 'g:?', 'g:!', 'g:$', 'g:=', 'g:<', 'g:>', 'g:~', 'g:B', 'g:C', 'g:D',
  'g:F', 'g:G', 'g:L', 'g:W', 'g:Y', 'g:4', 'g:6', 'g:9', 'g:a', 'g:b', 'g:d', 'g:e', 'g:f',
  'g:g', 'g:h', 'g:k', 'g:m', 'g:n', 'g:q', 'g:r', 'g:t', 'g:y',
];

export const SYMBOLS: readonly SymbolDef[] = ORDER.map((id) => {
  if (id.startsWith('g:')) return { id, ops: [['t', id.slice(2), 0.74] as const] };
  const ops = SHAPES[id];
  if (!ops) throw new Error(`Unknown symbol shape ${id}`);
  return { id, ops };
});

/** Symbol for an index; beyond the set, numbers are used (still unique). */
export function symbolAt(index: number): SymbolDef {
  if (index < SYMBOLS.length) return SYMBOLS[index];
  const label = String(index - SYMBOLS.length + 10);
  return { id: `n:${label}`, ops: [['t', label, 0.5]] };
}

/** Draws a symbol into the cell at (x, y) of the given size. */
export function drawSymbol(
  pen: Pen,
  symbol: SymbolDef,
  x: number,
  y: number,
  size: number,
  ink: string,
): void {
  pen.setInk(ink, Math.max(size * 0.09, 0.0001));
  const X = (u: number) => x + u * size;
  const Y = (v: number) => y + v * size;
  for (const op of symbol.ops) {
    switch (op[0]) {
      case 'r':
        pen.rect(X(op[1]), Y(op[2]), op[3] * size, op[4] * size, op[5] ? 'fill' : 'stroke');
        break;
      case 'c':
        pen.circle(X(op[1]), Y(op[2]), op[3] * size, op[4] ? 'fill' : 'stroke');
        break;
      case 'p': {
        const pts = op[1].map((v, i) => (i % 2 === 0 ? X(v) : Y(v)));
        pen.polygon(pts, op[2] ? 'fill' : 'stroke');
        break;
      }
      case 'l':
        pen.line(X(op[1]), Y(op[2]), X(op[3]), Y(op[4]));
        break;
      case 't':
        pen.text(op[1], X(0.5), Y(0.5), op[2] * size);
        break;
    }
  }
}
