import { GState, jsPDF } from 'jspdf';
import { contrastInk } from '../core/color';
import { EMPTY, type Pattern } from '../core/pattern';
import type { Settings } from '../core/settings';
import { skeinsToBuy } from '../core/skeins';
import { fabricById, fabricPieceCm, stitchesToCm } from '../core/sizing';
import { drawSymbol, symbolAt, type FillMode, type Pen } from '../core/symbols';
import { strandsLabel, type Lang, type Translate } from '../i18n';
import { pdfFonts } from '../lib/fonts';
import { fabricLabel } from '../lib/labels';
import {
  AXIS,
  chartLayout,
  FOOTER,
  MARGIN,
  OVERLAP,
  type ChartLayout,
  type Paper,
  type Tile,
} from './layout';

export interface PdfOptions {
  paper: Paper;
  cellMm: number;
  style: 'symbols' | 'colors';
  cover: boolean;
}

export interface PdfInput {
  pattern: Pattern;
  settings: Settings;
  /** Stitched preview as a PNG data URL (for the cover). */
  previewPng: string;
  previewSize: { width: number; height: number };
  t: Translate;
  num: (v: number, digits?: number) => string;
  lang: Lang;
}

const PT_PER_MM = 72 / 25.4;
const FONT = 'Roboto';

class PdfPen implements Pen {
  constructor(private readonly doc: jsPDF) {}

  setInk(color: string, lineWidth: number): void {
    this.doc.setDrawColor(color);
    this.doc.setFillColor(color);
    this.doc.setTextColor(color);
    this.doc.setLineWidth(lineWidth);
  }

  rect(x: number, y: number, w: number, h: number, mode: FillMode): void {
    this.doc.rect(x, y, w, h, mode === 'fill' ? 'F' : 'S');
  }

  circle(cx: number, cy: number, r: number, mode: FillMode): void {
    this.doc.circle(cx, cy, r, mode === 'fill' ? 'F' : 'S');
  }

  polygon(points: number[], mode: FillMode): void {
    const d = this.doc;
    d.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) d.lineTo(points[i], points[i + 1]);
    d.close();
    if (mode === 'fill') d.fill();
    else d.stroke();
  }

  line(x1: number, y1: number, x2: number, y2: number): void {
    this.doc.line(x1, y1, x2, y2);
  }

  text(s: string, cx: number, cy: number, size: number): void {
    const d = this.doc;
    d.setFont(FONT, 'bold');
    d.setFontSize(size * PT_PER_MM);
    d.text(s, cx, cy, { align: 'center', baseline: 'middle' });
  }
}

function setText(
  doc: jsPDF,
  size: number,
  weight: 'normal' | 'bold' = 'normal',
  color = '#222222',
) {
  doc.setFont(FONT, weight);
  doc.setFontSize(size);
  doc.setTextColor(color);
}

function footer(doc: jsPDF, input: PdfInput, pageNo: number, total: number) {
  const { t } = input;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  setText(doc, 7.5, 'normal', '#777777');
  doc.text(t('pdf.generated'), MARGIN, h - MARGIN + 2);
  doc.text(t('pdf.page', { n: pageNo, total }), w - MARGIN, h - MARGIN + 2, { align: 'right' });
}

