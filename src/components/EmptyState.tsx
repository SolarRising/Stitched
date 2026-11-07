import { useI18n } from '../i18n';
import { Icon } from './Icon';

export function EmptyState({
  onOpenImage,
  onSample,
}: {
  onOpenImage: () => void;
  onSample: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="empty">
      <div className="empty-card">
        <h2>{t('empty.title')}</h2>
        <p className="lead">{t('empty.lead')}</p>
        <button type="button" className="dropzone" onClick={onOpenImage}>
          <Icon name="image" size={36} />
          <span className="dropzone-title">{t('empty.drop')}</span>
          <span className="muted">{t('empty.formats')}</span>
        </button>
        <button type="button" className="btn" onClick={onSample}>
          <Icon name="sparkle" />
          {t('empty.sample')}
        </button>
        <ol className="steps">
          <li>{t('empty.step1')}</li>
          <li>{t('empty.step2')}</li>
          <li>{t('empty.step3')}</li>
        </ol>
        <p className="muted small">{t('app.privacy')}</p>
        {hosted && (
          <p className="links small">
            <a href="./stitched-offline.html" download="stitched.html">
              {t('empty.offline')}
            </a>
            {repoUrl && (
              <>
                {' · '}
                <a href={repoUrl} target="_blank" rel="noreferrer">
                  {t('empty.source')}
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** Served from a real web server (not the dev server, not a file opened from disk). */
const hosted = import.meta.env.PROD && location.protocol.startsWith('http');

/** On GitHub Pages (user.github.io/Repo/) the source lives at github.com/user/Repo. */
const repoUrl = (() => {
  const m = location.hostname.match(/^([a-z0-9-]+)\.github\.io$/i);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  return m && repo ? `https://github.com/${m[1]}/${repo}` : null;
})();
