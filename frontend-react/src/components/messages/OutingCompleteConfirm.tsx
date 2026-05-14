import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function OutingCompleteConfirm({ onConfirm, onClose }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-surface p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-sage/10">
          <CheckCircle2 className="h-5 w-5 text-sage" />
        </div>
        <h2 className="mb-1 font-heading text-base font-bold text-text-primary">
          {t('outing.complete_confirm_title')}
        </h2>
        <p className="mb-5 text-sm text-text-secondary">{t('outing.complete_confirm_body')}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border-subtle py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-sage py-2 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t('outing.complete')}
          </button>
        </div>
      </div>
    </div>
  );
}