/** Mini map of chart pages; `current` tile is highlighted. Returns the drawn height. */
function pageMap(
  doc: jsPDF,
  layout: ChartLayout,
  pattern: Pattern,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  firstChartPage: number,
  current?: Tile,
): number {
  const scale = Math.min(maxW / pattern.width, maxH / pattern.height);
  const w = pattern.width * scale;
  const h = pattern.height * scale;
  doc.setLineWidth(0.25);
  doc.setDrawColor('#999999');
  doc.setFillColor('#f4f1ec');
  doc.rect(x, y, w, h, 'FD');
  layout.tiles.forEach((tile, i) => {
    const tx = x + tile.col0 * scale;
    const ty = y + tile.row0 * scale;
    const tw = tile.cols * scale;
    const th = tile.rows * scale;
    const isCurrent = current === tile;
    if (isCurrent) {
      doc.setFillColor('#d0314f');
      doc.rect(tx, ty, tw, th, 'F');
    }
    doc.setDrawColor('#555555');
    doc.rect(tx, ty, tw, th, 'S');
    if (!current && tw > 5 && th > 4) {
      setText(doc, Math.min(9, th * 1.2), 'bold', '#333333');
      doc.text(String(firstChartPage + i), tx + tw / 2, ty + th / 2, {
        align: 'center',
        baseline: 'middle',
      });
    }
  });
  return h;
}

/** Draws the cover; returns where the page map goes (it needs the final page numbers). */
function coverPage(
  doc: jsPDF,
  input: PdfInput,
  layout: ChartLayout,
): { x: number; y: number; w: number; h: number } {
  const { pattern, settings, t, num } = input;
  const W = doc.internal.pageSize.getWidth();
  const fabric = fabricById(settings.fabricId);
  let y = MARGIN + 8;
  const title = settings.name.trim() || t('pdf.title');
  setText(doc, 22, 'bold');
  doc.text(title, MARGIN, y, { maxWidth: W - 2 * MARGIN });
  y += 7;
  if (settings.name.trim()) {
    setText(doc, 11, 'normal', '#666666');
    doc.text(t('pdf.title'), MARGIN, y);
  }
  y += 6;

  // Preview image.
  const boxW = W - 2 * MARGIN;
  const boxH = 112;
  const r = Math.min(boxW / input.previewSize.width, boxH / input.previewSize.height);
  const iw = input.previewSize.width * r;
  const ih = input.previewSize.height * r;
  doc.addImage(input.previewPng, 'PNG', MARGIN + (boxW - iw) / 2, y, iw, ih);
  y += ih + 10;

  // Facts.
  const wCm = stitchesToCm(pattern.width, fabric);
  const hCm = stitchesToCm(pattern.height, fabric);
  const piece = fabricPieceCm(pattern.width, pattern.height, fabric);
  const facts: Array<[string, string]> = [
    [t('pdf.gridSize'), t('size.summary.gridValue', { w: pattern.width, h: pattern.height })],
    [t('pdf.fabric'), fabricLabel(fabric, t, input.lang === 'pl')],
    [
      t('pdf.finished'),
      `${num(wCm, 1)} × ${num(hCm, 1)} cm  (${num(wCm / 2.54, 1)} × ${num(hCm / 2.54, 1)} in)`,
    ],
    [t('pdf.piece'), `${num(Math.ceil(piece.width))} × ${num(Math.ceil(piece.height))} cm`],
    [t('pdf.colors'), String(pattern.colors.length)],
    [t('pdf.stitches'), num(pattern.stitchCount)],
    [t('pdf.strands'), strandsLabel(t, settings.strands)],
    [t('pdf.chartPages'), String(layout.tiles.length)],
  ];
  const factsY = y;
  facts.forEach(([k, v], i) => {
    setText(doc, 9.5, 'normal', '#666666');
    doc.text(k, MARGIN, y + i * 6.2);
    setText(doc, 9.5, 'bold');
    doc.text(v, MARGIN + 52, y + i * 6.2);
  });

  // Page map on the right (drawn later).
  const mapX = W / 2 + 22;
  setText(doc, 9.5, 'bold');
  doc.text(t('pdf.pageMap'), mapX, factsY);

  y = factsY + facts.length * 6.2 + 6;
  setText(doc, 8.5, 'normal', '#666666');
  const notes = [t('pdf.center')];
  if (layout.tiles.length > 1) notes.push(t('pdf.overlap'));
  notes.forEach((n, i) => doc.text(n, MARGIN, y + i * 5));
  return { x: mapX, y: factsY + 3, w: W - MARGIN - mapX, h: 44 };
}

