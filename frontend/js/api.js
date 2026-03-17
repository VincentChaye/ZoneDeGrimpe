// api.js
import { API_BASE_URL, CACHE_KEYS, CACHE_TTL_MS } from "./config.js";

/* ---------- constantes ---------- */
const API_PREFIX = "/api"; // préfixe commun aux routes backend

/* ---------- cache helpers ---------- */
function getCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}
function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Quota dépassé (Safari mobile ~5MB) → on vide le cache spots seulement
    try {
      Object.keys(localStorage).forEach(k => { if (k.startsWith("cache_")) localStorage.removeItem(k); });
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch { /* silencieux */ }
  }
}

/* ---------- coercion/normalisation ---------- */
function coerceArray(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;

  // GeoJSON FeatureCollection (éventuellement avec total/hasMore)
  if (json.type === "FeatureCollection" && Array.isArray(json.features)) {
    return json.features;
  }

  // Variantes fréquentes d’API
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.results)) return json.results;
  if (Array.isArray(json.spots)) return json.spots;
  if (Array.isArray(json.items)) return json.items;

  // Un seul objet → on l’enveloppe
  if (typeof json === "object") return [json];

  return [];
}

function num(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toSpot(s, i) {
  // GeoJSON Feature
  if (s && s.type === "Feature" && s.geometry && Array.isArray(s.geometry.coordinates)) {
    const [lngRaw, latRaw] = s.geometry.coordinates;
    const lat = num(latRaw), lng = num(lngRaw);
    const p = s.properties || s.props || {};
    return {
      id: String(p.id ?? p._id ?? s.id ?? `spot-${i}`),
      name: p.name ?? p.titre ?? "Sans nom",
      type: p.type ?? p.soustype ?? "inconnu",
      soustype: p.soustype ?? null,
      orientation: p.orientation ?? p?.info_complementaires?.orientation ?? null,
      niveau_min: p.niveau_min ?? null,
      niveau_max: p.niveau_max ?? null,
      id_voix: p.id_voix ?? [],
      url: p.url ?? null,
      description: p.description ?? null,
      info_complementaires: p.info_complementaires ?? null,
      lat, lng,
    };
  }

  // Doc Mongo {location:{lat,lng}} ou Point [lng,lat] ou variantes à plat
  let lat = num(s?.location?.lat);
  let lng = num(s?.location?.lng);

  if ((lat == null || lng == null) && s?.location?.type === "Point" && Array.isArray(s.location.coordinates)) {
    const [lngRaw, latRaw] = s.location.coordinates;
    lng = num(lngRaw);
    lat = num(latRaw);
  }
  // fallback très permissif
  if (lat == null && s?.lat != null) lat = num(s.lat);
  if (lng == null && s?.lng != null) lng = num(s.lng);

  return {
    id: String(s.id ?? s._id ?? `spot-${i}`),
    name: s.name ?? s.titre ?? "Sans nom",
    type: s.type ?? s.soustype ?? "inconnu",
    soustype: s.soustype ?? null,
    orientation: s?.info_complementaires?.orientation ?? s.orientation ?? null,
    niveau_min: s.niveau_min ?? null,
    niveau_max: s.niveau_max ?? null,
    id_voix: Array.isArray(s.id_voix) ? s.id_voix : [],
    url: s.url ?? null,
    description: s.description ?? null,
    info_complementaires: s.info_complementaires ?? null,
    lat, lng,
  };
}

function normalize(arr) {
  const before = arr.length;
  const norm = arr.map(toSpot).filter(s => typeof s.lat === "number" && typeof s.lng === "number");
  console.log(`[fetchSpotsAll] API: ${before} éléments → normalisés: ${norm.length}`);
  if (!norm.length && before) {
    console.warn("[normalize] Exemple élément brut:", arr[0]);
  }
  return norm;
}

/* ---------- URL helper ---------- */
function apiUrl(path, params) {
  const full = new URL(`${API_PREFIX}${path}`, API_BASE_URL);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) full.searchParams.set(k, String(v));
    }
  }
  return full.toString();
}

/* ---------- fetch util ---------- */
async function tryFetch(url) {
  let r;
  try {
    r = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store", // évite les 304 en dev
      mode: "cors",
    });
  } catch (netErr) {
    console.error("[network_error]", netErr, "url=", url);
    throw new Error(`[network_error] ${netErr?.message || netErr}`);
  }

  if (!r.ok) {
    const body = await r.text().catch(() => "(no body)");
    console.error(`[http_${r.status}]`, url, body.slice(0, 200));
    throw new Error(`[http_${r.status}] ${r.statusText} — ${body.slice(0, 200)}`);
  }

  // Certains proxies renvoient 204/empty → gérons-le proprement
  const txt = await r.text();
  if (!txt || txt.trim() === '') {
    console.warn('[api] Empty response from:', url);
    return null;
  }

  try {
    return JSON.parse(txt);
  } catch (parseErr) {
    console.error('[api] JSON parse error:', parseErr, 'URL:', url, 'Response preview:', txt.slice(0, 200));
    throw new Error(`[json_parse_error] Réponse invalide du serveur. Preview: ${txt.slice(0, 100)}`);
  }
}

/* ---------- fetch paginé ---------- */
export async function fetchSpots({
  useCache = true,
  pageSize = 5000,
  extraParams = { format: "geojson" },
} = {}) {
  if (useCache) {
    const cached = getCache(CACHE_KEYS.SPOTS);
    if (cached) return cached;
  }

  const out = [];
  let usedMode = null; // "skip" | "page" | "single"
  let page = 1;
  let skip = 0;

  // 1) skip/limit
  while (true) {
    const url = apiUrl("/spots", { limit: pageSize, skip, ...extraParams });
    const json = await tryFetch(url);
    const arr = coerceArray(json);

    if (!arr.length) {
      if (skip === 0) break;
      usedMode = "skip";
      break;
    }

    out.push(...arr);
    if (arr.length < pageSize) {
      usedMode = "skip";
      break;
    }
    skip += pageSize;
  }

  // 2) page/perPage
  if (!out.length) {
    while (true) {
      const url = apiUrl("/spots", { perPage: pageSize, page, ...extraParams });
      const json = await tryFetch(url);
      const arr = coerceArray(json);

      if (!arr.length) {
        if (page === 1) break;
        usedMode = "page";
        break;
      }

      out.push(...arr);
      if (arr.length < pageSize) {
        usedMode = "page";
        break;
      }
      page += 1;
    }
  }

  // 3) single fetch
  if (!out.length) {
    const url = apiUrl("/spots", { ...extraParams });
    const json = await tryFetch(url);
    const arr = coerceArray(json);
    out.push(...arr);
    usedMode = "single";
  }

  console.log(`[fetchSpotsAll] mode=${usedMode} total bruts=${out.length}`);
  const normalized = normalize(out);

  setCache(CACHE_KEYS.SPOTS, normalized);
  return normalized;
}
