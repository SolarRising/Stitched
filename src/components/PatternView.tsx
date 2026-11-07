import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { normalizeCrop, type CropRect, type Rotation } from '../core/image';
import { EMPTY, lineCells, NO_STITCH, type Pattern } from '../core/pattern';
import { threadById } from '../core/palettes';
import { useI18n } from '../i18n';
import { ensureSymbolFont } from '../lib/fonts';
import type { LoadedImage } from '../lib/imageLoader';
import { threadTitle } from '../lib/labels';
import { ChartRenderer, type ChartStyle, type RenderTheme } from '../render/chartRenderer';
import { IconButton, Segmented } from './ui';

export type View = 'chart' | 'preview' | 'original';
export type Tool = 'pan' | 'pencil' | 'eraser' | 'fill' | 'picker';

export interface PatternViewProps {
  pattern: Pattern | null;
  image: LoadedImage;
  rotation: Rotation;
  crop: CropRect;
  fabricColor: string;
  view: View;
  chartStyle: ChartStyle;
  tool: Tool;
  activeColor: string | null;
  highlight: string | null;
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  editCount: number;
  onView: (v: View) => void;
  onChartStyle: (s: ChartStyle) => void;
  onTool: (t: Tool) => void;
  onChooseColor: () => void;
  onStrokeStart: () => void;
  onPaint: (cells: Array<[number, string]>) => void;
  onStrokeEnd: () => void;
  onFill: (index: number) => void;
  onPick: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearEdits: () => void;
}

type Gesture =
  | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'paint'; last: [number, number]; value: string }
  | { kind: 'pinch'; d0: number; mx: number; my: number; cell: number; ox: number; oy: number };

const MIN_CELL = 0.3;
const MAX_CELL = 80;

function readTheme(el: HTMLElement): RenderTheme {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    outside: v('--canvas-outside', '#e9e4db'),
    rulerBg: v('--ruler-bg', 'rgba(246,243,238,0.92)'),
    rulerText: v('--ruler-text', '#5a5248'),
    accent: v('--accent', '#c2405a'),
  };
}