function legendPages(doc: jsPDF, input: PdfInput, opts: PdfOptions, startNewPage: boolean) {
  const { pattern, settings, t, num } = input;
  const fabric = fabricById(settings.fabricId);
  const pen = new PdfPen(doc);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const rows = [...pattern.colors].sort((a, b) => b.count - a.count || a.symbol - b.symbol);
  const rowH = 7.4;
  const col = {
    sym: MARGIN,
    sw: MARGIN + 9,
    code: MARGIN + 19,
    name: MARGIN + 36,
    st: W - MARGIN - 22,
    sk: W - MARGIN,
  };
  let y = 0;
  let first = true;

  const header = () => {
    if (!first || startNewPage) doc.addPage();
    y = MARGIN + 6;
    setText(doc, 15, 'bold');
    doc.text(first ? t('pdf.legend') : t('pdf.legendCont'), MARGIN, y);
    y += 8;
    setText(doc, 8, 'bold', '#555555');
    doc.text(t('legend.symbol'), col.sym, y);
    doc.text(t('legend.thread'), col.code, y);
    doc.text(t('legend.name'), col.name, y);
    doc.text(t('legend.stitches'), col.st, y, { align: 'right' });
    doc.text(t('legend.skeins'), col.sk, y, { align: 'right' });
    y += 2;
    doc.setDrawColor('#bbbbbb');
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, W - MARGIN, y);
    y += 1.5;
    first = false;
  };
  header();

  for (const c of rows) {
    if (y + rowH > H - MARGIN - FOOTER - 12) header();
    const s = 6;
    const sy = y + (rowH - s) / 2;
    // Symbol as printed on the chart.
    if (opts.style === 'colors') {
      doc.setFillColor(c.thread.hex);
      doc.rect(col.sym, sy, s, s, 'F');
      drawSymbol(pen, symbolAt(c.symbol), col.sym, sy, s, contrastInk(...c.thread.rgb));
    } else {
      drawSymbol(pen, symbolAt(c.symbol), col.sym, sy, s, '#000000');
    }
    doc.setDrawColor('#999999');
    doc.setLineWidth(0.2);
    doc.rect(col.sym, sy, s, s, 'S');
    // Thread colour swatch.
    doc.setFillColor(c.thread.hex);
    doc.rect(col.sw, sy, 8, s, 'FD');
    setText(doc, 9.5, 'bold');
    doc.text(`${c.thread.brand} ${c.thread.code}`, col.code, y + rowH / 2, { baseline: 'middle' });
    setText(doc, 9.5, 'normal');
    doc.text(c.thread.name, col.name, y + rowH / 2, {
      baseline: 'middle',
      maxWidth: col.st - col.name - 18,
    });
    doc.text(num(c.count), col.st, y + rowH / 2, { align: 'right', baseline: 'middle' });
    doc.text(String(skeinsToBuy(c.count, fabric, settings.strands)), col.sk, y + rowH / 2, {
      align: 'right',
      baseline: 'middle',
    });
    y += rowH;
    doc.setDrawColor('#e2e2e2');
    doc.setLineWidth(0.15);
    doc.line(MARGIN, y, W - MARGIN, y);
  }

  y += 5;
  const total = rows.reduce((sum, c) => sum + skeinsToBuy(c.count, fabric, settings.strands), 0);
  setText(doc, 9.5, 'bold');
  doc.text(t('legend.total'), col.code, y);
  doc.text(num(pattern.stitchCount), col.st, y, { align: 'right' });
  doc.text(String(total), col.sk, y, { align: 'right' });
  y += 7;
  setText(doc, 8, 'normal', '#666666');
  doc.text(t('pdf.skeinNote', { n: settings.strands }), MARGIN, y);
  if (pattern.stitchCount < pattern.width * pattern.height) {
    doc.text(t('pdf.noStitch'), MARGIN, y + 4.5);
  }
}

