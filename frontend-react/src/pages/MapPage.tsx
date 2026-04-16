import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle, CircleMarker } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import {
  Search, LocateFixed, X, MapPin as MapPinIcon, Mountain, Gem, Building2,
  ShoppingBag, Plus, SlidersHorizontal, Layers,
} from 'lucide-react';
import { apiFetch, getCachedSpots, setCachedSpots } from '@/lib/api';
import { cn, SPOT_TYPES, parseGradeToNumber } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { SpotSheet } from '@/components/spots/SpotSheet';
import type { Spot, SpotType } from '@/types';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

/* ---------- Lazy-loaded wizards (code-split) ---------- */
const ProposeSpotWizard = lazy(() =>
  import('@/components/spots/ProposeSpotWizard').then((m) => ({ default: m.ProposeSpotWizard })),
);
const EditSpotWizard = lazy(() =>
  import('@/components/spots/EditSpotWizard').then((m) => ({ default: m.EditSpotWizard })),
);

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

/* ---------- Filter chip config ---------- */
const FILTER_CHIPS: { type: SpotType; icon: typeof Mountain; key: string }[] = [
  { type: 'crag', icon: Mountain, key: 'spot.type.crag' },
  { type: 'boulder', icon: Gem, key: 'spot.type.boulder' },
  { type: 'indoor', icon: Building2, key: 'spot.type.indoor' },
  { type: 'shop', icon: ShoppingBag, key: 'spot.type.shop' },
];

const GRADE_OPTIONS = ['3','4','5','6a','6b','6c','7a','7b','7c','8a','8b','8c','9a'];

type MapLayerKey = 'osm' | 'satellite' | 'topo';
const TILE_LAYERS: Record<MapLayerKey, { url: string; attribution: string; maxZoom: number }> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    maxZoom: 18,
  },
  topo: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    maxZoom: 17,
  },
};
const MAP_LAYER_ORDER: MapLayerKey[] = ['osm', 'satellite', 'topo'];

/* ---------- Spot data normalization ---------- */
function normalizeSpot(s: Record<string, unknown>, i: number): Spot | null {
  const isFeature = s.type === 'Feature' && s.geometry;
  const p = (isFeature ? { ...(s.properties as Record<string, unknown>) } : s) as Record<string, unknown>;

  let lat: number | null = null;
  let lng: number | null = null;
  if (isFeature) {
    const coords = (s.geometry as { coordinates?: number[] }).coordinates;
    if (coords) { lng = coords[0]; lat = coords[1]; }
  } else {
    const loc = s.location as { lat?: number; lng?: number; type?: string; coordinates?: number[] } | undefined;
    if (loc?.type === 'Point' && loc.coordinates) { lng = loc.coordinates[0]; lat = loc.coordinates[1]; }
    else if (loc) { lat = loc.lat ?? null; lng = loc.lng ?? null; }
    if (lat == null) lat = (s.lat as number) ?? null;
    if (lng == null) lng = (s.lng as number) ?? null;
  }
  if (lat == null || lng == null) return null;

  return {
    id: String(p.id ?? p._id ?? s.id ?? `spot-${i}`),
    name: (p.name ?? 'Sans nom') as string,
    type: (p.type ?? 'crag') as SpotType,
    soustype: (p.soustype ?? null) as string | null,
    lat, lng,
    orientation: (p.orientation ?? null) as Spot['orientation'],
    niveau_min: (p.niveau_min ?? null) as string | null,
    niveau_max: (p.niveau_max ?? null) as string | null,
    id_voix: (Array.isArray(p.id_voix) ? p.id_voix : []) as string[],
    url: (p.url ?? null) as string | null,
    description: (p.description ?? null) as string | null,
    info_complementaires: (p.info_complementaires ?? null) as Spot['info_complementaires'],
    acces: (p.acces ?? null) as string | null,
    equipement: (p.equipement ?? null) as Spot['equipement'],
    hauteur: (p.hauteur ?? null) as number | null,
    photos: (p.photos ?? []) as Spot['photos'],
    createdBy: (p.createdBy ?? null) as Spot['createdBy'],
    submittedBy: (p.submittedBy ?? null) as Spot['submittedBy'],
    updatedBy: (p.updatedBy ?? null) as Spot['updatedBy'],
    createdAt: (p.createdAt ?? null) as string | null,
    updatedAt: (p.updatedAt ?? null) as string | null,
    status: (p.status ?? null) as Spot['status'],
    avgRating: p.avgRating as number | undefined,
    reviewCount: p.reviewCount as number | undefined,
  };
}

