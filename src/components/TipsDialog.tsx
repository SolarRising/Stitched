import { useI18n, type MessageKey } from '../i18n';
import { Modal } from './ui';

const TIPS: MessageKey[] = ['tips.1', 'tips.2', 'tips.3', 'tips.4', 'tips.5', 'tips.6', 'tips.7'];

export function TipsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal title={t('tips.title')} onClose={onClose}>
      <ol className="tips">
        {TIPS.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ol>
      <button type="button" className="btn primary" onClick={onClose}>
        {t('tips.close')}
      </button>
    </Modal>
  );
}
