import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  X, ChevronLeft, ChevronRight, Mountain, Gem, Building2, ShoppingBag,
  Check, Loader2, MapPin, Search, LocateFixed,
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

const TYPE_ICONS: { type: SpotType; icon: typeof Mountain; key: string }[] = [
  { type: 'crag', icon: Mountain, key: 'spot.type.crag' },
  { type: 'boulder', icon: Gem, key: 'spot.type.boulder' },
  { type: 'indoor', icon: Building2, key: 'spot.type.indoor' },
  { type: 'shop', icon: ShoppingBag, key: 'spot.type.shop' },
];

const ORIENTATIONS: Orientation[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const EQUIPMENT_KEYS: { value: Equipment; key: string }[] = [
  { value: 'spit', key: 'equip.spit' },
  { value: 'piton', key: 'equip.piton' },
  { value: 'mixte', key: 'equip.mixte' },
  { value: 'non_equipe', key: 'equip.non_equipe' },
];

const GRADES = ['3a','3b','3c','4a','4b','4c','5a','5b','5c','6a','6a+','6b','6b+','6c','6c+','7a','7a+','7b','7b+','7c','7c+','8a','8a+','8b','8b+','8c','8c+','9a','9a+','9b','9b+','9c'];

const ROCK_KEYS = ['calcaire', 'granite', 'gres', 'gneiss', 'basalte', 'schiste', 'conglomerat', 'quartzite', 'autre'];
const ROCK_VALUES: Record<string, string> = {
  calcaire: 'Calcaire', granite: 'Granite', gres: 'Grès', gneiss: 'Gneiss',
  basalte: 'Basalte', schiste: 'Schiste', conglomerat: 'Conglomérat', quartzite: 'Quartzite', autre: 'Autre',
};

interface FormData {
  name: string;
  type: SpotType;
  lat: string;
  lng: string;
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

// Map for recap field labels
const RECAP_KEYS: Record<string, string> = {
  name: 'recap.name', type: 'recap.type', location: 'propose.step2',
  soustype: 'spot.subtype',
  niveau_min: 'recap.grade_min', niveau_max: 'recap.grade_max',
  orientation: 'recap.orientation', description: 'recap.description',
  acces: 'recap.access', url: 'recap.website', equipement: 'recap.equipment',
  hauteur: 'recap.height', info_complementaires: 'recap.rock',
};

export function EditSpotWizard({ spot, onClose, onSuccess }: EditSpotWizardProps) {
  const { t } = useTranslation();
  const { isAdmin } = useAuthStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [addressQuery, setAddressQuery] = useState('');
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressStatus, setAddressStatus] = useState<'idle' | 'found' | 'not_found'>('idle');

  const [data, setData] = useState<FormData>({
    name: spot.name,
    type: spot.type,
    lat: spot.lat.toString(),
    lng: spot.lng.toString(),
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
    { title: t('edit.step1') },
    { title: t('propose.step2') },
    { title: t('edit.step2') },
    { title: t('edit.step3') },
    { title: t('edit.step4') },
  ];

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const handleAddressSearch = async () => {
    if (!addressQuery.trim()) return;
    setAddressSearching(true);
    setAddressStatus('idle');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressQuery.trim())}`,
        { headers: { 'Accept-Language': 'fr' } },
      );
      const results = await res.json();
      if (results.length > 0) {
        set('lat', parseFloat(results[0].lat).toFixed(6));
        set('lng', parseFloat(results[0].lon).toFixed(6));
        setAddressStatus('found');
        toast.success(t('propose.address_found'));
      } else {
        setAddressStatus('not_found');
        toast.error(t('propose.address_not_found'));
      }
    } catch {
      setAddressStatus('not_found');
      toast.error(t('propose.address_not_found'));
    } finally {
      setAddressSearching(false);
    }
  };

  const handleGeolocate = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('lat', pos.coords.latitude.toFixed(6));
        set('lng', pos.coords.longitude.toFixed(6));
        toast.success(t('toast.position_found'));
      },
      () => toast.error(t('toast.position_error')),
      { enableHighAccuracy: true },
    );
  };

  // Compute changes (diff)
  const getChanges = (): Record<string, unknown> => {
    const changes: Record<string, unknown> = {};
    if (data.name !== spot.name) changes.name = data.name;
    if (data.type !== spot.type) changes.type = data.type;
    // Location change
    const newLat = parseFloat(data.lat);
    const newLng = parseFloat(data.lng);
    if (!isNaN(newLat) && !isNaN(newLng) && (newLat !== spot.lat || newLng !== spot.lng)) {
      changes.location = { type: 'Point', coordinates: [newLng, newLat] };
    }
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
      toast.info(t('toast.no_changes'));
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
        toast.success(t('edit.applied'));
      } else {
        // User: submit edit proposal
        await apiFetch('/api/spot-edits', {
          method: 'POST', auth: true,
          body: JSON.stringify({ spotId: spot.id, changes }),
        });
        toast.success(t('edit.pending'));
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || t('common.error'));
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
                {t('edit.title')}
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
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">{t('propose.name')}</label>
                  <input
                    type="text"
                    value={data.name}
                    onChange={(e) => set('name', e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-primary">{t('recap.type')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPE_ICONS.map(({ type, icon: Icon, key }) => (
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
                        <span className="text-sm">{t(key)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: Location */}
            {step === 1 && (
              <div className="space-y-4">
                {/* Address search */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t('propose.address')}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary/50" />
                      <input
                        type="text"
                        value={addressQuery}
                        onChange={(e) => { setAddressQuery(e.target.value); setAddressStatus('idle'); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddressSearch(); } }}
                        placeholder={t('propose.address_placeholder')}
                        className="w-full rounded-xl border border-border-subtle bg-surface py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-sage"
                      />
                    </div>
                    <button
                      onClick={handleAddressSearch}
                      disabled={addressSearching || !addressQuery.trim()}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl bg-sage px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
                      type="button"
                    >
                      {addressSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      {t('propose.address_search')}
                    </button>
                  </div>
                  {addressStatus === 'found' && data.lat && data.lng && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-green-600">
                      <Check className="h-3.5 w-3.5" />
                      {t('propose.address_found')} ({data.lat}, {data.lng})
                    </p>
                  )}
                  {addressStatus === 'not_found' && (
                    <p className="mt-1.5 text-xs text-red-500">{t('propose.address_not_found')}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border-subtle" />
                  <span className="text-xs text-text-secondary">{t('auth.or')}</span>
                  <div className="h-px flex-1 bg-border-subtle" />
                </div>

                {/* Geolocate button */}
                <button
                  onClick={handleGeolocate}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-sage/30 bg-sage-muted px-4 py-3 text-sm font-medium text-sage transition-colors hover:bg-sage/10"
                  type="button"
                >
                  <LocateFixed className="h-4 w-4" />
                  {t('propose.geolocate')}
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border-subtle" />
                  <span className="text-xs text-text-secondary">{t('propose.or_manual')}</span>
                  <div className="h-px flex-1 bg-border-subtle" />
                </div>

                {/* Manual lat/lng */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">{t('recap.lat')}</label>
                    <input
                      type="text" inputMode="decimal"
                      value={data.lat}
                      onChange={(e) => set('lat', e.target.value)}
                      placeholder="43.8326"
                      className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">{t('recap.lng')}</label>
                    <input
                      type="text" inputMode="decimal"
                      value={data.lng}
                      onChange={(e) => set('lng', e.target.value)}
                      placeholder="5.2814"
                      className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                    />
                  </div>
                </div>

                {/* Current location info */}
                <p className="text-[11px] text-text-secondary/60 italic">
                  Position actuelle : {spot.lat.toFixed(6)}, {spot.lng.toFixed(6)}
                </p>
              </div>
            )}

            {/* Step 2: Climbing details */}
            {step === 2 && (
              <div className="space-y-4">
                {(data.type === 'crag' || data.type === 'boulder') && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-text-primary">{t('spot.subtype')}</label>
                      <div className="flex gap-2">
                        {[
                          { v: '', key: 'spot.subtype_undefined' },
                          { v: 'diff', key: 'spot.subtype_route' },
                          { v: 'bloc', key: 'spot.subtype_boulder' },
                        ].map(({ v, key }) => (
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
                          >{t(key)}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-text-secondary">{t('propose.niveau_min')}</label>
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
                        <label className="mb-1.5 block text-xs font-medium text-text-secondary">{t('propose.niveau_max')}</label>
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
                  <label className="mb-2 block text-sm font-medium text-text-primary">{t('propose.orientation')}</label>
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
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">{t('propose.description')}</label>
                  <textarea
                    value={data.description}
                    onChange={(e) => set('description', e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage resize-none"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Practical info */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">{t('propose.rock')}</label>
                  <select
                    value={data.rock}
                    onChange={(e) => set('rock', e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                  >
                    <option value="">—</option>
                    {ROCK_KEYS.map((r) => <option key={r} value={ROCK_VALUES[r]}>{t(`rock.${r}`)}</option>)}
                  </select>
                </div>
                {(data.type === 'crag' || data.type === 'boulder') && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-text-primary">{t('propose.equipement')}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {EQUIPMENT_KEYS.map(({ value, key }) => (
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
                          >{t(key)}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-text-secondary">{t('propose.hauteur')}</label>
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
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">{t('propose.acces')}</label>
                  <textarea
                    value={data.acces}
                    onChange={(e) => set('acces', e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage resize-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">{t('propose.url')}</label>
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

            {/* Step 4: Recap with diff */}
            {step === 4 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-text-primary">
                  {changeCount > 0
                    ? t('edit.changes_count', { count: changeCount })
                    : t('edit.no_changes')}
                </h3>
                {changeCount > 0 && (
                  <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-2/30 p-4 text-sm">
                    {Object.entries(changes).map(([key, value]) => {
                      const origMap: Record<string, unknown> = {
                        name: spot.name, type: spot.type,
                        location: `${spot.lat}, ${spot.lng}`,
                        soustype: spot.soustype,
                        niveau_min: spot.niveau_min, niveau_max: spot.niveau_max,
                        orientation: spot.orientation, description: spot.description,
                        acces: spot.acces, url: spot.url, equipement: spot.equipement,
                        hauteur: spot.hauteur, info_complementaires: spot.info_complementaires?.rock,
                      };
                      let origVal: string;
                      let newVal: string;
                      if (key === 'info_complementaires') {
                        origVal = spot.info_complementaires?.rock || '—';
                        newVal = (value as { rock?: string })?.rock || '—';
                      } else if (key === 'location') {
                        origVal = `${spot.lat}, ${spot.lng}`;
                        const coords = (value as { coordinates: number[] }).coordinates;
                        newVal = `${coords[1]}, ${coords[0]}`;
                      } else {
                        origVal = String(origMap[key] ?? '—');
                        newVal = String(value ?? '—');
                      }
                      return (
                        <div key={key} className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-text-secondary uppercase">
                            {t(RECAP_KEYS[key] || key)}
                          </span>
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
                    {t('edit.admin_notice')}
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
                {t('common.back')}
              </button>
            )}
            <div className="flex-1" />
            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                className="flex items-center gap-1.5 rounded-xl bg-sage px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover"
                type="button"
              >
                {t('common.next')}
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
                {isAdmin ? t('edit.apply') : t('edit.submit')}
              </button>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}
