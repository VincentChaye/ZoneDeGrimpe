import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  X, ChevronLeft, ChevronRight, Mountain, Gem, Building2, ShoppingBag,
  Check, Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import type { Spot, SpotType, Orientation, Equipment } from '@/types';

interface EditSpotWizardProps {
  spot: Spot;
  onClose: () => void;
  onSuccess?: () => void;
}

const TYPES: { type: SpotType; icon: typeof Mountain; label: string }[] = [
  { type: 'crag', icon: Mountain, label: 'Falaise' },
  { type: 'boulder', icon: Gem, label: 'Bloc' },
  { type: 'indoor', icon: Building2, label: 'Salle' },
  { type: 'shop', icon: ShoppingBag, label: 'Magasin' },
];

const ORIENTATIONS: Orientation[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const EQUIPMENTS: { value: Equipment; label: string }[] = [
  { value: 'spit', label: 'Spit' },
  { value: 'piton', label: 'Piton' },
  { value: 'mixte', label: 'Mixte' },
  { value: 'non_equipe', label: 'Non equipé' },
];

const GRADES = ['3a','3b','3c','4a','4b','4c','5a','5b','5c','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c'];
const ROCKS = ['Calcaire', 'Granite', 'Grès', 'Gneiss', 'Basalte', 'Schiste', 'Conglomérat', 'Quartzite', 'Autre'];

interface FormData {
  name: string;
  type: SpotType;
  soustype: string;
  niveau_min: string;
  niveau_max: string;
  orientation: Orientation | '';
  description: string;
  rock: string;
  equipement: Equipment | '';
  hauteur: string;
  acces: string;
  url: string;
}

export function EditSpotWizard({ spot, onClose, onSuccess }: EditSpotWizardProps) {
  const { t } = useTranslation();
  const { isAdmin } = useAuthStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [data, setData] = useState<FormData>({
    name: spot.name,
    type: spot.type,
    soustype: spot.soustype || '',
    niveau_min: spot.niveau_min || '',
    niveau_max: spot.niveau_max || '',
    orientation: spot.orientation || '',
    description: spot.description || '',
    rock: spot.info_complementaires?.rock || '',
    equipement: spot.equipement || '',
    hauteur: spot.hauteur?.toString() || '',
    acces: spot.acces || '',
    url: spot.url || '',
  });

  useEffect(() => { dialogRef.current?.showModal(); }, []);

  const set = useCallback((field: keyof FormData, value: string) => {
    setData((d) => ({ ...d, [field]: value }));
  }, []);

  const STEPS = [
    { title: t('edit.step1') || 'Nom & Type' },
    { title: t('edit.step2') || 'Détails grimpe' },
    { title: t('edit.step3') || 'Infos pratiques' },
    { title: t('edit.step4') || 'Récapitulatif' },
  ];

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  // Compute changes (diff)
  const getChanges = (): Record<string, unknown> => {
    const changes: Record<string, unknown> = {};
    if (data.name !== spot.name) changes.name = data.name;
    if (data.type !== spot.type) changes.type = data.type;
    if (data.soustype !== (spot.soustype || '')) changes.soustype = data.soustype || null;
    if (data.niveau_min !== (spot.niveau_min || '')) changes.niveau_min = data.niveau_min || null;
    if (data.niveau_max !== (spot.niveau_max || '')) changes.niveau_max = data.niveau_max || null;
    if (data.orientation !== (spot.orientation || '')) changes.orientation = data.orientation || null;
    if (data.description !== (spot.description || '')) changes.description = data.description || null;
    if (data.acces !== (spot.acces || '')) changes.acces = data.acces || null;
    if (data.url !== (spot.url || '')) changes.url = data.url || null;
    if (data.equipement !== (spot.equipement || '')) changes.equipement = data.equipement || null;
    const h = data.hauteur ? parseInt(data.hauteur) : null;
    if (h !== (spot.hauteur || null)) changes.hauteur = h;
    const rock = data.rock || null;
    const origRock = spot.info_complementaires?.rock || null;
    if (rock !== origRock) changes.info_complementaires = { rock };
    return changes;
  };

  const handleSubmit = async () => {
    const changes = getChanges();
    if (Object.keys(changes).length === 0) {
      toast.info('Aucune modification');
      return;
    }

    setSubmitting(true);
    try {
      if (isAdmin) {
        // Admin: direct patch
        await apiFetch(`/api/spots/${spot.id}`, {
          method: 'PATCH', auth: true,
          body: JSON.stringify(changes),
        });
        toast.success(t('edit.applied') || 'Modifications appliquées');
      } else {
        // User: submit edit proposal
        await apiFetch('/api/spot-edits', {
          method: 'POST', auth: true,
          body: JSON.stringify({ spotId: spot.id, changes }),
        });
        toast.success(t('edit.pending') || 'Modifications soumises, en attente de validation');
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const changes = getChanges();
  const changeCount = Object.keys(changes).length;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[2000] m-0 h-full w-full max-h-full max-w-full bg-transparent p-0 backdrop:bg-black/40"
      onClose={onClose}
    >
      <div className="flex h-full items-end justify-center md:items-center">
        <div className="w-full max-w-lg rounded-t-2xl bg-surface shadow-elevated md:rounded-2xl md:max-h-[85vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-text-primary">
                {t('edit.title') || 'Modifier le spot'}
              </h2>
              <p className="text-xs text-text-secondary">
                {spot.name} &middot; {STEPS[step].title} ({step + 1}/{STEPS.length})
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-2 transition-colors" type="button">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="h-1 bg-border-subtle">
            <div className="h-full bg-sage transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Step 0: Name & Type */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Nom du spot</label>
                  <input
                    type="text"
                    value={data.name}
                    onChange={(e) => set('name', e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-primary">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPES.map(({ type, icon: Icon, label }) => (
                      <button
                        key={type}
                        onClick={() => set('type', type)}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                          data.type === type
                            ? 'border-sage bg-sage-muted text-sage font-semibold'
                            : 'border-border-subtle text-text-secondary hover:border-sage/30',
                        )}
                        type="button"
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-sm">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Climbing details */}
            {step === 1 && (
              <div className="space-y-4">
                {(data.type === 'crag' || data.type === 'boulder') && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-text-primary">Sous-type</label>
                      <div className="flex gap-2">
                        {[{ v: '', l: 'Non défini' }, { v: 'diff', l: 'Voie' }, { v: 'bloc', l: 'Bloc' }].map(({ v, l }) => (
                          <button
                            key={v}
                            onClick={() => set('soustype', v)}
                            className={cn(
                              'flex-1 rounded-xl border px-3 py-2.5 text-sm transition-all',
                              data.soustype === v
                                ? 'border-sage bg-sage-muted text-sage font-semibold'
                                : 'border-border-subtle text-text-secondary hover:border-sage/30',
                            )}
                            type="button"
                          >{l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Niveau min</label>
                        <select
                          value={data.niveau_min}
                          onChange={(e) => set('niveau_min', e.target.value)}
                          className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                        >
                          <option value="">—</option>
                          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-text-secondary">Niveau max</label>
                        <select
                          value={data.niveau_max}
                          onChange={(e) => set('niveau_max', e.target.value)}
                          className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                        >
                          <option value="">—</option>
                          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-text-primary">Orientation</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ORIENTATIONS.map((o) => (
                      <button
                        key={o}
                        onClick={() => set('orientation', data.orientation === o ? '' : o)}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full border text-xs font-bold transition-all',
                          data.orientation === o
                            ? 'border-sage bg-sage text-white'
                            : 'border-border-subtle text-text-secondary hover:border-sage/30',
                          o === 'N' && data.orientation !== o && 'text-red-500',
                        )}
                        type="button"
                      >{o}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Description</label>
                  <textarea
                    value={data.description}
                    onChange={(e) => set('description', e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Practical info */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Type de roche</label>
                  <select
                    value={data.rock}
                    onChange={(e) => set('rock', e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                  >
                    <option value="">—</option>
                    {ROCKS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {(data.type === 'crag' || data.type === 'boulder') && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-text-primary">Equipement</label>
                      <div className="grid grid-cols-2 gap-2">
                        {EQUIPMENTS.map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => set('equipement', data.equipement === value ? '' : value)}
                            className={cn(
                              'rounded-xl border px-3 py-2.5 text-sm transition-all',
                              data.equipement === value
                                ? 'border-sage bg-sage-muted text-sage font-semibold'
                                : 'border-border-subtle text-text-secondary hover:border-sage/30',
                            )}
                            type="button"
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text-secondary">Hauteur (m)</label>
                      <input
                        type="number"
                        value={data.hauteur}
                        onChange={(e) => set('hauteur', e.target.value)}
                        className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">Accès</label>
                  <textarea
                    value={data.acces}
                    onChange={(e) => set('acces', e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage resize-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">Site web</label>
                  <input
                    type="url"
                    value={data.url}
                    onChange={(e) => set('url', e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Recap with diff */}
            {step === 3 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-text-primary">
                  {changeCount > 0
                    ? `${changeCount} modification${changeCount > 1 ? 's' : ''}`
                    : 'Aucune modification'}
                </h3>
                {changeCount > 0 && (
                  <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-2/30 p-4 text-sm">
                    {Object.entries(changes).map(([key, value]) => {
                      const origMap: Record<string, unknown> = {
                        name: spot.name, type: spot.type, soustype: spot.soustype,
                        niveau_min: spot.niveau_min, niveau_max: spot.niveau_max,
                        orientation: spot.orientation, description: spot.description,
                        acces: spot.acces, url: spot.url, equipement: spot.equipement,
                        hauteur: spot.hauteur, info_complementaires: spot.info_complementaires?.rock,
                      };
                      const origVal = key === 'info_complementaires'
                        ? (spot.info_complementaires?.rock || '—')
                        : String(origMap[key] ?? '—');
                      const newVal = key === 'info_complementaires'
                        ? ((value as { rock?: string })?.rock || '—')
                        : String(value ?? '—');
                      return (
                        <div key={key} className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-text-secondary uppercase">{key}</span>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="line-through text-red-400">{origVal}</span>
                            <span className="text-text-secondary">&rarr;</span>
                            <span className="font-medium text-green-600">{newVal}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!isAdmin && changeCount > 0 && (
                  <p className="text-xs text-text-secondary/70 italic">
                    Vos modifications seront soumises à validation par un administrateur.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-border-subtle px-5 py-4">
            {step > 0 && (
              <button
                onClick={prev}
                className="flex items-center gap-1.5 rounded-xl border border-border-subtle px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2"
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
                Retour
              </button>
            )}
            <div className="flex-1" />
            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                className="flex items-center gap-1.5 rounded-xl bg-sage px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover"
                type="button"
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || changeCount === 0}
                className="flex items-center gap-1.5 rounded-xl bg-sage px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
                type="button"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isAdmin ? 'Appliquer' : 'Soumettre'}
              </button>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
