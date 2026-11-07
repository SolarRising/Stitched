import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { useI18n } from '../i18n';
import { Icon, type IconName } from './Icon';

export function Section({
  title,
  children,
  defaultOpen = true,
  aside,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  aside?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={`section${open ? ' is-open' : ''}`}>
      <div className="section-head">
        <button
          type="button"
          className="section-toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="chevron" aria-hidden="true" />
          <h2>{title}</h2>
        </button>
        {aside}
      </div>
      {open && (
        <div className="section-body" id={id}>
          {children}
        </div>
      )}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  resetTo,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  resetTo?: number;
}) {
  const id = useId();
  return (
    <div className="field slider">
      <div className="slider-head">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <output htmlFor={id}>{format ? format(value) : value}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={resetTo !== undefined ? () => onChange(resetTo) : undefined}
        style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%` }}
      />
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: ReactNode; title?: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'is-active' : ''}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function IconButton({
  icon,
  label,
  active,
  showLabel,
  className = '',
  ...rest
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  showLabel?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`icon-btn${active ? ' is-active' : ''}${showLabel ? ' with-label' : ''} ${className}`}
      aria-label={showLabel ? undefined : label}
      aria-pressed={active}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
      {showLabel && <span>{label}</span>}
    </button>
  );
}

/** Number input that commits on blur / Enter, so typing doesn't trigger work per keystroke. */
export function NumberField({
  value,
  onCommit,
  min,
  max,
  step = 1,
  digits = 0,
  id,
  suffix,
}: {
  value: number;
  onCommit: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  digits?: number;
  id?: string;
  suffix?: string;
}) {
  const shown = Number(value.toFixed(digits));
  const [text, setText] = useState(String(shown));
  const [prev, setPrev] = useState(shown);
  if (prev !== shown) {
    setPrev(shown);
    setText(String(shown));
  }
  const commit = () => {
    const v = Number(text.replace(',', '.'));
    if (Number.isFinite(v) && v > 0) {
      const clamped = Math.min(max, Math.max(min, v));
      onCommit(clamped);
      setText(String(Number(clamped.toFixed(digits))));
    } else setText(String(shown));
  };
  return (
    <div className="number-field">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setText(String(shown));
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const v = Math.min(max, Math.max(min, shown + (e.key === 'ArrowUp' ? step : -step)));
            onCommit(v);
          }
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, button:not(.modal-close), select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={`modal${wide ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
      >
        <div className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <IconButton
            icon="close"
            label={t('common.close')}
            className="modal-close"
            onClick={onClose}
          />
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Small dropdown menu anchored to a trigger button. */
export function Menu({
  label,
  icon = 'more',
  items,
}: {
  label: string;
  icon?: IconName;
  items: Array<{ label: string; icon: IconName; onClick: () => void; disabled?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <IconButton
        icon={icon}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="menu-list" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
            >
              <Icon name={it.icon} size={16} />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
