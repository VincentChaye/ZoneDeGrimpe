import { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { Search, LocateFixed, SlidersHorizontal, X, MapPin as MapPinIcon } from 'lucide-react';
import { apiFetch, getCachedSpots, setCachedSpots } from '@/lib/api';
import { cn, SPOT_TYPES } from '@/lib/utils';
import { SpotSheet } from '@/components/spots/SpotSheet';
import type { Spot, SpotType } from '@/types';

import 'leaflet/dist/leaflet.css';

/* ---------- Fix Leaflet default icon path ---------- */
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

/* ---------- Custom marker icons by type ---------- */
const TYPE_COLORS: Record<SpotType, string> = {
  crag: '#5D7052',
  boulder: '#C18845',
  indoor: '#4A90D9',
  shop: '#8B5CF6',
};

function createTypeIcon(type: SpotType): L.DivIcon {
  const color = TYPE_COLORS[type] || '#5D7052';
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
    html: `<svg viewBox="0 0 24 24" width="28" height="28" fill="${color}" stroke="white" stroke-width="1.5">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="3" fill="white"/>
    </svg>`,
  });
}

const typeIcons: Record<SpotType, L.DivIcon> = {
  crag: createTypeIcon('crag'),
  boulder: createTypeIcon('boulder'),
  indoor: createTypeIcon('indoor'),
  shop: createTypeIcon('shop'),
};

/* ---------- Spot data normalization ---------- */
function normalizeSpot(s: Record<string, unknown>, i: number): Spot | null {
  let lat: number | null = null;
  let lng: number | null = null;

  // GeoJSON Feature
  if (s.type === 'Feature' && s.geometry) {
    const geom = s.geometry as { coordinates?: number[] };
    if (geom.coordinates) {
      lng = geom.coordinates[0] as number;
      lat = geom.coordinates[1] as number;
    }
    const p = (s.properties || {}) as Record<string, unknown>;
    return {
      id: String(p.id ?? p._id ?? s.id ?? `spot-${i}`),
      name: (p.name ?? 'Sans nom') as string,
      type: (p.type ?? 'crag') as SpotType,
      soustype: (p.soustype ?? null) as string | null,
      lat: lat!,
      lng: lng!,
      orientation: p.orientation as Spot['orientation'],
      niveau_min: (p.niveau_min ?? null) as string | null,
      niveau_max: (p.niveau_max ?? null) as string | null,
      id_voix: (p.id_voix ?? []) as string[],
      url: (p.url ?? null) as string | null,
      description: (p.description ?? null) as string | null,
      info_complementaires: p.info_complementaires as Spot['info_complementaires'],
      acces: (p.acces ?? null) as string | null,
      equipement: p.equipement as Spot['equipement'],
      hauteur: (p.hauteur ?? null) as number | null,
      photos: (p.photos ?? []) as Spot['photos'],
      createdBy: p.createdBy as Spot['createdBy'],
      submittedBy: p.submittedBy as Spot['submittedBy'],
      updatedBy: p.updatedBy as Spot['updatedBy'],
      createdAt: (p.createdAt ?? null) as string | null,
      updatedAt: (p.updatedAt ?? null) as string | null,
      status: p.status as Spot['status'],
      avgRating: p.avgRating as number | undefined,
      reviewCount: p.reviewCount as number | undefined,
    };
  }

  // MongoDB doc
  const loc = s.location as { lat?: number; lng?: number; type?: string; coordinates?: number[] } | undefined;
  if (loc?.type === 'Point' && loc.coordinates) {
    lng = loc.coordinates[0];
    lat = loc.coordinates[1];
  } else if (loc) {
    lat = loc.lat ?? null;
    lng = loc.lng ?? null;
  }
  if (lat == null && s.lat != null) lat = s.lat as number;
  if (lng == null && s.lng != null) lng = s.lng as number;

  if (lat == null || lng == null) return null;

  return {
    id: String(s.id ?? s._id ?? `spot-${i}`),
    name: (s.name ?? 'Sans nom') as string,
    type: (s.type ?? 'crag') as SpotType,
    soustype: (s.soustype ?? null) as string | null,
    lat,
    lng,
    orientation: s.orientation as Spot['orientation'],
    niveau_min: (s.niveau_min ?? null) as string | null,
    niveau_max: (s.niveau_max ?? null) as string | null,
    id_voix: (Array.isArray(s.id_voix) ? s.id_voix : []) as string[],
    url: (s.url ?? null) as string | null,
    description: (s.description ?? null) as string | null,
    info_complementaires: s.info_complementaires as Spot['info_complementaires'],
    acces: (s.acces ?? null) as string | null,
    equipement: s.equipement as Spot['equipement'],
    hauteur: (s.hauteur ?? null) as number | null,
    photos: (s.photos ?? []) as Spot['photos'],
    createdBy: s.createdBy as Spot['createdBy'],
    submittedBy: s.submittedBy as Spot['submittedBy'],
    updatedBy: s.updatedBy as Spot['updatedBy'],
    createdAt: (s.createdAt ?? null) as string | null,
    updatedAt: (s.updatedAt ?? null) as string | null,
    status: s.status as Spot['status'],
    avgRating: s.avgRating as number | undefined,
    reviewCount: s.reviewCount as number | undefined,
  };
}

