/* ============================================
   ZoneDeGrimpe - API Client
   ============================================ */

const PROD_API = 'https://zonedegrimpe.onrender.com';

function isLocalHost(hostname: string): boolean {
  return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(hostname);
}

// En dev (localhost), on utilise '' pour passer par le proxy Vite (/api → localhost:3000).
// En prod ou avec VITE_API_BASE_URL explicite, on utilise l'URL complète.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && isLocalHost(window.location.hostname)
    ? ''
    : PROD_API);

/* ---------- Auth helpers ---------- */

function getToken(): string | null {
  try {
    const auth = JSON.parse(localStorage.getItem('auth') || 'null');
    return auth?.token || null;
  } catch {
    return null;
  }
}

/* ---------- Fetch wrapper ---------- */

interface FetchOptions extends RequestInit {
  auth?: boolean;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { auth = false, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(extraHeaders as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // Don't set Content-Type for FormData (browser sets it with boundary)
  if (rest.body && !(rest.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    ...rest,
    headers,
    mode: 'cors',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '(no body)');
    throw new ApiError(res.status, res.statusText, body);
  }

  const text = await res.text();
  if (!text || text.trim() === '') return null as T;

  return JSON.parse(text) as T;
}

export class ApiError extends Error {
  status: number;
  statusText: string;
  body: string;

  constructor(status: number, statusText: string, body: string) {
    super(`[${status}] ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/* ---------- Cache helpers for spots ---------- */

const CACHE_KEY = 'cache_spots_v2';
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

interface CacheEntry<T> {
  ts: number;
  data: T;
}

export function getCachedSpots<T>(): T | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function setCachedSpots<T>(data: T): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota exceeded — silent */ }
}
