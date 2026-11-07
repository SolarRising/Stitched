import type { Pattern } from '../core/pattern';
import { ChartRenderer, type ChartStyle } from '../render/chartRenderer';

const MAX_AREA = 16_000_000; // stays under the smallest browser canvas limit (Safari)

function cellSizeFor(p: Pattern, min: number, max: number, margin = 0): number {
  for (let s = max; s > min; s--) {
    if ((p.width * s + 2 * margin) * (p.height * s + 2 * margin) <= MAX_AREA) return s;
  }
  return min;
}

const EXPORT_THEME = {
  outside: '#ffffff',
  rulerBg: '#ffffff',
  rulerText: '#333333',
  accent: '#d0314f',
};

/** "Stitched" look on the chosen fabric colour. */
export function renderPreviewCanvas(
  p: Pattern,
  fabricColor: string,
  maxSide = 0,
): HTMLCanvasElement {
  let cell = cellSizeFor(p, 2, 16);
  if (maxSide > 0)
    cell = Math.max(2, Math.min(cell, Math.floor(maxSide / Math.max(p.width, p.height))));
  const pad = Math.round(cell * 2);
  const c = document.createElement('canvas');
  c.width = p.width * cell + 2 * pad;
  c.height = p.height * cell + 2 * pad;
  const ctx = c.getContext('2d')!;
  new ChartRenderer().render(
    ctx,
    1,
    p,
    { cell, ox: pad, oy: pad, width: c.width, height: c.height },
    {
      mode: 'preview',
      style: 'colors',
      highlight: null,
      fabricColor,
      hover: null,
      rulers: false,
      theme: { ...EXPORT_THEME, outside: fabricColor },
    },
  );
  return c;
}

/** Full chart with grid, symbols and row/column numbers. */
export function renderChartCanvas(p: Pattern, style: ChartStyle): HTMLCanvasElement {
  const cell = cellSizeFor(p, 6, 24, 40);
  const margin = Math.max(28, Math.round(cell * 2.2));
  const c = document.createElement('canvas');
  c.width = p.width * cell + 2 * margin;
  c.height = p.height * cell + 2 * margin;
  const ctx = c.getContext('2d')!;
  new ChartRenderer().render(
    ctx,
    1,
    p,
    { cell, ox: margin, oy: margin, width: c.width, height: c.height },
    {
      mode: 'chart',
      style,
      highlight: null,
      fabricColor: '#ffffff',
      hover: null,
      rulers: false,
      theme: EXPORT_THEME,
    },
  );
  ctx.fillStyle = '#333333';
  ctx.font = `${Math.max(10, Math.round(cell * 0.75))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let x = 10; x <= p.width; x += 10) {
    ctx.fillText(String(x), margin + x * cell, margin / 2);
    ctx.fillText(String(x), margin + x * cell, c.height - margin / 2);
  }
  ctx.textAlign = 'right';
  for (let y = 10; y <= p.height; y += 10) {
    ctx.fillText(String(y), margin - 6, margin + y * cell);
  }
  ctx.textAlign = 'left';
  for (let y = 10; y <= p.height; y += 10) {
    ctx.fillText(String(y), c.width - margin + 6, margin + y * cell);
  }
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), type),
  );
}