function drawOriginal(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  image: LoadedImage,
  rotation: Rotation,
  crop: CropRect,
  outside: string,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = outside;
  ctx.fillRect(0, 0, W, H);
  const src = image.canvas;
  const swap = rotation === 90 || rotation === 270;
  const rw = swap ? src.height : src.width;
  const rh = swap ? src.width : src.height;
  const c = normalizeCrop(crop);
  const cw = rw * c.w;
  const ch = rh * c.h;
  const pad = 24 * (window.devicePixelRatio || 1);
  const scale = Math.min((W - 2 * pad) / cw, (H - 2 * pad) / ch);
  if (!(scale > 0)) return;
  const dx = (W - cw * scale) / 2;
  const dy = (H - ch * scale) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, cw * scale, ch * scale);
  ctx.clip();
  // Checkerboard behind transparent areas.
  const tile = 8 * (window.devicePixelRatio || 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(dx, dy, cw * scale, ch * scale);
  ctx.fillStyle = '#e6e6e6';
  for (let y = 0; y < ch * scale; y += tile) {
    for (let x = (Math.floor(y / tile) % 2) * tile; x < cw * scale; x += tile * 2) {
      ctx.fillRect(dx + x, dy + y, tile, tile);
    }
  }
  ctx.translate(dx - c.x * rw * scale, dy - c.y * rh * scale);
  ctx.scale(scale, scale);
  if (rotation === 90) {
    ctx.translate(rw, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    ctx.translate(rw, rh);
    ctx.rotate(Math.PI);
  } else if (rotation === 270) {
    ctx.translate(0, rh);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0);
  ctx.restore();
}

export function PatternView(props: PatternViewProps) {
  const { t, num } = useI18n();
  const {
    pattern,
    view,
    tool,
    busy,
    onView,
    onChartStyle,
    onTool,
    chartStyle,
    activeColor,
    canUndo,
    canRedo,
    editCount,
  } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderer] = useState(() => new ChartRenderer());
  const vp = useRef({ cell: 8, ox: 0, oy: 0 });
  const size = useRef({ w: 0, h: 0 });
  const latest = useRef(props);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const spaceDown = useRef(false);
  const fittedFor = useRef('');
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [spacePan, setSpacePan] = useState(false);
  const [grabbing, setGrabbing] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const { w, h } = size.current;
    if (!canvas || !wrap || w === 0 || h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const p = latest.current;
    const theme = readTheme(wrap);
    if (p.view === 'original') {
      drawOriginal(ctx, W, H, p.image, p.rotation, p.crop, theme.outside);
      return;
    }
    if (!p.pattern) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = theme.outside;
      ctx.fillRect(0, 0, W, H);
      return;
    }
    const hl = p.highlight ? p.pattern.colors.findIndex((c) => c.thread.id === p.highlight) : -1;
    renderer.render(
      ctx,
      dpr,
      p.pattern,
      { ...vp.current, width: w, height: h },
      {
        mode: p.view === 'preview' ? 'preview' : 'chart',
        style: p.chartStyle,
        highlight: hl >= 0 ? hl : null,
        fabricColor: p.fabricColor,
        hover: p.tool !== 'pan' ? hoverRef.current : null,
        rulers: true,
        theme,
      },
    );
  }, [renderer]);

  const requestDraw = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      draw();
    });
  }, [draw]);

  const setViewport = useCallback(
    (next: { cell: number; ox: number; oy: number }) => {
      vp.current = next;
      setZoom(next.cell);
      requestDraw();
    },
    [requestDraw],
  );

  const fit = useCallback(() => {
    const p = latest.current.pattern;
    const { w, h } = size.current;
    if (!p || w === 0) return;
    const pad = 28;
    const cell = Math.min(
      MAX_CELL,
      Math.max(MIN_CELL, Math.min((w - 2 * pad) / p.width, (h - 2 * pad) / p.height)),
    );
    setViewport({ cell, ox: (w - p.width * cell) / 2, oy: (h - p.height * cell) / 2 });
  }, [setViewport]);

  const zoomAt = useCallback(
    (factor: number, sx?: number, sy?: number) => {
      const { w, h } = size.current;
      const x = sx ?? w / 2;
      const y = sy ?? h / 2;
      const v = vp.current;
      const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, v.cell * factor));
      const k = cell / v.cell;
      setViewport({ cell, ox: x - (x - v.ox) * k, oy: y - (y - v.oy) * k });
    },
    [setViewport],
  );

  // Keep the latest props for the draw loop and redraw on every change.
  useEffect(() => {
    latest.current = props;
    const p = props.pattern;
    const key = p ? `${p.width}x${p.height}` : '';
    if (p && key !== fittedFor.current && size.current.w > 0) {
      fittedFor.current = key;
      fit();
    }
    requestDraw();
  });

  // Track the container size.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const prev = size.current;
      size.current = { w: width, h: height };
      const p = latest.current.pattern;
      if (p && (prev.w === 0 || fittedFor.current === '')) {
        fittedFor.current = `${p.width}x${p.height}`;
        fit();
      } else if (prev.w > 0) {
        // Keep the centre in place.
        const v = vp.current;
        setViewport({ ...v, ox: v.ox + (width - prev.w) / 2, oy: v.oy + (height - prev.h) / 2 });
      }
      draw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw, fit, setViewport]);

  // Redraw once the symbol font arrives, and on theme changes.
  useEffect(() => {
    ensureSymbolFont().then(requestDraw);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', requestDraw);
    return () => mq.removeEventListener('change', requestDraw);
  }, [requestDraw]);

  // Wheel zoom (non-passive so the page doesn't scroll).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (latest.current.view === 'original') return;
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-Math.max(-300, Math.min(300, delta)) * (e.ctrlKey ? 0.01 : 0.0018));
      zoomAt(factor, e.clientX - r.left, e.clientY - r.top);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // Keyboard: space = temporary pan, +/- zoom, 0 fit.
  useEffect(() => {
    const typing = (target: EventTarget | null) =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('.modal-backdrop')) return;
      if (e.code === 'Space') {
        if (!spaceDown.current) {
          spaceDown.current = true;
          setSpacePan(true);
        }
        if (e.target === document.body || e.target === canvasRef.current) e.preventDefault();
      } else if (e.key === '+' || e.key === '=') zoomAt(1.4);
      else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.4);
      else if (e.key === '0') fit();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDown.current = false;
        setSpacePan(false);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [fit, zoomAt]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );

  const local = (e: ReactPointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const cellAt = (x: number, y: number): [number, number] => {
    const v = vp.current;
    return [Math.floor((x - v.ox) / v.cell), Math.floor((y - v.oy) / v.cell)];
  };
  const inside = (p: Pattern, cx: number, cy: number) =>
    cx >= 0 && cy >= 0 && cx < p.width && cy < p.height;

  const paintLine = (p: Pattern, from: [number, number], to: [number, number], value: string) => {
    const cells: Array<[number, string]> = [];
    for (const [x, y] of lineCells(from[0], from[1], to[0], to[1])) {
      if (inside(p, x, y)) cells.push([y * p.width + x, value]);
    }
    if (cells.length) props.onPaint(cells);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pt = local(e);
    pointers.current.set(e.pointerId, pt);
    e.currentTarget.setPointerCapture(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size === 2) {
      if (g?.kind === 'paint') props.onStrokeEnd();
      const [a, b] = [...pointers.current.values()];
      const v = vp.current;
      gesture.current = {
        kind: 'pinch',
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mx: (a.x + b.x) / 2,
        my: (a.y + b.y) / 2,
        ...v,
      };
      return;
    }
    if (pointers.current.size > 2) return;
    const p = pattern;
    const editable = p && view !== 'original';
    const wantsPan =
      tool === 'pan' || e.button === 1 || e.button === 2 || spaceDown.current || !editable;
    if (wantsPan) {
      if (view === 'original') return;
      const v = vp.current;
      gesture.current = { kind: 'pan', sx: pt.x, sy: pt.y, ox: v.ox, oy: v.oy };
      setGrabbing(true);
      return;
    }
    const [cx, cy] = cellAt(pt.x, pt.y);
    if (!inside(p, cx, cy)) return;
    const index = cy * p.width + cx;
    if (tool === 'pencil' || tool === 'eraser') {
      if (tool === 'pencil' && !activeColor) {
        props.onChooseColor();
        return;
      }
      const value = tool === 'eraser' ? NO_STITCH : activeColor!;
      props.onStrokeStart();
      gesture.current = { kind: 'paint', last: [cx, cy], value };
      paintLine(p, [cx, cy], [cx, cy], value);
    } else if (tool === 'fill') {
      props.onFill(index);
    } else if (tool === 'picker') {
      props.onPick(index);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pt = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, pt);
    const g = gesture.current;
    const p = pattern;
    if (p && view !== 'original') {
      const [cx, cy] = cellAt(pt.x, pt.y);
      const h = inside(p, cx, cy) ? { x: cx, y: cy } : null;
      const prev = hoverRef.current;
      if (h?.x !== prev?.x || h?.y !== prev?.y) {
        hoverRef.current = h;
        setHover(h);
        requestDraw();
      }
    }
    if (!g) return;
    if (g.kind === 'pan') {
      setViewport({ cell: vp.current.cell, ox: g.ox + pt.x - g.sx, oy: g.oy + pt.y - g.sy });
    } else if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const cell = Math.min(MAX_CELL, Math.max(MIN_CELL, (g.cell * d) / g.d0));
      const k = cell / g.cell;
      setViewport({ cell, ox: mx - (g.mx - g.ox) * k, oy: my - (g.my - g.oy) * k });
    } else if (g.kind === 'paint' && p) {
      const [cx, cy] = cellAt(pt.x, pt.y);
      if (cx !== g.last[0] || cy !== g.last[1]) {
        paintLine(p, g.last, [cx, cy], g.value);
        g.last = [cx, cy];
      }
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g?.kind === 'paint') props.onStrokeEnd();
    if (g?.kind === 'pinch' && pointers.current.size === 1) {
      const [rest] = [...pointers.current.values()];
      const v = vp.current;
      gesture.current = { kind: 'pan', sx: rest.x, sy: rest.y, ox: v.ox, oy: v.oy };
      return;
    }
    if (pointers.current.size === 0) {
      gesture.current = null;
      setGrabbing(false);
    }
  };

  const onPointerLeave = () => {
    if (hoverRef.current) {
      hoverRef.current = null;
      setHover(null);
      requestDraw();
    }
  };

  const hoverInfo = (() => {
    if (!hover || !pattern || view === 'original') return null;
    const v = pattern.cells[hover.y * pattern.width + hover.x];
    const label = v === EMPTY ? t('view.empty') : threadTitle(pattern.colors[v].thread);
    return `${t('view.hover', { x: hover.x + 1, y: hover.y + 1 })} · ${label}`;
  })();

  const active = activeColor ? threadById(activeColor) : undefined;
  const cursor =
    view === 'original'
      ? 'default'
      : grabbing
        ? 'grabbing'
        : spacePan || tool === 'pan'
          ? 'grab'
          : tool === 'picker' || tool === 'fill'
            ? 'cell'
            : 'crosshair';

  return (
    <div className="pattern-view">
      <div className="toolbar" role="toolbar" aria-label={t('view.chart')}>
        <Segmented<View>
          label={t('view.chart')}
          value={view}
          onChange={onView}
          options={[
            { value: 'chart', label: t('view.chart') },
            { value: 'preview', label: t('view.preview') },
            { value: 'original', label: t('view.original') },
          ]}
        />
        {view === 'chart' && (
          <Segmented<ChartStyle>
            label={t('view.style.symbols')}
            value={chartStyle}
            onChange={onChartStyle}
            options={[
              { value: 'symbols', label: t('view.style.symbols') },
              { value: 'colors', label: t('view.style.colors') },
              { value: 'both', label: t('view.style.both') },
            ]}
          />
        )}
        <div className="toolbar-spacer" />
        {view !== 'original' && (
          <div className="tool-group">
            <IconButton
              icon="hand"
              label={`${t('tool.pan')} (H)`}
              active={tool === 'pan'}
              onClick={() => onTool('pan')}
            />
            <IconButton
              icon="pencil"
              label={`${t('tool.pencil')} (B)`}
              active={tool === 'pencil'}
              onClick={() => onTool('pencil')}
            />
            <IconButton
              icon="eraser"
              label={`${t('tool.eraser')} (E)`}
              active={tool === 'eraser'}
              onClick={() => onTool('eraser')}
            />
            <IconButton
              icon="fill"
              label={`${t('tool.fill')} (G)`}
              active={tool === 'fill'}
              onClick={() => onTool('fill')}
            />
            <IconButton
              icon="picker"
              label={`${t('tool.picker')} (I)`}
              active={tool === 'picker'}
              onClick={() => onTool('picker')}
            />
            <button
              type="button"
              className="active-color"
              title={`${t('tool.activeColor')}: ${active ? threadTitle(active) : t('tool.chooseColor')}`}
              aria-label={t('tool.chooseColor')}
              onClick={props.onChooseColor}
            >
              <span
                style={{ background: active?.hex ?? 'transparent' }}
                className={active ? '' : 'none'}
              />
            </button>
            <IconButton
              icon="undo"
              label={`${t('tool.undo')} (Ctrl+Z)`}
              disabled={!canUndo}
              onClick={props.onUndo}
            />
            <IconButton
              icon="redo"
              label={`${t('tool.redo')} (Ctrl+Y)`}
              disabled={!canRedo}
              onClick={props.onRedo}
            />
            {editCount > 0 && (
              <IconButton
                icon="trash"
                label={`${t('tool.clearEdits')} — ${t('tool.editsCount', { n: editCount })}`}
                onClick={props.onClearEdits}
              />
            )}
          </div>
        )}
        {view !== 'original' && (
          <div className="tool-group">
            <IconButton icon="zoomOut" label={t('view.zoomOut')} onClick={() => zoomAt(1 / 1.4)} />
            <span className="zoom-label">{num(zoom, zoom < 10 ? 1 : 0)} px</span>
            <IconButton icon="zoomIn" label={t('view.zoomIn')} onClick={() => zoomAt(1.4)} />
            <IconButton icon="fit" label={`${t('view.fit')} (0)`} onClick={fit} />
          </div>
        )}
      </div>
      <div className="canvas-wrap" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
          onContextMenu={(e) => e.preventDefault()}
          data-testid="pattern-canvas"
        />
        {busy && (
          <div className="busy" role="status">
            <span className="spinner" aria-hidden="true" />
            {t('view.working')}
          </div>
        )}
        {hoverInfo && <div className="hover-info">{hoverInfo}</div>}
      </div>
    </div>
  );
}
