import { useId, useState } from 'react';
import type { Pattern } from '../core/pattern';
import type { Settings } from '../core/settings';
import {
  clampStitches,
  cmToStitches,
  defaultMarginCm,
  defaultStrands,
  fabricById,
  fabricPieceCm,
  FABRICS,
  fitToBox,
  GARMENT_PRESETS,
  heightForWidth,
  MAX_STITCHES,
  MIN_STITCHES,
  presetById,
  stitchesToCm,
  widthForHeight,
  type FabricKind,
} from '../core/sizing';
import { strandsLabel, useI18n, type MessageKey } from '../i18n';
import { fabricLabel } from '../lib/labels';
import { Field, IconButton, NumberField, Section, Segmented } from './ui';

type Unit = 'cm' | 'st';

export function SizePanel({
  settings,
  aspect,
  pattern,
  onChange,
}: {
  settings: Settings;
  aspect: number;
  pattern: Pattern | null;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const { t, num, lang } = useI18n();
  const [unit, setUnit] = useState<Unit>('cm');
  const ids = { preset: useId(), fabric: useId(), w: useId(), h: useId(), strands: useId() };
  const fabric = fabricById(settings.fabricId);
  const preset = presetById(settings.presetId);
  const { width, height, lockAspect } = settings;

  const choosePreset = (id: string) => {
    const p = presetById(id);
    if (!p) return onChange({ presetId: null });
    const f = fabricById(p.fabricId);
    onChange({
      presetId: p.id,
      fabricId: f.id,
      strands: defaultStrands(f),
      lockAspect: true,
      ...fitToBox(aspect, p.maxWidthCm, p.maxHeightCm, f),
    });
  };

  const chooseFabric = (id: string) => {
    const f = fabricById(id);
    if (preset) {
      onChange({
        fabricId: f.id,
        strands: defaultStrands(f),
        ...fitToBox(aspect, preset.maxWidthCm, preset.maxHeightCm, f),
      });
      return;
    }
    // Keep the physical size the same on the new fabric.
    const w = cmToStitches(stitchesToCm(width, fabric), f);
    const h = lockAspect
      ? heightForWidth(w, aspect)
      : cmToStitches(stitchesToCm(height, fabric), f);
    onChange({ fabricId: f.id, strands: defaultStrands(f), width: w, height: h });
  };

  const toStitches = (v: number) => (unit === 'cm' ? cmToStitches(v, fabric) : clampStitches(v));
  const setWidth = (v: number) => {
    const w = toStitches(v);
    onChange({ width: w, height: lockAspect ? heightForWidth(w, aspect) : height, presetId: null });
  };
  const setHeight = (v: number) => {
    const h = toStitches(v);
    onChange({ height: h, width: lockAspect ? widthForHeight(h, aspect) : width, presetId: null });
  };

  const display = (st: number) => (unit === 'cm' ? stitchesToCm(st, fabric) : st);
  const maxValue = unit === 'cm' ? stitchesToCm(MAX_STITCHES, fabric) : MAX_STITCHES;
  const minValue = unit === 'cm' ? stitchesToCm(MIN_STITCHES, fabric) : MIN_STITCHES;
  const wCm = stitchesToCm(width, fabric);
  const hCm = stitchesToCm(height, fabric);
  const piece = fabricPieceCm(width, height, fabric);
  const kinds: FabricKind[] = ['aida', 'evenweave', 'waste'];
  const cm = (v: number) => num(v, 1);

  return (
    <Section title={t('section.size')}>
      <Field label={t('size.placement')} htmlFor={ids.preset}>
        <select
          id={ids.preset}
          value={settings.presetId ?? ''}
          onChange={(e) => choosePreset(e.target.value)}
        >
          <option value="">{t('size.custom')}</option>
          <optgroup label={t('size.presetGroup')}>
            {GARMENT_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {t(`preset.${p.id}` as MessageKey)} —{' '}
                {t('size.presetUpTo', { w: cm(p.maxWidthCm), h: cm(p.maxHeightCm) })}
              </option>
            ))}
          </optgroup>
        </select>
      </Field>

      <Field
        label={t('size.fabric')}
        htmlFor={ids.fabric}
        hint={fabric.kind === 'waste' ? t('size.wasteHint') : undefined}
      >
        <select id={ids.fabric} value={fabric.id} onChange={(e) => chooseFabric(e.target.value)}>
          {kinds.map((k) => (
            <optgroup key={k} label={t(`size.fabric.${k}` as MessageKey)}>
              {FABRICS.filter((f) => f.kind === k).map((f) => (
                <option key={f.id} value={f.id}>
                  {fabricLabel(f, t, lang === 'pl')}
                  {f.over === 2 ? (lang === 'pl' ? ' (przez 2)' : ' (over 2)') : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="size-grid">
        <Field label={t('size.width')} htmlFor={ids.w}>
          <NumberField
            id={ids.w}
            value={display(width)}
            digits={unit === 'cm' ? 1 : 0}
            step={unit === 'cm' ? 0.5 : 1}
            min={minValue}
            max={maxValue}
            onCommit={setWidth}
            suffix={unit === 'cm' ? 'cm' : '×'}
          />
        </Field>
        <IconButton
          icon={lockAspect ? 'lock' : 'unlock'}
          label={t('size.lock')}
          active={lockAspect}
          className="lock-btn"
          onClick={() =>
            onChange(
              lockAspect
                ? { lockAspect: false }
                : { lockAspect: true, height: heightForWidth(width, aspect) },
            )
          }
        />
        <Field label={t('size.height')} htmlFor={ids.h}>
          <NumberField
            id={ids.h}
            value={display(height)}
            digits={unit === 'cm' ? 1 : 0}
            step={unit === 'cm' ? 0.5 : 1}
            min={minValue}
            max={maxValue}
            onCommit={setHeight}
            suffix={unit === 'cm' ? 'cm' : '×'}
          />
        </Field>
      </div>
      <Segmented<Unit>
        label={t('size.unit.cm')}
        value={unit}
        onChange={setUnit}
        options={[
          { value: 'cm', label: t('size.unit.cm') },
          { value: 'st', label: t('size.unit.stitches') },
        ]}
      />

      <Field label={t('size.strands')} htmlFor={ids.strands}>
        <select
          id={ids.strands}
          value={settings.strands}
          onChange={(e) => onChange({ strands: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {strandsLabel(t, n)}
            </option>
          ))}
        </select>
      </Field>

      <dl className="summary">
        <div>
          <dt>{t('size.summary.grid')}</dt>
          <dd>{t('size.summary.gridValue', { w: width, h: height })}</dd>
        </div>
        <div>
          <dt>{t('size.summary.finished')}</dt>
          <dd>
            {cm(wCm)} × {cm(hCm)} cm{' '}
            <span className="muted">
              ({num(wCm / 2.54, 1)} × {num(hCm / 2.54, 1)} in)
            </span>
          </dd>
        </div>
        <div>
          <dt>{t('size.summary.piece')}</dt>
          <dd>
            {num(Math.ceil(piece.width), 0)} × {num(Math.ceil(piece.height), 0)} cm
            <span className="muted block">
              {t('size.summary.pieceHint', { m: num(defaultMarginCm(fabric), 1) })}
            </span>
          </dd>
        </div>
        {pattern && (
          <div>
            <dt>{t('size.summary.stitches')}</dt>
            <dd>{num(pattern.stitchCount)}</dd>
          </div>
        )}
      </dl>
      {width * height > 40000 && <p className="hint warn">{t('size.big')}</p>}
    </Section>
  );
}