/* ---------- LocateButton component ---------- */
function LocateButton() {
  const map = useMap();
  const { t } = useTranslation();

  const handleLocate = useCallback(() => {
    map.locate({ setView: true, maxZoom: 13 });
  }, [map]);

  return (
    <button
      onClick={handleLocate}
      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-border-subtle bg-surface shadow-card transition-colors hover:bg-surface-2"
      title={t('geo.you_are_here')}
      type="button"
    >
      <LocateFixed className="h-[18px] w-[18px] text-text-secondary" />
    </button>
  );
}

/* ---------- MapPage ---------- */
export function MapPage() {
  const { t } = useTranslation();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch spots
  useEffect(() => {
    async function load() {
      // Try cache first
      const cached = getCachedSpots<Spot[]>();
      if (cached) {
        setSpots(cached);
        setLoading(false);
        return;
      }

      try {
        const json = await apiFetch<unknown>('/api/spots?limit=20000&format=geojson');
        let raw: unknown[] = [];
        if (json && typeof json === 'object') {
          const obj = json as Record<string, unknown>;
          if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
            raw = obj.features;
          } else if (Array.isArray(json)) {
            raw = json;
          } else if (Array.isArray(obj.data)) {
            raw = obj.data;
          }
        }

        const normalized = raw
          .map((s, i) => normalizeSpot(s as Record<string, unknown>, i))
          .filter((s): s is Spot => s !== null && typeof s.lat === 'number' && typeof s.lng === 'number');

        setSpots(normalized);
        setCachedSpots(normalized);
      } catch (err) {
        console.error('[MapPage] Failed to load spots:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Filter spots
  const filteredSpots = spots.filter((s) => {
    if (filterType && s.type !== filterType) return false;
    return true;
  });

  // Search results
  const searchResults =
    searchQuery.length >= 2
      ? spots
          .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .slice(0, 8)
      : [];

  // Toggle search
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  return (
    <div className="relative h-[calc(100vh-var(--spacing-header))]">
      {/* Map */}
      <MapContainer
        center={[46.5, 2.5]}
        zoom={6}
        className="h-full w-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Markers */}
        {!loading &&
          filteredSpots.map((spot) => (
            <Marker
              key={spot.id}
              position={[spot.lat, spot.lng]}
              icon={typeIcons[spot.type] || typeIcons.crag}
              eventHandlers={{
                click: () => setSelectedSpot(spot),
              }}
            >
              <Popup>
                <strong>{spot.name}</strong>
                <br />
                <span className="text-xs text-gray-500">
                  {SPOT_TYPES[spot.type]?.label || spot.type}
                </span>
              </Popup>
            </Marker>
          ))}

        {/* Controls overlay */}
        <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
          {/* Search toggle */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-border-subtle bg-surface shadow-card transition-colors hover:bg-surface-2"
            title={t('common.search')}
            type="button"
          >
            <Search className="h-[18px] w-[18px] text-text-secondary" />
          </button>

          <LocateButton />

          <div className="h-px bg-border-subtle" />

          {/* Filters toggle */}
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              'flex h-10 cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border border-border-subtle bg-surface px-3 shadow-card transition-colors hover:bg-surface-2',
              filtersOpen && 'bg-sage-muted border-sage',
            )}
            type="button"
          >
            <SlidersHorizontal className="h-[16px] w-[16px] text-text-secondary" />
            <span className="text-xs font-medium text-text-secondary">Filtres</span>
          </button>

          {/* Reset filters */}
          {filterType && (
            <button
              onClick={() => setFilterType('')}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border border-border-subtle bg-surface shadow-card transition-colors hover:bg-surface-2"
              type="button"
            >
              <X className="h-4 w-4 text-text-secondary" />
            </button>
          )}
        </div>
      </MapContainer>

      {/* Search bar overlay */}
      {searchOpen && (
        <div className="absolute left-3 right-14 top-3 z-[1001]">
          <div className="rounded-[var(--radius-md)] border border-border-subtle bg-surface shadow-card">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.search') + '...'}
              className="w-full rounded-[var(--radius-md)] bg-transparent px-4 py-2.5 text-sm text-text-primary outline-none placeholder:text-text-secondary"
            />
            {searchResults.length > 0 && (
              <div className="max-h-60 overflow-auto border-t border-border-subtle">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSpot(s);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
                    type="button"
                  >
                    <MapPinIcon className="h-4 w-4 shrink-0 text-sage" />
                    <div>
                      <div className="text-sm font-medium text-text-primary">{s.name}</div>
                      <div className="text-xs text-text-secondary">
                        {SPOT_TYPES[s.type]?.label || s.type}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters panel */}
      {filtersOpen && (
        <div className="absolute right-3 top-[160px] z-[1000] w-56 rounded-[var(--radius-md)] border border-border-subtle bg-surface p-4 shadow-card">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Type de spot
          </p>
          <div className="flex flex-col gap-1.5">
            {(['', 'crag', 'boulder', 'indoor', 'shop'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type);
                  setFiltersOpen(false);
                }}
                className={cn(
                  'rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm font-medium transition-colors cursor-pointer',
                  filterType === type
                    ? 'bg-sage-muted text-sage'
                    : 'text-text-secondary hover:bg-surface-2',
                )}
                type="button"
              >
                {type === '' ? 'Tous les types' : SPOT_TYPES[type]?.label || type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-bg/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-surface px-6 py-4 shadow-card">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sage border-t-transparent" />
            <span className="text-sm font-medium text-text-secondary">{t('common.loading')}</span>
          </div>
        </div>
      )}

      {/* Bottom sheet */}
      {selectedSpot && (
        <SpotSheet spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
      )}
    </div>
  );
}
