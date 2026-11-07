import { useId } from 'react';
import { threadById } from '../core/palettes';
import type { Pattern } from '../core/pattern';
import { CLEANUP_LEVELS, MAX_COLORS, MIN_COLORS, type Settings } from '../core/settings';
import { useI18n, type MessageKey } from '../i18n';
import { FABRIC_COLORS } from '../lib/fabricColors';
import { Field, Section, Segmented, Slider } from './ui';

export function ColorsPanel({
  settings,
  pattern,
  onChange,
  onDetectBackground,
}: {
  settings: Settings;
  pattern: Pattern | null;
  onChange: (patch: Partial<Settings>) => void;
  onDetectBackground: () => void;
}) {
  const { t } = useI18n();
  const ditherId = useId();
  const colorInputId = useId();
  const signed = (v: number) => (v > 0 ? `+${v}` : String(v));
  const adjusted =
    settings.brightness !== 0 || settings.contrast !== 0 || settings.saturation !== 0;
  const isPreset = FABRIC_COLORS.some((c) => c.hex === settings.fabricColor);

  return (
    <Section title={t('section.colors')}>
      <Slider
        label={t('colors.max')}
        value={settings.maxColors}
        min={MIN_COLORS}
        max={MAX_COLORS}
        onChange={(maxColors) => onChange({ maxColors })}
      />
      {pattern && <p className="hint">{t('colors.used', { n: pattern.colors.length })}</p>}

      <div className="field checkbox">
        <input
          id={ditherId}
          type="checkbox"
          checked={settings.dither}
          onChange={(e) => onChange({ dither: e.target.checked })}
        />
        <label htmlFor={ditherId}>{t('colors.dither')}</label>
        <p className="hint">{t('colors.ditherHint')}</p>
      </div>

      <Field label={t('colors.cleanup')} hint={t('colors.cleanupHint')}>
        <Segmented<number>
          label={t('colors.cleanup')}
          value={settings.cleanup}
          onChange={(cleanup) => onChange({ cleanup })}
          options={CLEANUP_LEVELS.map((v) => ({
            value: v,
            label: t(`colors.cleanup.${v}` as MessageKey),
          }))}
        />
      </Field>

      <div className="subsection">
        <div className="subsection-head">
          <h3>{t('colors.adjust')}</h3>
          <button
            type="button"
            className="link-btn"
            disabled={!adjusted}
            onClick={() => onChange({ brightness: 0, contrast: 0, saturation: 0 })}
          >
            {t('colors.resetAdjust')}
          </button>
        </div>
        <Slider
          label={t('colors.brightness')}
          value={settings.brightness}
          min={-100}
          max={100}
          resetTo={0}
          format={signed}
          onChange={(brightness) => onChange({ brightness })}
        />
        <Slider
          label={t('colors.contrast')}
          value={settings.contrast}
          min={-100}
          max={100}
          resetTo={0}
          format={signed}
          onChange={(contrast) => onChange({ contrast })}
        />
        <Slider
          label={t('colors.saturation')}
          value={settings.saturation}
          min={-100}
          max={100}
          resetTo={0}
          format={signed}
          onChange={(saturation) => onChange({ saturation })}
        />
      </div>

      <div className="subsection">
        <h3>{t('colors.background')}</h3>
        <button type="button" className="btn" disabled={!pattern} onClick={onDetectBackground}>
          {t('colors.detectBackground')}
        </button>
        <p className="hint">{t('colors.backgroundHint')}</p>
      </div>

      <div className="subsection">
        <h3>{t('colors.fabricColor')}</h3>
        <div className="swatches" role="radiogroup" aria-label={t('colors.fabricColor')}>
          {FABRIC_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={settings.fabricColor === c.hex}
              className={`swatch${settings.fabricColor === c.hex ? ' is-active' : ''}`}
              style={{ background: c.hex }}
              title={t(`fabricColor.${c.id}` as MessageKey)}
              aria-label={t(`fabricColor.${c.id}` as MessageKey)}
              onClick={() => onChange({ fabricColor: c.hex })}
            />
          ))}
          <label
            className={`swatch custom${!isPreset ? ' is-active' : ''}`}
            title={t('colors.fabricCustom')}
            htmlFor={colorInputId}
            style={!isPreset ? { background: settings.fabricColor } : undefined}
          >
            <input
              id={colorInputId}
              type="color"
              value={settings.fabricColor}
              aria-label={t('colors.fabricCustom')}
              onChange={(e) => onChange({ fabricColor: e.target.value.toLowerCase() })}
            />
          </label>
        </div>
      </div>

      {settings.excluded.length > 0 && (
        <div className="subsection">
          <div className="subsection-head">
            <h3>{t('colors.excluded')}</h3>
            <button type="button" className="link-btn" onClick={() => onChange({ excluded: [] })}>
              {t('colors.restoreAll')}
            </button>
          </div>
          <ul className="chips">
            {settings.excluded.map((id) => {
              const th = threadById(id);
              if (!th) return null;
              return (
                <li key={id} className="chip">
                  <span className="dot" style={{ background: th.hex }} />
                  {th.code}
                  <button
                    type="button"
                    aria-label={`${t('colors.restore')} ${th.code}`}
                    title={t('colors.restore')}
                    onClick={() =>
                      onChange({ excluded: settings.excluded.filter((x) => x !== id) })
                    }
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Section>
  );
}
