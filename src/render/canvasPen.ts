import type { FillMode, Pen } from '../core/symbols';
import { SYMBOL_FONT } from '../lib/fonts';

export class CanvasPen implements Pen {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  setInk(color: string, lineWidth: number): void {
    const c = this.ctx;
    c.fillStyle = color;
    c.strokeStyle = color;
    c.lineWidth = lineWidth;
    c.lineJoin = 'round';
    c.lineCap = 'round';
  }

  private paint(mode: FillMode): void {
    if (mode === 'fill') this.ctx.fill();
    else this.ctx.stroke();
  }

  rect(x: number, y: number, w: number, h: number, mode: FillMode): void {
    if (mode === 'fill') this.ctx.fillRect(x, y, w, h);
    else this.ctx.strokeRect(x, y, w, h);
  }

  circle(cx: number, cy: number, r: number, mode: FillMode): void {
    const c = this.ctx;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    this.paint(mode);
  }

  polygon(points: number[], mode: FillMode): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
    c.closePath();
    this.paint(mode);
  }

  line(x1: number, y1: number, x2: number, y2: number): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }

  text(s: string, cx: number, cy: number, size: number): void {
    const c = this.ctx;
    c.font = `${size}px ${SYMBOL_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(s, cx, cy + size * 0.05);
  }
}