/* ---------- Haversine distance (km) ---------- */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ---------- useDebounce hook ---------- */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ---------- LocateButton ---------- */
function LocateButton({ onLocated }: { onLocated: (lat: number, lng: number) => void }) {
  const map = useMap();
  const { t } = useTranslation();

  const handleLocate = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 13, { duration: 0.8 });
        onLocated(latitude, longitude);
      },
      () => {
        map.locate({ setView: true, maxZoom: 13 });
      },
      { enableHighAccuracy: true },
    );
  }, [map, onLocated]);

  return (
    <button
      onClick={handleLocate}
      className={cn(
        'flex h-10 w-10 cursor-pointer items-center justify-center',
        'rounded-xl bg-surface/95 backdrop-blur-md shadow-card',
        'border border-border-subtle/50',
        'text-text-secondary transition-all duration-200',
        'hover:bg-surface hover:text-sage hover:shadow-elevated',
        'active:scale-95',
      )}
      title={t('geo.you_are_here')}
      type="button"
    >
      <LocateFixed className="h-[18px] w-[18px]" />
    </button>
  );
}

/* ---------- FlyToSpot ---------- */
function FlyToSpot({ spot }: { spot: Spot | null }) {
  const map = useMap();
  useEffect(() => {
    if (spot) map.flyTo([spot.lat, spot.lng], 14, { duration: 0.8 });
  }, [spot, map]);
  return null;
}

/* ---------- UserLocationMarker ---------- */
function UserLocationMarker({ position }: { position: { lat: number; lng: number } | null }) {
  if (!position) return null;
  return (
    <>
      <Circle
        center={[position.lat, position.lng]}
        radius={100}
        pathOptions={{ color: '#4A90D9', fillColor: '#4A90D9', fillOpacity: 0.1, weight: 1 }}
      />
      <CircleMarker
        center={[position.lat, position.lng]}
        radius={7}
        pathOptions={{ color: 'white', fillColor: '#4A90D9', fillOpacity: 1, weight: 2 }}
      />
    </>
  );
}

