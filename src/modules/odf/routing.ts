import { estimatedRoadKm, type LatLng } from "./geo";

export type RoadDistance = { km: number; source: "route" | "estimate" };
export type GeocodeResult = { label: string; lat: number; lng: number };

const TIMEOUT_MS = 4000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_TTL_MS = 24 * 3600_000;

function cached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return undefined;
  return hit.value as T;
}

function remember(key: string, value: unknown) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
}

const userAgent = () => `MOBI-LOG-OS/1.0 (${process.env.APP_URL ?? "pilot"})`;

/** Distância por estrada via servidor OSRM (ROUTING_URL). Sem serviço ou em falha: linha recta × 1.3. */
export async function roadDistanceKm(a: LatLng, b: LatLng): Promise<RoadDistance> {
  const base = process.env.ROUTING_URL?.replace(/\/$/, "");
  const fallback: RoadDistance = { km: estimatedRoadKm(a, b), source: "estimate" };
  if (!base) return fallback;
  const coords = `${a.lng.toFixed(5)},${a.lat.toFixed(5)};${b.lng.toFixed(5)},${b.lat.toFixed(5)}`;
  const key = `route:${coords}`;
  const hit = cached<RoadDistance>(key);
  if (hit) return hit;
  try {
    const res = await fetch(`${base}/route/v1/driving/${coords}?overview=false`, {
      headers: { "User-Agent": userAgent() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as { code?: string; routes?: { distance: number }[] };
    const meters = body.code === "Ok" ? body.routes?.[0]?.distance : undefined;
    if (!meters || !Number.isFinite(meters)) return fallback;
    const value: RoadDistance = { km: Math.max(1, Math.round(meters / 100) / 10), source: "route" };
    remember(key, value);
    return value;
  } catch {
    return fallback;
  }
}

let lastGeocodeAt = 0;

/** Pesquisa de moradas em Angola via Nominatim (GEOCODER_URL). Máx. 1 pedido/s, sem autocomplete (política OSM). */
export async function geocode(query: string, locale: string): Promise<GeocodeResult[] | null> {
  const base = process.env.GEOCODER_URL?.replace(/\/$/, "");
  const q = query.trim().slice(0, 200);
  if (!base || q.length < 3) return base ? [] : null;
  const key = `geo:${locale}:${q.toLowerCase()}`;
  const hit = cached<GeocodeResult[]>(key);
  if (hit) return hit;
  const wait = lastGeocodeAt + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeAt = Date.now();
  const url = new URL(`${base}/search`);
  url.search = new URLSearchParams({
    q,
    format: "jsonv2",
    countrycodes: "ao",
    limit: "6",
    "accept-language": locale,
  }).toString();
  const email = process.env.GEOCODER_EMAIL;
  if (email) url.searchParams.set("email", email);
  try {
    const res = await fetch(url, { headers: { "User-Agent": userAgent() }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    const value = rows
      .map((r) => ({ label: r.display_name.slice(0, 300), lat: Number(r.lat), lng: Number(r.lon) }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    remember(key, value);
    return value;
  } catch {
    return [];
  }
}
