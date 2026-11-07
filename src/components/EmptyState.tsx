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
      </div>
    </div>
  );
}
