import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { normalizeCrop, type CropRect, type Rotation } from '../core/image';

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'new';

const MIN = 0.03;

function rotatedPreview(src: HTMLCanvasElement, rotation: Rotation, maxSide: number): string {
  const swap = rotation === 90 || rotation === 270;
  const rw = swap ? src.height : src.width;
  const rh = swap ? src.width : src.height;
  const scale = Math.min(1, maxSide / Math.max(rw, rh));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(rw * scale));
  c.height = Math.max(1, Math.round(rh * scale));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
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
  ctx.drawImage(src, 0, 0);
  return c.toDataURL('image/png');
}

export function CropBox({
  source,
  rotation,
  crop,
  onChange,
  label,
}: {
  source: HTMLCanvasElement;
  rotation: Rotation;
  crop: CropRect;
  onChange: (c: CropRect) => void;
  label: string;
}) {
  const url = useMemo(() => rotatedPreview(source, rotation, 720), [source, rotation]);
  const swap = rotation === 90 || rotation === 270;
  const aspect = swap ? source.height / source.width : source.width / source.height;
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: Mode; x: number; y: number; start: CropRect } | null>(null);
  const [draft, setDraft] = useState<CropRect | null>(null);
  const shown = draft ?? crop;

  const point = (e: ReactPointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const onDown = (e: ReactPointerEvent) => {
    const mode = ((e.target as HTMLElement).dataset.mode as Mode | undefined) ?? 'new';
    e.preventDefault();
    boxRef.current?.setPointerCapture(e.pointerId);
    const p = point(e);
    const start = mode === 'new' ? { x: p.x, y: p.y, w: 0, h: 0 } : shown;
    drag.current = { mode, x: p.x, y: p.y, start };
  };

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    const s = d.start;
    if (d.mode === 'move') {
      setDraft({
        x: Math.min(1 - s.w, Math.max(0, s.x + p.x - d.x)),
        y: Math.min(1 - s.h, Math.max(0, s.y + p.y - d.y)),
        w: s.w,
        h: s.h,
      });
      return;
    }
    // Corner drags keep the opposite corner fixed; 'new' spans from the press point.
    let left = s.x;
    let top = s.y;
    let right = s.x + s.w;
    let bottom = s.y + s.h;
    if (d.mode === 'new') {
      left = Math.min(d.x, p.x);
      right = Math.max(d.x, p.x);
      top = Math.min(d.y, p.y);
      bottom = Math.max(d.y, p.y);
    } else {
      if (d.mode === 'nw' || d.mode === 'sw') left = Math.min(p.x, right - MIN);
      if (d.mode === 'ne' || d.mode === 'se') right = Math.max(p.x, left + MIN);
      if (d.mode === 'nw' || d.mode === 'ne') top = Math.min(p.y, bottom - MIN);
      if (d.mode === 'sw' || d.mode === 'se') bottom = Math.max(p.y, top + MIN);
    }
    setDraft({ x: left, y: top, w: right - left, h: bottom - top });
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !draft) return;
    const next = draft.w < MIN || draft.h < MIN ? null : normalizeCrop(draft);
    setDraft(null);
    if (next) onChange(next);
  };

  return (
    <div
      className="crop"
      ref={boxRef}
      style={{ aspectRatio: String(aspect) }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="group"
      aria-label={label}
    >
      <img src={url} alt="" draggable={false} />
      <div
        className="crop-rect"
        style={{
          left: `${shown.x * 100}%`,
          top: `${shown.y * 100}%`,
          width: `${shown.w * 100}%`,
          height: `${shown.h * 100}%`,
        }}
        data-mode="move"
      >
        {(['nw', 'ne', 'sw', 'se'] as const).map((m) => (
          <span key={m} className={`crop-handle ${m}`} data-mode={m} />
        ))}
      </div>
    </div>
  );
}
