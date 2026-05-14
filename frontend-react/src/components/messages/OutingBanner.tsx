import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Pencil, CheckCircle2, Backpack } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOutingStore } from '@/stores/outing.store';
import { ItemRow } from './ItemRow';
import { OutingEditModal } from './OutingEditModal';
import { OutingCompleteConfirm } from './OutingCompleteConfirm';
import type { Outing } from '@/types';

interface Props {
  outing: Outing;
  convId: string;
  myUid: string;
  canEdit: boolean;
}

export function OutingBanner({ outing, convId, myUid, canEdit }: Props) {
  const { t } = useTranslation();
  const { updateItems, complete } = useOutingStore();
  const [expanded, setExpanded] = useState(() => window.matchMedia('(min-width: 640px)').matches);
  const [showEdit, setShowEdit] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const doneItems = outing.items.filter(
    (item) => item.claims.reduce((acc, c) => acc + c.quantity, 0) >= item.quantityNeeded
  ).length;

  return (
    <>
      <div className="border-b border-border-subtle bg-surface-2/80 backdrop-blur-sm">
        {/* Banner header row */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-left"
        >
          <Backpack className="h-4 w-4 shrink-0 text-sage" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-text-primary">{outing.title}</p>
            <p className={cn(
              'text-[10px]',
              doneItems === outing.items.length && outing.items.length > 0 ? 'text-sage font-medium' : 'text-text-secondary'
            )}>
              {t('outing.banner_progress', { done: doneItems, total: outing.items.length })}
            </p>
          </div>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-text-secondary" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-secondary" />}
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="px-4 pb-3">
            {/* Items */}
            <div className="mb-2 max-h-44 overflow-y-auto sm:max-h-none">
              {outing.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  outingId={outing._id}
                  convId={convId}
                  myUid={myUid}
                />
              ))}
              {outing.items.length === 0 && (
                <p className="py-2 text-center text-xs text-text-secondary/60">{t('common.empty')}</p>
              )}
            </div>

            {/* Admin actions */}
            {canEdit && (
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEdit(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-sage hover:text-sage"
                >
                  <Pencil className="h-3 w-3" />
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowComplete(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-sage/10 px-3 py-1.5 text-xs font-semibold text-sage transition-colors hover:bg-sage/20"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {t('outing.complete')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showEdit && (
        <OutingEditModal
          conversationId={convId}
          initialTitle={outing.title}
          initialItems={outing.items}
          onSave={async (_title, items) => {
            await updateItems(
              outing._id,
              convId,
              items.map((item) => ({ ...item, id: item.id || '' }))
            );
          }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {showComplete && (
        <OutingCompleteConfirm
          onConfirm={async () => { await complete(outing._id, convId); }}
          onClose={() => setShowComplete(false)}
        />
      )}
    </>
  );
}

interface CreateProps {
  convId: string;
  onCreate: () => void;
}

export function OutingCreateCTA({ convId: _convId, onCreate }: CreateProps) {
  const { t } = useTranslation();
  return (
    <div className="border-b border-border-subtle/50 bg-surface-2/40 px-4 py-2">
      <button
        type="button"
        onClick={onCreate}
        className="flex w-full items-center gap-2 rounded-lg py-2 text-xs text-text-secondary/60 transition-colors hover:text-sage"
      >
        <Backpack className="h-3.5 w-3.5" />
        <span>{t('outing.create_cta')}</span>
      </button>
    </div>
  );
}
