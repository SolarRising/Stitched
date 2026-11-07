import { useI18n, type Lang } from '../i18n';
import { Logo } from './Icon';
import { IconButton } from './ui';

export function Header({
  hasImage,
  canExport,
  onOpenImage,
  onSaveProject,
  onOpenProject,
  onExport,
  onTips,
}: {
  hasImage: boolean;
  canExport: boolean;
  onOpenImage: () => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  onExport: () => void;
  onTips: () => void;
}) {
  const { t, lang, setLang } = useI18n();
  return (
    <header className="header">
      <div className="brand">
        <Logo />
        <div>
          <h1>Stitched</h1>
          <p>{t('app.tagline')}</p>
        </div>
      </div>
      <nav className="header-actions">
        <IconButton icon="image" label={t('header.openImage')} showLabel onClick={onOpenImage} />
        <IconButton icon="open" label={t('header.openProject')} showLabel onClick={onOpenProject} />
        <IconButton
          icon="save"
          label={t('header.saveProject')}
          showLabel
          disabled={!hasImage}
          onClick={onSaveProject}
        />
        <IconButton icon="tips" label={t('header.tips')} showLabel onClick={onTips} />
        <button type="button" className="btn primary" disabled={!canExport} onClick={onExport}>
          {t('header.export')}
        </button>
        <div className="lang" role="group" aria-label={t('header.language')}>
          {(['pl', 'en'] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              className={lang === l ? 'is-active' : ''}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>
    </header>
  );
}
