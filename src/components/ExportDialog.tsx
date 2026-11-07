import { useState } from 'react';
import type { Pattern } from '../core/pattern';
import type { Settings } from '../core/settings';
import { canvasToBlob, renderChartCanvas, renderPreviewCanvas } from '../export/images';
import { CELL_SIZES_MM, chartLayout, type CellSize, type Paper } from '../export/layout';
import { useI18n } from '../i18n';
import { downloadBlob, safeFileName } from '../lib/download';
import { ensureSymbolFont } from '../lib/fonts';
import { Field, Modal, Segmented } from './ui';

export function ExportDialog({
  pattern,
  settings,
  onClose,
  onError,
}: {
  pattern: Pattern;
  settings: Settings;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const { t, num, lang } = useI18n();
  const [paper, setPaper] = useState<Paper>(
    lang === 'en' && navigator.language === 'en-US' ? 'letter' : 'a4',
  );
  const [cell, setCell] = useState<CellSize>('medium');
  const [style, setStyle] = useState<'symbols' | 'colors'>('symbols');
  const [cover, setCover] = useState(true);
  const [busy, setBusy] = useState(false);
  const pages = chartLayout(pattern.width, pattern.height, paper, CELL_SIZES_MM[cell]).tiles.length;
  const base = safeFileName(settings.name, lang === 'pl' ? 'wzor-haftu' : 'cross-stitch-pattern');

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    // Let the spinner paint before heavy work.
    await new Promise((r) => setTimeout(r, 30));
    try {
      await ensureSymbolFont();
      await task();
    } catch (err) {
      onError(t('error.export', { msg: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = () =>
    run(async () => {
      const { createPdf } = await import('../export/pdf');
      const preview = renderPreviewCanvas(pattern, settings.fabricColor, 1400);
      const blob = await createPdf(
        {
          pattern,
          settings,
          previewPng: preview.toDataURL('image/png'),
          previewSize: { width: preview.width, height: preview.height },
          t,
          num,
          lang,
        },
        { paper, cellMm: CELL_SIZES_MM[cell], style, cover },
      );
      downloadBlob(blob, `${base}.pdf`);
    });

  const exportPng = (kind: 'chart' | 'preview') =>
    run(async () => {
      const canvas =
        kind === 'chart'
          ? renderChartCanvas(pattern, style === 'colors' ? 'both' : 'symbols')
          : renderPreviewCanvas(pattern, settings.fabricColor);
      const suffix =
        lang === 'pl'
          ? kind === 'chart'
            ? 'wzor'
            : 'podglad'
          : kind === 'chart'
            ? 'chart'
            : 'preview';
      downloadBlob(await canvasToBlob(canvas), `${base}-${suffix}.png`);
    });

  return (
    <Modal title={t('export.title')} onClose={onClose}>
      <div className="export">
        <h3>{t('export.pdf')}</h3>
        <Field label={t('export.paper')}>
          <Segmented<Paper>
            label={t('export.paper')}
            value={paper}
            onChange={setPaper}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
            ]}
          />
        </Field>
        <Field label={t('export.cell')}>
          <Segmented<CellSize>
            label={t('export.cell')}
            value={cell}
            onChange={setCell}
            options={(['small', 'medium', 'large'] as const).map((c) => ({
              value: c,
              label: t(`export.cell.${c}`, { mm: num(CELL_SIZES_MM[c], 1) }),
            }))}
          />
        </Field>
        <Field label={t('export.style')}>
          <Segmented<'symbols' | 'colors'>
            label={t('export.style')}
            value={style}
            onChange={setStyle}
            options={[
              { value: 'symbols', label: t('export.style.symbols') },
              { value: 'colors', label: t('export.style.colors') },
            ]}
          />
        </Field>
        <label className="field checkbox">
          <input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} />
          <span>{t('export.cover')}</span>
        </label>
        <p className="hint">{t('export.pages', { n: pages })}</p>
        <button type="button" className="btn primary" disabled={busy} onClick={exportPdf}>
          {busy ? t('export.working') : t('export.downloadPdf')}
        </button>

        <h3>{t('export.png')}</h3>
        <div className="button-row">
          <button type="button" className="btn" disabled={busy} onClick={() => exportPng('chart')}>
            {t('export.pngChart')}
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => exportPng('preview')}
          >
            {t('export.pngPreview')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
