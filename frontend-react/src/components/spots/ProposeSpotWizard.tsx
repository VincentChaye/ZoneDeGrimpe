import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  X, ChevronLeft, ChevronRight, Mountain, Gem, Building2, ShoppingBag,
  LocateFixed, Check, Loader2, MapPin, Search,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SpotType, Orientation, Equipment } from '@/types';

interface ProposeSpotWizardProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialLatLng?: { lat: number; lng: number } | null;
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

const INITIAL: FormData = {
  name: '', type: 'crag', lat: '', lng: '', soustype: '',
  niveau_min: '', niveau_max: '', orientation: '', description: '',
  rock: '', equipement: '', hauteur: '', acces: '', url: '',
};

export function ProposeSpotWizard({ onClose, onSuccess, initialLatLng }: ProposeSpotWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(() => ({
    ...INITIAL,
    lat: initialLatLng?.lat?.toString() || '',
    lng: initialLatLng?.lng?.toString() || '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSearching, setAddressSearching] = useState(false);
  const [addressStatus, setAddressStatus] = useState<'idle' | 'found' | 'not_found'>('idle');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const set = useCallback((field: keyof FormData, value: string) => {
    setData((d) => ({ ...d, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }, []);

  const STEPS = [
    { title: t('propose.step1') },
    { title: t('propose.step2') },
    { title: t('propose.step3') },
    { title: t('propose.step4') },
    { title: t('propose.step5') },
  ];

  const validateStep = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (step === 0) {
      if (!data.name.trim()) errs.name = t('propose.err_name_required');
    } else if (step === 1) {
      if (!data.lat || isNaN(Number(data.lat))) errs.lat = t('propose.err_lat_invalid');
      if (!data.lng || isNaN(Number(data.lng))) errs.lng = t('propose.err_lng_invalid');
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => { if (validateStep()) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
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

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: data.name.trim(),
        type: data.type,
        location: {
          type: 'Point',
          coordinates: [parseFloat(data.lng), parseFloat(data.lat)],
        },
      };
      if (data.soustype) body.soustype = data.soustype;
      if (data.niveau_min) body.niveau_min = data.niveau_min;
      if (data.niveau_max) body.niveau_max = data.niveau_max;
      if (data.orientation) body.orientation = data.orientation;
      if (data.description.trim()) body.description = data.description.trim();
      if (data.acces.trim()) body.acces = data.acces.trim();
      if (data.url.trim()) body.url = data.url.trim();
      if (data.equipement) body.equipement = data.equipement;
      if (data.hauteur && !isNaN(Number(data.hauteur))) body.hauteur = parseInt(data.hauteur);
      if (data.rock) body.info_complementaires = { rock: data.rock };

      const res = await apiFetch<{ ok: boolean; status: string }>('/api/spots', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(body),
      });

      if (res.status === 'approved') {
        toast.success(t('propose.approved'));
      } else {
        toast.success(t('propose.pending'));
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

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
                {t('propose.title')}
              </h2>
              <p className="text-xs text-text-secondary">
                {STEPS[step].title} ({step + 1}/{STEPS.length})
              </p>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-2 transition-colors" type="button">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-border-subtle">
            <div className="h-full bg-sage transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Step 0: Name & Type */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t('propose.name')}
                  </label>
                  <input
                    type="text"
                    value={data.name}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder={t('propose.name_placeholder')}
                    className={cn(
                      'w-full rounded-xl border bg-surface px-4 py-3 text-sm outline-none transition-colors',
                      errors.name ? 'border-red-400' : 'border-border-subtle focus:border-sage',
                    )}
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-primary">
                    {t('propose.type')}
                  </label>
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
                      className={cn(
                        'w-full rounded-xl border bg-surface px-4 py-3 text-sm outline-none',
                        errors.lat ? 'border-red-400' : 'border-border-subtle focus:border-sage',
                      )}
                    />
                    {errors.lat && <p className="mt-1 text-xs text-red-500">{errors.lat}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-text-secondary">{t('recap.lng')}</label>
                    <input
                      type="text" inputMode="decimal"
                      value={data.lng}
                      onChange={(e) => set('lng', e.target.value)}
                      placeholder="5.2814"
                      className={cn(
                        'w-full rounded-xl border bg-surface px-4 py-3 text-sm outline-none',
                        errors.lng ? 'border-red-400' : 'border-border-subtle focus:border-sage',
                      )}
                    />
                    {errors.lng && <p className="mt-1 text-xs text-red-500">{errors.lng}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Climbing details */}
            {step === 2 && (
              <div className="space-y-4">
                {(data.type === 'crag' || data.type === 'boulder') && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-text-primary">
                        {t('propose.soustype')}
                      </label>
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
                        <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                          {t('propose.niveau_min')}
                        </label>
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
                        <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                          {t('propose.niveau_max')}
                        </label>
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

                {/* Orientation compass */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-text-primary">
                    {t('propose.orientation')}
                  </label>
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
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">{t('propose.description')}</label>
                  <textarea
                    value={data.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder={t('propose.description_placeholder')}
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
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t('propose.rock')}
                  </label>
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
                      <label className="mb-2 block text-sm font-medium text-text-primary">
                        {t('propose.equipement')}
                      </label>
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
                      <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                        {t('propose.hauteur')}
                      </label>
                      <input
                        type="number"
                        value={data.hauteur}
                        onChange={(e) => set('hauteur', e.target.value)}
                        placeholder="25"
                        className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text-primary">
                    {t('propose.acces')}
                  </label>
                  <textarea
                    value={data.acces}
                    onChange={(e) => set('acces', e.target.value)}
                    placeholder={t('propose.acces_placeholder')}
                    rows={2}
                    className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-sm outline-none focus:border-sage resize-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                    {t('propose.url')}
                  </label>
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

            {/* Step 4: Recap */}
            {step === 4 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-text-primary">
                  {t('propose.recap')}
                </h3>
                <div className="space-y-2 rounded-xl border border-border-subtle bg-surface-2/30 p-4 text-sm">
                  <Row label={t('recap.name')} value={data.name} />
                  <Row label={t('recap.type')} value={t(`spot.type.${data.type}`)} />
                  <Row label={t('recap.lat') + ', ' + t('recap.lng')} value={`${data.lat}, ${data.lng}`} />
                  {data.orientation && <Row label={t('recap.orientation')} value={t(`orient.${data.orientation}`)} />}
                  {data.niveau_min && <Row label={t('recap.grade_min')} value={data.niveau_min} />}
                  {data.niveau_max && <Row label={t('recap.grade_max')} value={data.niveau_max} />}
                  {data.rock && <Row label={t('recap.rock')} value={data.rock} />}
                  {data.equipement && <Row label={t('recap.equipment')} value={t(`equip.${data.equipement}`)} />}
                  {data.hauteur && <Row label={t('recap.height')} value={`${data.hauteur}m`} />}
                  {data.description && <Row label={t('recap.description')} value={data.description} />}
                  {data.acces && <Row label={t('recap.access')} value={data.acces} />}
                  {data.url && <Row label={t('recap.website')} value={data.url} />}
                </div>
              </div>
            )}
          </div>

          {/* Footer buttons */}
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
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-xl bg-sage px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sage-hover disabled:opacity-50"
                type="button"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {t('propose.submit')}
              </button>
            )}
          </div>
        </div>
      </div>
    </dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}
