import { useMemo } from 'react';
import { threadById, type Thread } from '../core/palettes';
import type { Pattern } from '../core/pattern';
import type { Settings } from '../core/settings';
import { skeinsToBuy } from '../core/skeins';
import { fabricById } from '../core/sizing';
import { useI18n } from '../i18n';
import { SymbolSwatch } from './SymbolSwatch';
import { Menu } from './ui';

export interface LegendActions {
  onHighlight: (id: string | null) => void;
  onReplace: (thread: Thread) => void;
  onBackground: (id: string) => void;
  onExclude: (id: string) => void;
  onPaint: (id: string) => void;
  onRestoreBackground: (id: string) => void;
  onUndoReplace: (fromId: string) => void;
}

export function Legend({
  pattern,
  settings,
  highlight,
  activeColor,
  actions,
}: {
  pattern: Pattern;
  settings: Settings;
  highlight: string | null;
  activeColor: string | null;
  actions: LegendActions;
}) {
  const { t, num } = useI18n();
  const fabric = fabricById(settings.fabricId);
  const rows = useMemo(
    () => [...pattern.colors].sort((a, b) => b.count - a.count || a.symbol - b.symbol),
    [pattern],
  );
  const totalSkeins = rows.reduce((s, r) => s + skeinsToBuy(r.count, fabric, settings.strands), 0);
  const replacements = Object.entries(settings.replacements);

  return (
    <div className="legend">
      <div className="legend-head">
        <h2>{t('legend.title')}</h2>
        <span className="muted">{t('legend.colors', { n: rows.length })}</span>
      </div>
      <table className="legend-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{t('legend.symbol')}</span>
            </th>
            <th scope="col">{t('legend.thread')}</th>
            <th scope="col" className="num">
              {t('legend.stitches')}
            </th>
            <th scope="col" className="num">
              {t('legend.skeins')}
            </th>
            <th scope="col">
              <span className="sr-only">{t('legend.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const id = c.thread.id;
            const isHl = highlight === id;
            return (
              <tr
                key={id}
                className={`${isHl ? 'is-highlighted' : ''}${activeColor === id ? ' is-active' : ''}`}
              >
                <td>
                  <button
                    type="button"
                    className="swatch-btn"
                    aria-pressed={isHl}
                    title={t('legend.highlight')}
                    onClick={() => actions.onHighlight(isHl ? null : id)}
                  >
                    <SymbolSwatch thread={c.thread} symbol={c.symbol} />
                  </button>
                </td>
                <td className="thread-cell">
                  <button
                    type="button"
                    className="thread-name"
                    onClick={() => actions.onHighlight(isHl ? null : id)}
                  >
                    <strong>{c.thread.code}</strong>
                    <span>{c.thread.name}</span>
                  </button>
                </td>
                <td className="num">{num(c.count)}</td>
                <td className="num">{skeinsToBuy(c.count, fabric, settings.strands)}</td>
                <td>
                  <Menu
                    label={t('legend.actions')}
                    items={[
                      {
                        label: t('legend.highlight'),
                        icon: 'eye',
                        onClick: () => actions.onHighlight(isHl ? null : id),
                      },
                      {
                        label: t('legend.paint'),
                        icon: 'brush',
                        onClick: () => actions.onPaint(id),
                      },
                      {
                        label: t('legend.replace'),
                        icon: 'swap',
                        onClick: () => actions.onReplace(c.thread),
                      },
                      {
                        label: t('legend.background'),
                        icon: 'skip',
                        onClick: () => actions.onBackground(id),
                      },
                      {
                        label: t('legend.exclude'),
                        icon: 'ban',
                        onClick: () => actions.onExclude(id),
                      },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td>{t('legend.total')}</td>
            <td className="num">{num(pattern.stitchCount)}</td>
            <td className="num">{totalSkeins}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <p className="hint">{t('legend.emptyCells')}</p>

      {settings.background.length > 0 && (
        <div className="subsection">
          <h3>{t('legend.skipped')}</h3>
          <ul className="chips">
            {settings.background.map((id) => {
              const th = threadById(id);
              if (!th) return null;
              return (
                <li key={id} className="chip">
                  <span className="dot" style={{ background: th.hex }} />
                  {th.brand} {th.code}
                  <button
                    type="button"
                    title={t('colors.restore')}
                    aria-label={`${t('colors.restore')} ${th.code}`}
                    onClick={() => actions.onRestoreBackground(id)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {replacements.length > 0 && (
        <div className="subsection">
          <h3>{t('legend.replacements')}</h3>
          <ul className="chips">
            {replacements.map(([from, to]) => {
              const a = threadById(from);
              const b = threadById(to);
              if (!a || !b) return null;
              return (
                <li key={from} className="chip">
                  <span className="dot" style={{ background: a.hex }} />
                  {a.code} → <span className="dot" style={{ background: b.hex }} />
                  {b.code}
                  <button
                    type="button"
                    title={t('legend.undoReplace')}
                    aria-label={`${t('legend.undoReplace')} ${a.code}`}
                    onClick={() => actions.onUndoReplace(from)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
