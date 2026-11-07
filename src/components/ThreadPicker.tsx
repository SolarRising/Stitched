import { useMemo, useState } from 'react';
import { rgbToLab, type RGB } from '../core/color';
import { DMC, nearestThreads, type Thread } from '../core/palettes';
import { useI18n } from '../i18n';
import { threadTitle } from '../lib/labels';
import { Modal } from './ui';

function ThreadButton({ thread, onPick }: { thread: Thread; onPick: (t: Thread) => void }) {
  return (
    <button
      type="button"
      className="thread-btn"
      title={threadTitle(thread)}
      onClick={() => onPick(thread)}
    >
      <span className="thread-color" style={{ background: thread.hex }} />
      <span className="thread-code">{thread.code}</span>
    </button>
  );
}

export function ThreadPicker({
  title,
  reference,
  exclude = [],
  onPick,
  onClose,
}: {
  title?: string;
  /** Colour to suggest close matches for. */
  reference?: RGB;
  exclude?: readonly string[];
  onPick: (t: Thread) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const excluded = useMemo(() => new Set(exclude), [exclude]);
  const available = useMemo(() => DMC.filter((th) => !excluded.has(th.id)), [excluded]);

  const nearest = useMemo(() => {
    if (!reference) return [];
    return nearestThreads(rgbToLab(...reference), available, 16, 48);
  }, [reference, available]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (th) => th.code.toLowerCase().startsWith(q) || th.name.toLowerCase().includes(q),
    );
  }, [query, available]);

  return (
    <Modal title={title ?? t('picker.title')} onClose={onClose} wide>
      <input
        type="search"
        className="picker-search"
        placeholder={t('picker.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {nearest.length > 0 && !query && (
        <>
          <h3 className="picker-heading">{t('picker.nearest')}</h3>
          <div className="thread-grid">
            {nearest.map((th) => (
              <ThreadButton key={th.id} thread={th} onPick={onPick} />
            ))}
          </div>
        </>
      )}
      <h3 className="picker-heading">{t('picker.all')}</h3>
      {filtered.length === 0 ? (
        <p className="hint">{t('picker.noResults')}</p>
      ) : (
        <div className="thread-grid">
          {filtered.map((th) => (
            <ThreadButton key={th.id} thread={th} onPick={onPick} />
          ))}
        </div>
      )}
    </Modal>
  );
}
