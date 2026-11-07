import { contrastInk } from '../core/color';
import { EMPTY, type Pattern } from '../core/pattern';
import { drawSymbol, symbolAt } from '../core/symbols';
import { CanvasPen } from './canvasPen';

export type ViewMode = 'chart' | 'preview';
export type ChartStyle = 'symbols' | 'colors' | 'both';

/** Visible area in CSS pixels; `cell` is the size of one stitch, (ox, oy) the pattern origin. */
export interface Viewport {
  cell: number;
  ox: number;
  oy: number;
  width: number;
  height: number;
}

export interface RenderTheme {
  outside: string;
  rulerBg: string;
  rulerText: string;
  accent: string;
}

export interface RenderOptions {
  mode: ViewMode;
  style: ChartStyle;
  /** Colour index to emphasise; others are faded. */
  highlight: number | null;
  fabricColor: string;
  hover: { x: number; y: number } | null;
  rulers: boolean;
  theme: RenderTheme;
}

type RGB3 = [number, number, number];

function parseHex(hex: string): RGB3 {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: readonly number[], b: readonly number[], t: number): RGB3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function css([r, g, b]: readonly number[]): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

/** Cached per-cell sprites (symbols, stitches) at the current device-pixel cell size. */
class SpriteCache {
  private size = 0;
  private map = new Map<string, HTMLCanvasElement>();

  get(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
    if (size !== this.size || this.map.size > 4000) {
      this.map.clear();
      this.size = size;
    }
    let sprite = this.map.get(key);
    if (!sprite) {
      sprite = createCanvas(size, size);
      draw(sprite.getContext('2d')!, size);
      this.map.set(key, sprite);
    }
    return sprite;
  }
}