function chartPage(
  doc: jsPDF,
  input: PdfInput,
  opts: PdfOptions,
  layout: ChartLayout,
  tile: Tile,
  index: number,
  firstChartPage: number,
) {
  const { pattern, settings, t } = input;
  const pen = new PdfPen(doc);
  const s = layout.cellMm;
  const gx = layout.gridLeft;
  const gy = layout.gridTop;
  const W = doc.internal.pageSize.getWidth();
  const gw = tile.cols * s;
  const gh = tile.rows * s;

  // Header.
  setText(doc, 11, 'bold');
  doc.text(settings.name.trim() || t('pdf.title'), MARGIN, MARGIN + 4, { maxWidth: W / 2 });
  setText(doc, 8.5, 'normal', '#555555');
  doc.text(
    `${t('pdf.chartPage', { n: index + 1, total: layout.tiles.length })} · ${t('pdf.columns', {
      a: tile.col0 + 1,
      b: tile.col0 + tile.cols,
    })} · ${t('pdf.rows', { a: tile.row0 + 1, b: tile.row0 + tile.rows })}`,
    MARGIN,
    MARGIN + 9,
  );
  if (layout.tiles.length > 1) {
    pageMap(doc, layout, pattern, W - MARGIN - 18, MARGIN, 18, 11, firstChartPage, tile);
  }

  // Colour fills, merged into horizontal runs.
  if (opts.style === 'colors') {
    for (let r = 0; r < tile.rows; r++) {
      const row = tile.row0 + r;
      let c = 0;
      while (c < tile.cols) {
        const v = pattern.cells[row * pattern.width + tile.col0 + c];
        let run = 1;
        while (
          c + run < tile.cols &&
          pattern.cells[row * pattern.width + tile.col0 + c + run] === v
        )
          run++;
        if (v !== EMPTY) {
          doc.setFillColor(pattern.colors[v].thread.hex);
          doc.rect(gx + c * s, gy + r * s, run * s, s, 'F');
        }
        c += run;
      }
    }
  }

  // Symbols.
  const inks = pattern.colors.map((pc) =>
    opts.style === 'colors' ? contrastInk(...pc.thread.rgb) : '#000000',
  );
  const inset = s * 0.06;
  for (let r = 0; r < tile.rows; r++) {
    for (let c = 0; c < tile.cols; c++) {
      const v = pattern.cells[(tile.row0 + r) * pattern.width + tile.col0 + c];
      if (v === EMPTY) continue;
      drawSymbol(
        pen,
        symbolAt(pattern.colors[v].symbol),
        gx + c * s + inset,
        gy + r * s + inset,
        s - 2 * inset,
        inks[v],
      );
    }
  }

  // Overlap bands (repeated from the previous page).
  const shadeCols = tile.tx > 0 ? OVERLAP : 0;
  const shadeRows = tile.ty > 0 ? OVERLAP : 0;
  if (shadeCols || shadeRows) {
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.22 }));
    doc.setFillColor('#7a7a7a');
    if (shadeCols) doc.rect(gx, gy, shadeCols * s, gh, 'F');
    if (shadeRows) doc.rect(gx + shadeCols * s, gy, gw - shadeCols * s, shadeRows * s, 'F');
    doc.restoreGraphicsState();
  }

  // Grid lines.
  doc.setDrawColor('#a0a0a0');
  doc.setLineWidth(0.08);
  for (let c = 0; c <= tile.cols; c++) {
    if ((tile.col0 + c) % 10 !== 0) doc.line(gx + c * s, gy, gx + c * s, gy + gh);
  }
  for (let r = 0; r <= tile.rows; r++) {
    if ((tile.row0 + r) % 10 !== 0) doc.line(gx, gy + r * s, gx + gw, gy + r * s);
  }
  doc.setDrawColor('#1e1e1e');
  doc.setLineWidth(0.32);
  for (let c = 0; c <= tile.cols; c++) {
    if ((tile.col0 + c) % 10 === 0) doc.line(gx + c * s, gy, gx + c * s, gy + gh);
  }
  for (let r = 0; r <= tile.rows; r++) {
    if ((tile.row0 + r) % 10 === 0) doc.line(gx, gy + r * s, gx + gw, gy + r * s);
  }
  doc.setLineWidth(0.4);
  doc.rect(gx, gy, gw, gh, 'S');

  // Axis numbers (global coordinates).
  setText(doc, 6.5, 'normal', '#333333');
  for (let c = 0; c <= tile.cols; c++) {
    const col = tile.col0 + c;
    if (col % 10 === 0 && col > 0) doc.text(String(col), gx + c * s, gy - 1.6, { align: 'center' });
  }
  for (let r = 0; r <= tile.rows; r++) {
    const row = tile.row0 + r;
    if (row % 10 === 0 && row > 0) {
      doc.text(String(row), gx - 1.4, gy + r * s, { align: 'right', baseline: 'middle' });
    }
  }

  // Centre markers.
  doc.setFillColor('#d0314f');
  const cx = pattern.width / 2;
  const cy = pattern.height / 2;
  const a = Math.min(2.2, AXIS * 0.35);
  if (cx >= tile.col0 && cx <= tile.col0 + tile.cols) {
    const x = gx + (cx - tile.col0) * s;
    doc.triangle(x - a, gy - AXIS + 0.6, x + a, gy - AXIS + 0.6, x, gy - AXIS + 0.6 + a * 1.4, 'F');
    doc.triangle(
      x - a,
      gy + gh + AXIS - 0.6,
      x + a,
      gy + gh + AXIS - 0.6,
      x,
      gy + gh + AXIS - 0.6 - a * 1.4,
      'F',
    );
  }
  if (cy >= tile.row0 && cy <= tile.row0 + tile.rows) {
    const yy = gy + (cy - tile.row0) * s;
    doc.triangle(
      gx - AXIS + 0.6,
      yy - a,
      gx - AXIS + 0.6,
      yy + a,
      gx - AXIS + 0.6 + a * 1.4,
      yy,
      'F',
    );
    doc.triangle(
      gx + gw + AXIS - 0.6,
      yy - a,
      gx + gw + AXIS - 0.6,
      yy + a,
      gx + gw + AXIS - 0.6 - a * 1.4,
      yy,
      'F',
    );
  }
}