/* ---------- Memoized MarkerLayer (avoids re-rendering 20K markers on unrelated state changes) ---------- */
const MarkerLayer = memo(function MarkerLayer({
  spots,
  onSelect,
}: {
  spots: Spot[];
  onSelect: (spot: Spot) => void;
}) {
  const { t } = useTranslation();
  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={50}
      spiderfyOnMaxZoom
      showCoverageOnHover={false}
      disableClusteringAtZoom={16}
    >
      {spots.map((spot) => (
        <Marker
          key={spot.id}
          position={[spot.lat, spot.lng]}
          icon={typeIcons[spot.type] || typeIcons.crag}
          eventHandlers={{
            click: () => onSelect(spot),
          }}
        >
          <Popup>
            <strong>{spot.name}</strong>
            <br />
            <span className="text-xs text-gray-500">
              {t(SPOT_TYPES[spot.type]?.key || 'spot.type.crag')}
            </span>
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  );
});

/* ---------- MapPage ---------- */
export function MapPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [flyTarget, setFlyTarget] = useState<Spot | null>(null);

  // User location
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterGradeMin, setFilterGradeMin] = useState('');
  const [filterOrientation, setFilterOrientation] = useState('');
  const [filterRock, setFilterRock] = useState('');
  const [filterDistance, setFilterDistance] = useState(0); // 0 = no limit

  // Map layer
  const [mapLayer, setMapLayer] = useState<MapLayerKey>('osm');
  const cycleLayer = useCallback(() => {
    setMapLayer((prev) => {
      const idx = MAP_LAYER_ORDER.indexOf(prev);
      return MAP_LAYER_ORDER[(idx + 1) % MAP_LAYER_ORDER.length];
    });
  }, []);

  // Wizards
  const [showPropose, setShowPropose] = useState(false);
  const [editSpot, setEditSpot] = useState<Spot | null>(null);

  // Fetch spots
  const loadSpots = useCallback(async () => {
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
  }, []);

  useEffect(() => { loadSpots(); }, [loadSpots]);

  // Open spot from URL param ?spot=<id>
  useEffect(() => {
    const spotId = searchParams.get('spot');
    if (!spotId || spots.length === 0) return;
    const found = spots.find((s) => s.id === spotId);
    if (found) {
      setSelectedSpot(found);
      setFlyTarget(found);
      setSearchParams({}, { replace: true });
    }
  }, [spots, searchParams, setSearchParams]);

  // Available rock types (memoized)
  const rockTypes = useMemo(
    () => [...new Set(spots.map((s) => s.info_complementaires?.rock).filter(Boolean) as string[])].sort(),
    [spots],
  );

  // Filtered spots with all filters (memoized)
  const filteredSpots = useMemo(() => {
    let result = spots;

    if (filterType) result = result.filter((s) => s.type === filterType);

    if (filterGradeMin) {
      const minNum = parseGradeToNumber(filterGradeMin);
      result = result.filter((s) => {
        if (!s.niveau_max) return false;
        return parseGradeToNumber(s.niveau_max) >= minNum;
      });
    }

    if (filterOrientation) result = result.filter((s) => s.orientation === filterOrientation);

    if (filterRock) result = result.filter((s) => s.info_complementaires?.rock === filterRock);

    if (filterDistance > 0 && userPos) {
      result = result.filter((s) => {
        const d = haversine(userPos.lat, userPos.lng, s.lat, s.lng);
        return d <= filterDistance;
      });
    }

    return result;
  }, [spots, filterType, filterGradeMin, filterOrientation, filterRock, filterDistance, userPos]);

  // Debounced search query (300ms)
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Search results (memoized + debounced)
  const searchResults = useMemo(() => {
    if (debouncedSearch.length < 2) return [];
    const q = debouncedSearch.toLowerCase();
    return spots.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8);
  }, [spots, debouncedSearch]);

  // Count by type (memoized)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of spots) {
      counts[s.type] = (counts[s.type] || 0) + 1;
    }
    return counts;
  }, [spots]);

  // Focus search input
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  const handleLocated = useCallback((lat: number, lng: number) => {
    setUserPos({ lat, lng });
  }, []);

  // Stable callback for marker selection (avoids re-creating on each render)
  const handleMarkerSelect = useCallback((spot: Spot) => {
    setSelectedSpot(spot);
  }, []);

  const handleSpotCreated = useCallback(() => {
    // Clear cache and re-fetch without reloading the page
    localStorage.removeItem('cache_spots_v2');
    setLoading(true);
    loadSpots();
  }, [loadSpots]);

  const hasActiveFilters = filterGradeMin || filterDistance > 0 || filterOrientation || filterRock;

  return (
    <div className="relative h-full">
      {/* Map */}
      <MapContainer
        center={[46.5, 2.5]}
        zoom={6}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          key={mapLayer}
          attribution={TILE_LAYERS[mapLayer].attribution}
          url={TILE_LAYERS[mapLayer].url}
          maxZoom={TILE_LAYERS[mapLayer].maxZoom}
        />

        {!loading && (
          <MarkerLayer spots={filteredSpots} onSelect={handleMarkerSelect} />
        )}

        {/* User location marker */}
        <UserLocationMarker position={userPos} />

        <FlyToSpot spot={flyTarget} />

        {/* Right-side controls */}
        <div className="absolute right-3 top-3 z-[1000] flex flex-col gap-2">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={cn(
              'flex h-10 w-10 cursor-pointer items-center justify-center',
              'rounded-xl bg-surface/95 backdrop-blur-md shadow-card',
              'border border-border-subtle/50',
              'text-text-secondary transition-all duration-200',
              'hover:bg-surface hover:text-sage hover:shadow-elevated',
              'active:scale-95',
              searchOpen && 'bg-sage text-white border-sage hover:bg-sage-hover hover:text-white',
            )}
            title={t('common.search')}
            type="button"
          >
            {searchOpen ? <X className="h-[18px] w-[18px]" /> : <Search className="h-[18px] w-[18px]" />}
          </button>

          <LocateButton onLocated={handleLocated} />

          {/* Layer switcher */}
          <button
            onClick={cycleLayer}
            className={cn(
              'flex h-10 w-10 cursor-pointer items-center justify-center',
              'rounded-xl bg-surface/95 backdrop-blur-md shadow-card',
              'border border-border-subtle/50',
              'text-text-secondary transition-all duration-200',
              'hover:bg-surface hover:text-sage hover:shadow-elevated',
              'active:scale-95',
              mapLayer !== 'osm' && 'bg-sage text-white border-sage hover:bg-sage-hover hover:text-white',
            )}
            title={t(`map.layer.${mapLayer}`)}
            type="button"
          >
            <Layers className="h-[18px] w-[18px]" />
          </button>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex h-10 w-10 cursor-pointer items-center justify-center',
              'rounded-xl bg-surface/95 backdrop-blur-md shadow-card',
              'border border-border-subtle/50',
              'text-text-secondary transition-all duration-200',
              'hover:bg-surface hover:text-sage hover:shadow-elevated',
              'active:scale-95',
              (showFilters || hasActiveFilters) && 'bg-sage text-white border-sage hover:bg-sage-hover hover:text-white',
            )}
            title={t('filter.advanced')}
            type="button"
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
          </button>
        </div>
      </MapContainer>

      {/* Search overlay */}
      {searchOpen && (
        <div className="absolute left-3 right-16 top-3 z-[1001] animate-[fadeSlideDown_0.2s_ease-out]">
          <div className="overflow-hidden rounded-xl border border-border-subtle/50 bg-surface/95 shadow-elevated backdrop-blur-md">
            <div className="flex items-center gap-2 px-4">
              <Search className="h-4 w-4 shrink-0 text-text-secondary/60" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.search') + '...'}
                className="w-full bg-transparent py-3 text-sm text-text-primary outline-none placeholder:text-text-secondary/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-text-secondary/10 text-text-secondary transition-colors hover:bg-text-secondary/20"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="max-h-64 overflow-auto border-t border-border-subtle/50">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSpot(s);
                      setFlyTarget(s);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-sage-muted/50"
                    type="button"
                  >
                    <div className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white',
                      TYPE_COLORS[s.type] === '#5D7052' && 'bg-type-crag',
                      TYPE_COLORS[s.type] === '#C18845' && 'bg-type-boulder',
                      TYPE_COLORS[s.type] === '#4A90D9' && 'bg-type-indoor',
                      TYPE_COLORS[s.type] === '#8B5CF6' && 'bg-type-shop',
                    )}>
                      <MapPinIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-text-primary">{s.name}</div>
                      <div className="text-[11px] text-text-secondary">
                        {t(SPOT_TYPES[s.type]?.key || 'spot.type.crag')}
                        {s.niveau_max && <> &middot; {s.niveau_max}</>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {debouncedSearch.length >= 2 && searchResults.length === 0 && (
              <div className="border-t border-border-subtle/50 px-4 py-6 text-center text-xs text-text-secondary/60">
                {t('common.no_results')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Advanced filters panel */}
      {showFilters && (
        <div className="absolute right-3 top-[208px] z-[1001] w-64 animate-[fadeSlideDown_0.2s_ease-out]">
          <div className="rounded-xl border border-border-subtle/50 bg-surface/95 p-4 shadow-elevated backdrop-blur-md">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">
              {t('filter.advanced')}
            </h3>

            {/* Grade min */}
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-text-secondary">
                {t('filter.grade_min')}
              </label>
              <select
                value={filterGradeMin}
                onChange={(e) => setFilterGradeMin(e.target.value)}
                className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage"
              >
                <option value="">{t('filter.all_grades')}</option>
                {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}+</option>)}
              </select>
            </div>

            {/* Orientation */}
            <div className="mb-3">
              <label className="mb-1.5 block text-xs font-medium text-text-secondary">
                {t('filter.orientation')}
              </label>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setFilterOrientation('')}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer',
                    !filterOrientation
                      ? 'bg-sage text-white'
                      : 'bg-surface-2 text-text-secondary hover:bg-sage-muted hover:text-sage',
                  )}
                >
                  {t('filter.all_orientations')}
                </button>
                {(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setFilterOrientation(filterOrientation === o ? '' : o)}
                    className={cn(
                      'rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer',
                      filterOrientation === o
                        ? 'bg-sage text-white'
                        : 'bg-surface-2 text-text-secondary hover:bg-sage-muted hover:text-sage',
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>

            {/* Rock type */}
            {rockTypes.length > 0 && (
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('filter.rock_type')}
                </label>
                <select
                  value={filterRock}
                  onChange={(e) => setFilterRock(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm outline-none focus:border-sage"
                >
                  <option value="">{t('filter.all_rocks')}</option>
                  {rockTypes.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Distance */}
            <div className="mb-3">
              <label className="mb-1 flex items-center justify-between text-xs font-medium text-text-secondary">
                <span>{t('filter.distance')}</span>
                <span className="font-bold text-text-primary">
                  {filterDistance === 0 ? '∞' : `${filterDistance} km`}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={500}
                step={10}
                value={filterDistance}
                onChange={(e) => setFilterDistance(Number(e.target.value))}
                className="w-full accent-sage"
                disabled={!userPos}
              />
              {!userPos && (
                <p className="mt-1 text-[10px] text-text-secondary/60 italic">
                  {t('filter.geo_required')}
                </p>
              )}
            </div>

            {/* Active filter count */}
            <div className="flex items-center justify-between border-t border-border-subtle pt-3">
              <span className="text-xs text-text-secondary">
                {filteredSpots.length} spot{filteredSpots.length !== 1 ? 's' : ''}
              </span>
              {hasActiveFilters && (
                <button
                  onClick={() => { setFilterGradeMin(''); setFilterDistance(0); }}
                  className="text-xs font-medium text-sage hover:text-sage-hover"
                  type="button"
                >
                  {t('filter.reset')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter chips — bottom of map */}
      <div
        className="absolute left-3 right-3 z-[1000] flex items-center gap-2 overflow-x-auto scrollbar-none"
        style={{ bottom: 'calc(0.75rem + var(--spacing-tabbar) + env(safe-area-inset-bottom))' }}
      >
        {/* Propose button (authenticated) */}
        {isAuthenticated && (
          <button
            onClick={() => setShowPropose(true)}
            className={cn(
              'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2',
              'text-xs font-semibold shadow-card backdrop-blur-md transition-all duration-200',
              'border active:scale-95',
              'bg-sage text-white border-sage hover:bg-sage-hover',
            )}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t('propose.button')}</span>
          </button>
        )}

        {/* "All" chip */}
        <button
          onClick={() => setFilterType('')}
          className={cn(
            'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2',
            'text-xs font-semibold shadow-card backdrop-blur-md transition-all duration-200',
            'border active:scale-95',
            !filterType
              ? 'bg-sage text-white border-sage shadow-card'
              : 'bg-surface/90 text-text-secondary border-border-subtle/50 hover:bg-surface hover:border-sage/30',
          )}
          type="button"
        >
          <MapPinIcon className="h-3.5 w-3.5" />
          <span>{t('filter.all')}</span>
          <span className={cn(
            'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
            !filterType ? 'bg-white/20' : 'bg-text-secondary/10',
          )}>
            {filteredSpots.length}
          </span>
        </button>

        {FILTER_CHIPS.map(({ type, icon: Icon, key }) => {
          const active = filterType === type;
          const count = typeCounts[type] || 0;
          return (
            <button
              key={type}
              onClick={() => setFilterType(active ? '' : type)}
              className={cn(
                'flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2',
                'text-xs font-semibold shadow-card backdrop-blur-md transition-all duration-200',
                'border active:scale-95',
                active
                  ? `text-white border-transparent shadow-card bg-${SPOT_TYPES[type].color}`
                  : 'bg-surface/90 text-text-secondary border-border-subtle/50 hover:bg-surface hover:border-sage/30',
              )}
              style={active ? { backgroundColor: TYPE_COLORS[type] } : undefined}
              type="button"
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t(key)}</span>
              <span className={cn(
                'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                active ? 'bg-white/20' : 'bg-text-secondary/10',
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-bg/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl bg-surface/95 px-6 py-4 shadow-elevated backdrop-blur-md">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sage border-t-transparent" />
            <span className="text-sm font-medium text-text-secondary">{t('common.loading')}</span>
          </div>
        </div>
      )}

      {/* Spot sheet */}
      {selectedSpot && (
        <SpotSheet
          spot={selectedSpot}
          onClose={() => setSelectedSpot(null)}
          onEdit={(spot) => {
            setSelectedSpot(null);
            setEditSpot(spot);
          }}
        />
      )}

      {/* Propose wizard (lazy-loaded) */}
      {showPropose && (
        <Suspense fallback={null}>
          <ProposeSpotWizard
            onClose={() => setShowPropose(false)}
            onSuccess={handleSpotCreated}
          />
        </Suspense>
      )}

      {/* Edit wizard (lazy-loaded) */}
      {editSpot && (
        <Suspense fallback={null}>
          <EditSpotWizard
            spot={editSpot}
            onClose={() => setEditSpot(null)}
            onSuccess={handleSpotCreated}
          />
        </Suspense>
      )}
    </div>
  );
}