export function drawStitchSprite(ctx: CanvasRenderingContext2D, s: number, rgb: readonly number[]) {
  const inset = s * 0.15;
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.3;
  ctx.strokeStyle = css(mix(rgb, [0, 0, 0], 0.22));
  ctx.beginPath();
  ctx.moveTo(inset, inset);
  ctx.lineTo(s - inset, s - inset);
  ctx.stroke();
  ctx.strokeStyle = css(rgb);
  ctx.beginPath();
  ctx.moveTo(s - inset, inset);
  ctx.lineTo(inset, s - inset);
  ctx.stroke();
  // Soft sheen along the top leg.
  ctx.lineWidth = s * 0.08;
  ctx.strokeStyle = css(mix(rgb, [255, 255, 255], 0.3));
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(s - inset - s * 0.06, inset + s * 0.02);
  ctx.lineTo(inset + s * 0.02, s - inset - s * 0.06);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export class ChartRenderer {
  private sprites = new SpriteCache();
  private bitmap: HTMLCanvasElement | null = null;
  private bitmapKey: unknown[] = [];

  /** One pixel per stitch; empty cells transparent. Faded colours when highlighting. */
  private getBitmap(p: Pattern, highlight: number | null, fadeTo: RGB3): HTMLCanvasElement {
    const key = [p, highlight, fadeTo.join()];
    if (this.bitmap && key.every((k, i) => k === this.bitmapKey[i])) return this.bitmap;
    const c = createCanvas(p.width, p.height);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(p.width, p.height);
    const lut = p.colors.map((pc, i) =>
      highlight !== null && i !== highlight ? mix(pc.thread.rgb, fadeTo, 0.8) : [...pc.thread.rgb],
    );
    for (let i = 0; i < p.cells.length; i++) {
      const v = p.cells[i];
      if (v === EMPTY) continue;
      const [r, g, b] = lut[v];
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.bitmap = c;
    this.bitmapKey = key;
    return c;
  }

  render(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    p: Pattern,
    vp: Viewport,
    o: RenderOptions,
  ): void {
    const W = Math.round(vp.width * dpr);
    const H = Math.round(vp.height * dpr);
    const cell = vp.cell * dpr;
    const ox = vp.ox * dpr;
    const oy = vp.oy * dpr;
    const px = (i: number) => Math.round(ox + i * cell);
    const py = (j: number) => Math.round(oy + j * cell);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = o.theme.outside;
    ctx.fillRect(0, 0, W, H);

    const c0 = Math.max(0, Math.floor(-ox / cell));
    const c1 = Math.min(p.width, Math.ceil((W - ox) / cell));
    const r0 = Math.max(0, Math.floor(-oy / cell));
    const r1 = Math.min(p.height, Math.ceil((H - oy) / cell));
    if (c0 >= c1 || r0 >= r1) return;
    const x0 = px(c0);
    const x1 = px(c1);
    const y0 = py(r0);
    const y1 = py(r1);

    const fabric = parseHex(o.fabricColor);
    const preview = o.mode === 'preview';
    ctx.fillStyle = preview ? o.fabricColor : '#ffffff';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    if (preview) this.renderPreview(ctx, p, o, fabric, { c0, c1, r0, r1, cell, px, py });
    else this.renderChart(ctx, p, o, { c0, c1, r0, r1, cell, px, py });

    // Pattern outline.
    ctx.strokeStyle = preview ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.75)';
    ctx.lineWidth = Math.max(1, Math.round(dpr));
    ctx.strokeRect(px(0) + 0.5, py(0) + 0.5, px(p.width) - px(0) - 1, py(p.height) - py(0) - 1);

    if (
      o.hover &&
      o.hover.x >= 0 &&
      o.hover.y >= 0 &&
      o.hover.x < p.width &&
      o.hover.y < p.height
    ) {
      ctx.strokeStyle = o.theme.accent;
      ctx.lineWidth = Math.max(2, Math.round(2 * dpr));
      const hx = px(o.hover.x);
      const hy = py(o.hover.y);
      ctx.strokeRect(hx, hy, px(o.hover.x + 1) - hx, py(o.hover.y + 1) - hy);
    }

    if (o.rulers && !preview && vp.cell * 10 >= 22) this.renderRulers(ctx, dpr, p, W, H, o, px, py);
  }

  private renderChart(
    ctx: CanvasRenderingContext2D,
    p: Pattern,
    o: RenderOptions,
    g: {
      c0: number;
      c1: number;
      r0: number;
      r1: number;
      cell: number;
      px: (i: number) => number;
      py: (j: number) => number;
    },
  ) {
    const { c0, c1, r0, r1, cell, px, py } = g;
    const showColors = o.style !== 'symbols';
    const showSymbols = o.style !== 'colors' && cell >= 7;
    const white: RGB3 = [255, 255, 255];

    if (showColors) {
      if (cell < 6) {
        const bmp = this.getBitmap(p, o.highlight, white);
        ctx.drawImage(
          bmp,
          c0,
          r0,
          c1 - c0,
          r1 - r0,
          px(c0),
          py(r0),
          px(c1) - px(c0),
          py(r1) - py(r0),
        );
      } else {
        const fills = p.colors.map((pc, i) =>
          css(
            o.highlight !== null && i !== o.highlight
              ? mix(pc.thread.rgb, white, 0.8)
              : pc.thread.rgb,
          ),
        );
        for (let r = r0; r < r1; r++) {
          const y = py(r);
          const h = py(r + 1) - y;
          let last = -1;
          for (let c = c0; c < c1; c++) {
            const v = p.cells[r * p.width + c];
            if (v === EMPTY) continue;
            if (v !== last) {
              ctx.fillStyle = fills[v];
              last = v;
            }
            const x = px(c);
            ctx.fillRect(x, y, px(c + 1) - x, h);
          }
        }
      }
    }

    if (showSymbols) {
      const size = Math.max(1, Math.round(cell));
      const inks = p.colors.map((pc, i) => {
        const faded = o.highlight !== null && i !== o.highlight;
        if (o.style === 'symbols') return faded ? '#c4c4c4' : '#1b1b1b';
        if (faded) return '#d0d0d0';
        return contrastInk(...pc.thread.rgb);
      });
      for (let r = r0; r < r1; r++) {
        const y = py(r);
        const h = py(r + 1) - y;
        for (let c = c0; c < c1; c++) {
          const v = p.cells[r * p.width + c];
          if (v === EMPTY) continue;
          const sym = p.colors[v].symbol;
          const ink = inks[v];
          const sprite = this.sprites.get(`s${sym}${ink}`, size, (sctx, s) => {
            drawSymbol(new CanvasPen(sctx), symbolAt(sym), 0, 0, s, ink);
          });
          const x = px(c);
          ctx.drawImage(sprite, x, y, px(c + 1) - x, h);
        }
      }
    }

    // Grid.
    if (cell >= 5) {
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = c0; c <= c1; c++) {
        if (c % 10 === 0) continue;
        const x = px(c) + 0.5;
        ctx.moveTo(x, py(r0));
        ctx.lineTo(x, py(r1));
      }
      for (let r = r0; r <= r1; r++) {
        if (r % 10 === 0) continue;
        const y = py(r) + 0.5;
        ctx.moveTo(px(c0), y);
        ctx.lineTo(px(c1), y);
      }
      ctx.stroke();
    }
    if (cell * 10 >= 12) {
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = cell >= 12 ? 2 : 1;
      ctx.beginPath();
      const off = ctx.lineWidth === 1 ? 0.5 : 0;
      for (let c = Math.ceil(c0 / 10) * 10; c <= c1; c += 10) {
        const x = px(c) + off;
        ctx.moveTo(x, py(r0));
        ctx.lineTo(x, py(r1));
      }
      for (let r = Math.ceil(r0 / 10) * 10; r <= r1; r += 10) {
        const y = py(r) + off;
        ctx.moveTo(px(c0), y);
        ctx.lineTo(px(c1), y);
      }
      ctx.stroke();
    }

    // Centre lines.
    ctx.strokeStyle = o.theme.accent;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1.5, cell >= 12 ? 2.5 : 1.5);
    ctx.beginPath();
    const cx = px(p.width / 2);
    const cy = py(p.height / 2);
    ctx.moveTo(cx, py(r0));
    ctx.lineTo(cx, py(r1));
    ctx.moveTo(px(c0), cy);
    ctx.lineTo(px(c1), cy);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private renderPreview(
    ctx: CanvasRenderingContext2D,
    p: Pattern,
    o: RenderOptions,
    fabric: RGB3,
    g: {
      c0: number;
      c1: number;
      r0: number;
      r1: number;
      cell: number;
      px: (i: number) => number;
      py: (j: number) => number;
    },
  ) {
    const { c0, c1, r0, r1, cell, px, py } = g;
    const light = fabric[0] + fabric[1] + fabric[2] > 200;

    if (cell >= 7) {
      // Aida holes at the grid intersections.
      ctx.fillStyle = css(mix(fabric, light ? [0, 0, 0] : [255, 255, 255], light ? 0.16 : 0.14));
      const d = Math.max(1, Math.round(cell * 0.12));
      for (let r = r0; r <= r1; r++) {
        const y = py(r) - (d >> 1);
        for (let c = c0; c <= c1; c++) ctx.fillRect(px(c) - (d >> 1), y, d, d);
      }
    }

    if (cell < 4) {
      ctx.imageSmoothingEnabled = true;
      const bmp = this.getBitmap(p, o.highlight, fabric);
      ctx.drawImage(
        bmp,
        c0,
        r0,
        c1 - c0,
        r1 - r0,
        px(c0),
        py(r0),
        px(c1) - px(c0),
        py(r1) - py(r0),
      );
      ctx.imageSmoothingEnabled = false;
      return;
    }

    const size = Math.max(1, Math.round(cell));
    const rgbs = p.colors.map((pc, i) =>
      o.highlight !== null && i !== o.highlight
        ? mix(pc.thread.rgb, fabric, 0.75)
        : [...pc.thread.rgb],
    );
    for (let r = r0; r < r1; r++) {
      const y = py(r);
      const h = py(r + 1) - y;
      for (let c = c0; c < c1; c++) {
        const v = p.cells[r * p.width + c];
        if (v === EMPTY) continue;
        const rgb = rgbs[v];
        const sprite = this.sprites.get(`x${rgb.join()}`, size, (sctx, s) =>
          drawStitchSprite(sctx, s, rgb),
        );
        const x = px(c);
        ctx.drawImage(sprite, x, y, px(c + 1) - x, h);
      }
    }
  }

  private renderRulers(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    p: Pattern,
    W: number,
    H: number,
    o: RenderOptions,
    px: (i: number) => number,
    py: (j: number) => number,
  ) {
    const band = Math.round(16 * dpr);
    ctx.fillStyle = o.theme.rulerBg;
    ctx.fillRect(0, 0, W, band);
    ctx.fillRect(0, 0, band, H);
    ctx.fillStyle = o.theme.rulerText;
    ctx.font = `${Math.round(10 * dpr)}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (let c = 10; c <= p.width; c += 10) {
      const x = px(c);
      if (x > band + 8 * dpr && x < W - 4) ctx.fillText(String(c), x, band / 2);
    }
    ctx.save();
    for (let r = 10; r <= p.height; r += 10) {
      const y = py(r);
      if (y > band + 8 * dpr && y < H - 4) {
        ctx.setTransform(1, 0, 0, 1, band / 2, y);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(String(r), 0, 0);
      }
    }
    ctx.restore();
  }
}