/** Builds the printable PDF. Yields to the event loop between pages to keep the UI alive. */
export async function createPdf(input: PdfInput, opts: PdfOptions): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: opts.paper, compress: true });
  const fonts = await pdfFonts();
  doc.addFileToVFS('Roboto-Regular.ttf', fonts.regular);
  doc.addFont('Roboto-Regular.ttf', FONT, 'normal');
  doc.addFileToVFS('Roboto-Bold.ttf', fonts.bold);
  doc.addFont('Roboto-Bold.ttf', FONT, 'bold');
  doc.setFont(FONT, 'normal');
  doc.setProperties({
    title: input.settings.name.trim() || input.t('pdf.title'),
    creator: 'Stitched',
  });
  doc.setLineCap('round');

  const layout = chartLayout(input.pattern.width, input.pattern.height, opts.paper, opts.cellMm);

  const map = opts.cover ? coverPage(doc, input, layout) : null;
  legendPages(doc, input, opts, opts.cover);
  const firstChartPage = doc.getNumberOfPages() + 1;
  if (map) {
    doc.setPage(1);
    pageMap(doc, layout, input.pattern, map.x, map.y, map.w, map.h, firstChartPage);
    doc.setPage(doc.getNumberOfPages());
  }
  for (let i = 0; i < layout.tiles.length; i++) {
    doc.addPage();
    chartPage(doc, input, opts, layout, layout.tiles[i], i, firstChartPage);
    if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0));
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    footer(doc, input, p, total);
  }
  return doc.output('blob');
}
