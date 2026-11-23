export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
/** Factor médio estrada/linha recta até haver uma API de rotas (ver docs/integrations.md). */
export const ROAD_FACTOR = 1.3;

const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distância estimada por estrada, arredondada a 0,1 km (mínimo 1 km). */
export function estimatedRoadKm(a: LatLng, b: LatLng): number {
  return Math.max(1, Math.round(haversineKm(a, b) * ROAD_FACTOR * 10) / 10);
}

/** Rumo inicial de a para b, em graus (0 = norte), para o radar esquemático. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function isValidLatLng(p: { lat: number; lng: number }) {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}
