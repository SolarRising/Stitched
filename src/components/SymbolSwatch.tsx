import { memo, useEffect, useRef } from 'react';
import { contrastInk } from '../core/color';
import type { Thread } from '../core/palettes';
import { drawSymbol, symbolAt } from '../core/symbols';
import { ensureSymbolFont } from '../lib/fonts';
import { CanvasPen } from '../render/canvasPen';

/** A legend square: thread colour with its chart symbol. */
export const SymbolSwatch = memo(function SymbolSwatch({
  thread,
  symbol,
  size = 26,
}: {
  thread: Thread;
  symbol: number;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      const c = ref.current;
      if (!c || cancelled) return;
      const dpr = window.devicePixelRatio || 1;
      const px = Math.round(size * dpr);
      c.width = px;
      c.height = px;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = thread.hex;
      ctx.fillRect(0, 0, px, px);
      drawSymbol(
        new CanvasPen(ctx),
        symbolAt(symbol),
        px * 0.08,
        px * 0.08,
        px * 0.84,
        contrastInk(...thread.rgb),
      );
    };
    draw();
    ensureSymbolFont().then(draw);
    return () => {
      cancelled = true;
    };
  }, [thread, symbol, size]);
  return (
    <canvas
      ref={ref}
      className="symbol-swatch"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
});
